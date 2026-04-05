/**
 * Discord-style command search: column: operator value, comma-separated.
 * Value can be quoted. Use @other_column to compare two columns (with = or !=).
 * Operator same: company: same contact → string equality of two fields.
 */
(function () {
    const OPS = new Set([
        'contains', 'starts', 'ends', 'regex', 'same',
        '=', '!=', '>', '<', '>=', '<='
    ]);

    function splitByComma(str) {
        const out = [];
        let cur = '';
        let quote = null;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (quote) {
                cur += c;
                if (c === quote) quote = null;
                continue;
            }
            if (c === '"' || c === "'") {
                quote = c;
                cur += c;
                continue;
            }
            if (c === ',') {
                out.push(cur.trim());
                cur = '';
                continue;
            }
            cur += c;
        }
        out.push(cur.trim());
        return out.filter((s) => s.length > 0);
    }

    function unquote(s) {
        const t = s.trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
            return t.slice(1, -1).replace(/\\(.)/g, '$1');
        }
        return t;
    }

    function normalizeKey(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/-/g, '_');
    }

    function buildAliasMap(schema) {
        const map = new Map();
        for (const col of schema) {
            for (const a of col.aliases) {
                map.set(normalizeKey(a), col);
            }
        }
        return map;
    }

    function resolveColumn(raw, aliasMap) {
        return aliasMap.get(normalizeKey(raw)) || null;
    }

    function parseSearchQuery(query, schema) {
        const aliasMap = buildAliasMap(schema);
        const commands = [];
        const freeTextChunks = [];

        if (!query || !String(query).trim()) {
            return { ok: true, commands: [], freeText: null };
        }

        const parts = splitByComma(query);
        for (const part of parts) {
            const colon = part.indexOf(':');
            if (colon === -1) {
                freeTextChunks.push(part.trim());
                continue;
            }
            const colRaw = part.slice(0, colon).trim();
            let rhs = part.slice(colon + 1).trim();
            const field = resolveColumn(colRaw, aliasMap);
            if (!field) {
                freeTextChunks.push(part.trim());
                continue;
            }

            let op = null;
            let value = rhs;
            const m = rhs.match(/^(\S+)\s+(.*)$/s);
            if (m && OPS.has(m[1].toLowerCase())) {
                op = m[1].toLowerCase();
                value = m[2].trim();
            } else {
                const useEquals =
                    field.type === 'number' ||
                    field.type === 'progress' ||
                    field.type === 'enum';
                op = useEquals ? '=' : 'contains';
            }

            let valueCol = null;
            if (value.startsWith('@')) {
                const ref = resolveColumn(value.slice(1).trim(), aliasMap);
                if (ref) valueCol = ref.key;
                value = null;
            }

            if (op === 'same') {
                const ref = resolveColumn(value, aliasMap);
                if (ref) {
                    valueCol = ref.key;
                    value = null;
                }
            }

            commands.push({ fieldKey: field.key, op, value: value != null ? unquote(value) : null, valueCol });
        }

        const freeText = freeTextChunks.length ? freeTextChunks.join(' ').trim() : null;
        return { ok: true, commands, freeText };
    }

    function getField(row, key, schema) {
        const col = schema.find((c) => c.key === key);
        if (!col || !col.get) return undefined;
        return col.get(row);
    }

    function asString(v) {
        if (v == null) return '';
        return String(v).toLowerCase();
    }

    function asNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
    }

    function compare(op, left, right, leftStr, rightStr) {
        switch (op) {
            case '=':
                return leftStr === rightStr;
            case '!=':
                return leftStr !== rightStr;
            case '>':
                return asNumber(left) > asNumber(right);
            case '<':
                return asNumber(left) < asNumber(right);
            case '>=':
                return asNumber(left) >= asNumber(right);
            case '<=':
                return asNumber(left) <= asNumber(right);
            case 'contains':
                return leftStr.includes(rightStr);
            case 'starts':
                return leftStr.startsWith(rightStr);
            case 'ends':
                return leftStr.endsWith(rightStr);
            case 'regex':
                try {
                    return new RegExp(rightStr, 'i').test(String(left));
                } catch {
                    return false;
                }
            default:
                return false;
        }
    }

    function rowMatchesCommands(row, parsed, schema) {
        if (!parsed.commands.length && !parsed.freeText) return true;

        for (const cmd of parsed.commands) {
            const col = schema.find((c) => c.key === cmd.fieldKey);
            if (!col) continue;
            const left = col.get(row);
            const leftStr = asString(left);

            let right;
            let rightStr;
            if (cmd.valueCol) {
                right = getField(row, cmd.valueCol, schema);
                rightStr = asString(right);
            } else if (cmd.value != null) {
                right = cmd.value;
                rightStr = asString(cmd.value);
            } else {
                return false;
            }

            if (cmd.op === 'same') {
                if (!cmd.valueCol) return false;
                if (asString(left) !== asString(right)) return false;
                continue;
            }

            if (!compare(cmd.op, left, right, leftStr, rightStr)) return false;
        }

        if (parsed.freeText) {
            const q = parsed.freeText.toLowerCase();
            const textFields = schema.filter((c) => c.type === 'text' || c.type === 'enum');
            const hit = textFields.some((c) => asString(c.get(row)).includes(q));
            if (!hit) return false;
        }

        return true;
    }

    /** @param {string} tab - active|pending|completed|onhold|cancelled */
    function getSearchSchemaForTab(tab) {
        const main = [
            {
                key: 'company_name',
                aliases: ['company', 'company_name', 'org'],
                type: 'text',
                get: (r) => r.company_name
            },
            {
                key: 'contact_name',
                aliases: ['contact', 'contact_name', 'name'],
                type: 'text',
                get: (r) => r.contact_name
            },
            {
                key: 'service_category_name',
                aliases: ['category', 'service', 'service_category'],
                type: 'text',
                get: (r) => r.service_category_name
            },
            {
                key: 'status',
                aliases: ['status', 'state'],
                type: 'enum',
                get: (r) => r.status,
                suggest: ['Active', 'Planning', 'Pending Plan', 'On Hold', 'Completed', 'Cancelled']
            },
            {
                key: 'priority',
                aliases: ['priority', 'prio'],
                type: 'enum',
                get: (r) => r.priority,
                suggest: ['Low', 'Medium', 'High', 'Critical']
            },
            {
                key: 'progress_pct',
                aliases: ['progress', 'percent', 'pct'],
                type: 'progress',
                get: (r) => r.progress_pct ?? 0
            },
            {
                key: 'years_known',
                aliases: ['years', 'years_known'],
                type: 'number',
                get: (r) => r.years_known ?? 0
            },
            {
                key: 'employee_names',
                aliases: ['employees', 'employee', 'staff'],
                type: 'text',
                get: (r) => r.employee_names
            },
            {
                key: 'email',
                aliases: ['email', 'mail'],
                type: 'text',
                get: (r) => r.email
            },
            {
                key: 'phone',
                aliases: ['phone', 'tel'],
                type: 'text',
                get: (r) => r.phone
            },
            {
                key: 'last_contact_date',
                aliases: ['last_contact', 'last_contact_date', 'lastseen'],
                type: 'text',
                get: (r) => r.last_contact_date
            },
            {
                key: 'created_at',
                aliases: ['created', 'created_at'],
                type: 'text',
                get: (r) => r.created_at
            },
            {
                key: 'notes',
                aliases: ['notes', 'note'],
                type: 'text',
                get: (r) => r.notes
            },
            {
                key: 'city',
                aliases: ['city'],
                type: 'text',
                get: (r) => r.city
            },
            {
                key: 'country',
                aliases: ['country'],
                type: 'text',
                get: (r) => r.country
            }
        ];

        const pending = [
            {
                key: 'company_name',
                aliases: ['company', 'company_name'],
                type: 'text',
                get: (r) => r.company_name
            },
            {
                key: 'contact_name',
                aliases: ['contact', 'contact_name'],
                type: 'text',
                get: (r) => r.contact_name
            },
            {
                key: 'service_category_name',
                aliases: ['category', 'service_category'],
                type: 'text',
                get: (r) => r.service_category_name
            },
            {
                key: 'priority',
                aliases: ['priority'],
                type: 'enum',
                get: (r) => r.priority,
                suggest: ['Low', 'Medium', 'High', 'Critical']
            },
            {
                key: 'created_at',
                aliases: ['created', 'created_at'],
                type: 'text',
                get: (r) => r.created_at
            },
            {
                key: 'status',
                aliases: ['status'],
                type: 'enum',
                get: (r) => r.status,
                suggest: ['Pending Plan']
            }
        ];

        return tab === 'pending' ? pending : main;
    }

    function levenshtein(a, b) {
        const m = a.length;
        const n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        const row = new Array(n + 1);
        for (let j = 0; j <= n; j++) row[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = row[0];
            row[0] = i;
            for (let j = 1; j <= n; j++) {
                const tmp = row[j];
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
                prev = tmp;
            }
        }
        return row[n];
    }

    function getColumnSuggestions(prefix, schema) {
        const raw = String(prefix || '').trim();
        const pl = raw.toLowerCase();
        const p = normalizeKey(raw).replace(/_/g, '');
        if (!p) return schema.slice(0, 12).map((c) => ({ label: c.aliases[0], insert: c.aliases[0] }));
        const scored = [];
        for (const col of schema) {
            let best = Infinity;
            let bestAlias = col.aliases[0];
            for (const a of col.aliases) {
                const al = a.toLowerCase();
                const an = normalizeKey(a).replace(/_/g, '');
                let score = 100;
                if (al.startsWith(pl) || an.startsWith(p)) score = 0;
                else if (al.includes(pl) || an.includes(p)) score = 2;
                else {
                    const d = levenshtein(p.slice(0, 12), an.slice(0, 12));
                    if (d <= 3 && p.length >= 2) score = 5 + d;
                }
                if (score < best) {
                    best = score;
                    bestAlias = a;
                }
            }
            if (best < 90) {
                scored.push({ label: `${col.aliases[0]} (${col.key})`, insert: bestAlias, score: best });
            }
        }
        scored.sort((x, y) => x.score - y.score || x.insert.localeCompare(y.insert));
        return scored.slice(0, 12).map(({ label, insert }) => ({ label, insert }));
    }

    function getOperatorSuggestions() {
        return [
            { label: 'contains', insert: 'contains ' },
            { label: 'starts', insert: 'starts ' },
            { label: 'ends', insert: 'ends ' },
            { label: '=', insert: '= ' },
            { label: '!=', insert: '!= ' },
            { label: '>', insert: '> ' },
            { label: '<', insert: '< ' },
            { label: '>=', insert: '>= ' },
            { label: '<=', insert: '<= ' },
            { label: 'same', insert: 'same ' },
            { label: 'regex', insert: 'regex ' },
            { label: 'ref column (@name)', insert: '@' }
        ];
    }

    function getValueSuggestions(field, prefix) {
        if (!field || !field.suggest || !prefix) return [];
        const p = prefix.toLowerCase();
        return field.suggest
            .filter((v) => v.toLowerCase().startsWith(p) || v.toLowerCase().includes(p))
            .slice(0, 8)
            .map((v) => ({ label: v, insert: v }));
    }

    function resolveColumnKey(raw, schema) {
        return resolveColumn(raw, buildAliasMap(schema));
    }

    window.CrmSearchCommands = {
        parseSearchQuery,
        rowMatchesCommands,
        getSearchSchemaForTab,
        getColumnSuggestions,
        getOperatorSuggestions,
        getValueSuggestions,
        splitByComma,
        resolveColumnKey
    };
})();
