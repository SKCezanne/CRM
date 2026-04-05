const API_BASE = '/api';

/** Chart.js styling for dark UI */
const CHART_TEXT = '#a1a1aa';
const CHART_GRID = 'rgba(255, 255, 255, 0.06)';
const chartPluginTheme = {
    legend: {
        position: 'bottom',
        labels: { color: CHART_TEXT, padding: 12, font: { size: 11 } }
    },
    tooltip: {
        backgroundColor: '#1a1a1f',
        titleColor: '#f4f4f5',
        bodyColor: '#d4d4d8',
        borderColor: '#2a2a32',
        borderWidth: 1
    }
};

let allCustomers = [];
let filteredCustomers = [];
let pendingCustomers = [];
let filteredPendingCustomers = [];
let commandSuggestItems = [];
let commandSuggestSelected = -1;
let charts = [];
let statusPieChart = null;
let currentTab = 'active';
let contextCustomerId = null;
let contextRowEl = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const authed = await ensureLoggedIn();
    if (!authed) return;
    await loadServiceCategories();
    wireContextMenu();
    await refreshSidebar();
    wireCommandSearch();
    await switchTab('active');
});

async function ensureLoggedIn() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`);
        const data = await res.json();
        if (!data.user) {
            window.location.href = '/login.html';
            return false;
        }
        const userLine = document.getElementById('activityUserLine');
        if (userLine) userLine.textContent = `Signed in as ${data.user.username}`;
        return true;
    } catch (_) {
        window.location.href = '/login.html';
        return false;
    }
}

async function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('mainSection').style.display = tab === 'pending' ? 'none' : 'block';
    document.getElementById('pendingSection').style.display = tab === 'pending' ? 'block' : 'none';

    document.querySelectorAll('.stat-pill-btn').forEach((btn) => {
        btn.classList.toggle('stat-pill-active', btn.getAttribute('data-tab-target') === tab);
    });

    // Reset filters on tab switch (keeps UX predictable)
    const statusEl = document.getElementById('filterStatus');
    const priorityEl = document.getElementById('filterPriority');
    const cmdEl = document.getElementById('commandSearchInput');
    if (statusEl) statusEl.value = '';
    if (priorityEl) priorityEl.value = '';
    if (cmdEl) cmdEl.value = '';
    hideCommandSuggest();

    if (tab === 'pending') {
        await loadPendingCustomers();
    } else {
        await loadCustomersForTab(tab);
    }
    await refreshSidebar();
}

// Load service categories for dropdown
async function loadServiceCategories() {
    try {
        const response = await fetch(`${API_BASE}/service-categories`);
        const categories = await response.json();
        const select = document.getElementById('serviceCategorySelect');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading service categories:', error);
    }
}

async function loadCustomersForTab(tab) {
    try {
        const response = await fetch(`${API_BASE}/customers/tab/${tab}`);
        allCustomers = await response.json();
        runTableFilters();
        await refreshSidebar();
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customersTableBody').innerHTML = 
            '<tr><td colspan="9" class="loading">Error loading customers. Please check your database connection.</td></tr>';
    }
}

// Backwards-compatible helper (older code paths call this)
async function loadCustomers() {
    if (currentTab === 'pending') {
        await loadPendingCustomers();
        return;
    }
    await loadCustomersForTab(currentTab || 'active');
}

async function loadPendingCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers/tab/pending`);
        pendingCustomers = await response.json();
        runTableFilters();
        await refreshSidebar();
    } catch (error) {
        console.error('Error loading pending:', error);
        document.getElementById('pendingTableBody').innerHTML = 
            '<tr><td colspan="6" class="loading">Error loading pending customers.</td></tr>';
    }
}

async function refreshSidebar() {
    await Promise.allSettled([loadOverviewStats(), loadRecentActivity()]);
}

function normalizeStatusCounts(byStatus) {
    const counts = { active: 0, pending: 0, completed: 0, onhold: 0, cancelled: 0 };
    (byStatus || []).forEach((row) => {
        const status = String(row.status || '').toLowerCase();
        const count = Number(row.count) || 0;
        if (status === 'active' || status === 'planning') counts.active += count;
        else if (status === 'completed') counts.completed += count;
        else if (status === 'pending plan') counts.pending += count;
        else if (status === 'on hold') counts.onhold += count;
        else if (status === 'cancelled') counts.cancelled += count;
    });
    return counts;
}

async function loadOverviewStats() {
    const totalEl = document.getElementById('metricTotalCustomers');
    const activeEl = document.getElementById('statActive');
    const pendingEl = document.getElementById('statPending');
    const completedEl = document.getElementById('statCompleted');
    const onHoldEl = document.getElementById('statOnHold');
    const cancelledEl = document.getElementById('statCancelled');
    if (!totalEl) return;

    try {
        const res = await fetch(`${API_BASE}/dashboard/overview`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        totalEl.textContent = String(data.totalCustomers ?? '—');
        if (activeEl) activeEl.textContent = String(data.active ?? 0);
        if (pendingEl) pendingEl.textContent = String(data.pending ?? 0);
        if (completedEl) completedEl.textContent = String(data.completed ?? 0);
        if (onHoldEl) onHoldEl.textContent = String(data.onhold ?? 0);
        if (cancelledEl) cancelledEl.textContent = String(data.cancelled ?? 0);
        updateStatusPieChart(data);
    } catch (_) {
        totalEl.textContent = '—';
    }
}

function updateStatusPieChart(data) {
    const canvas = document.getElementById('statusPieChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = ['Active', 'Pending', 'Completed', 'On Hold', 'Cancelled'];
    const values = [
        Number(data.active) || 0,
        Number(data.pending) || 0,
        Number(data.completed) || 0,
        Number(data.onhold) || 0,
        Number(data.cancelled) || 0
    ];
    const colors = ['#3b82f6', '#eab308', '#22c55e', '#71717a', '#ef4444'];

    if (statusPieChart) {
        statusPieChart.destroy();
        statusPieChart = null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) {
        statusPieChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['No data yet'],
                datasets: [{ data: [1], backgroundColor: ['#3f3f46'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: chartPluginTheme.legend,
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    statusPieChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#141417'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: chartPluginTheme
        }
    });
}

async function deleteAllActivityHistory() {
    if (!confirm('Delete all activity history? This cannot be undone. Customer records are not removed.')) return;
    try {
        const res = await fetch(`${API_BASE}/interactions/history`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        await loadRecentActivity();
    } catch (e) {
        alert(e.message || 'Could not delete history');
    }
}

function formatSystemActivity(r) {
    const desc = String(r.description || '');
    if (desc === 'SYSTEM|CUSTOMER_CREATED') return { title: 'Customer created', detail: '' };
    if (desc === 'SYSTEM|GOAL_PLAN_CREATED') return { title: 'Goal plan created', detail: '' };
    if (desc === 'SYSTEM|GOAL_PLAN_FINALIZED') return { title: 'Goal plan finalized', detail: '' };
    if (desc.startsWith('SYSTEM|STEP_ADDED|title=')) {
        return { title: 'Goal step added', detail: desc.replace('SYSTEM|STEP_ADDED|title=', '') };
    }
    if (desc.startsWith('SYSTEM|STEP_DELETED|title=')) {
        return { title: 'Goal step deleted', detail: desc.replace('SYSTEM|STEP_DELETED|title=', '') };
    }
    if (desc.startsWith('SYSTEM|STEP_TOGGLED|')) {
        const titleMatch = desc.match(/title=([^|]*)/);
        const compMatch = desc.match(/completed=([01])/);
        const title = titleMatch ? titleMatch[1] : 'Step';
        const completed = compMatch ? compMatch[1] === '1' : false;
        return { title: completed ? 'Goal step completed' : 'Goal step uncompleted', detail: title };
    }
    if (desc.startsWith('SYSTEM|STATUS_CHANGE|')) {
        const fromMatch = desc.match(/\|from=([^|]*)\|to=/);
        const toMatch = desc.match(/\|to=([^|]*)$/);
        const from = fromMatch ? fromMatch[1] : '';
        const to = toMatch ? toMatch[1] : '';
        return { title: 'Status changed', detail: `${from} → ${to}`.trim() };
    }
    return { title: r.subject || r.interaction_type || 'Activity', detail: r.description || '' };
}

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

async function loadRecentActivity() {
    const wrap = document.getElementById('recentActivity');
    if (!wrap) return;
    try {
        const res = await fetch(`${API_BASE}/interactions/recent?limit=10`);
        if (!res.ok) throw new Error('Failed');
        const rows = await res.json();
        if (!rows.length) {
            wrap.innerHTML = '<div class="muted">No activity yet. Creating customers and changing statuses will show up here.</div>';
            return;
        }
        wrap.innerHTML = rows.map((r) => `
            <div class="activity-item" onclick="showCustomerDetail(${r.customer_id});">
                <div class="top">
                    <div class="company">${escapeHtml(r.company_name || 'Customer')}</div>
                    <div class="time">${r.interaction_date ? new Date(r.interaction_date).toLocaleString() : ''}</div>
                </div>
                <div class="meta">${escapeHtml(formatSystemActivity(r).title)}</div>
                <div class="muted" style="margin-top: 4px;">
                    ${escapeHtml((r.actor_username || r.employee_name || 'unknown'))} • ${r.interaction_date ? timeAgo(r.interaction_date) : ''}
                </div>
                <div class="subject">${escapeHtml((formatSystemActivity(r).detail || '—')).slice(0, 90)}${(formatSystemActivity(r).detail || '').length > 90 ? '…' : ''}</div>
                ${(Number(r.can_undo) === 1 || String(r.description || '').startsWith('SYSTEM|STATUS_CHANGE|')) ? `
                    <div style="margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="event.stopPropagation(); undoActivity(${r.id});">Undo</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (_) {
        wrap.innerHTML = '<div class="muted">Could not load activity.</div>';
    }
}

async function undoActivity(interactionId) {
    try {
        const res = await fetch(`${API_BASE}/interactions/${interactionId}/undo`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        await refreshSidebar();

        // Refresh current tab lists so the record moves if needed
        if (currentTab === 'pending') {
            await loadPendingCustomers();
        } else {
            await loadCustomersForTab(currentTab);
        }
    } catch (e) {
        alert(e.message || 'Could not undo activity');
    }
}

async function deleteCustomer(customerId) {
    if (!confirm('Delete this record permanently? This cannot be undone.')) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        await refreshSidebar();
        if (currentTab === 'pending') await loadPendingCustomers();
        else await loadCustomersForTab(currentTab);
    } catch (e) {
        alert(e.message || 'Could not delete record');
    }
}

function renderPendingCustomers() {
    const tbody = document.getElementById('pendingTableBody');
    if (!tbody) return;
    const list = filteredPendingCustomers;
    if (list.length === 0) {
        const msg =
            pendingCustomers.length === 0
                ? 'No pending customers.'
                : 'No rows match your filters or command search.';
        tbody.innerHTML = `<tr><td colspan="6" class="loading">${msg}</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(c => `
        <tr oncontextmenu="openRowContextMenu(event, ${c.id}, '${escapeHtml(c.status || '')}')">
            <td><strong>${escapeHtml(c.company_name)}</strong></td>
            <td>${escapeHtml(c.contact_name || 'N/A')}</td>
            <td>${escapeHtml(c.service_category_name || 'Uncategorized')}</td>
            <td><span class="priority-badge priority-${(c.priority || 'medium').toLowerCase()}">${c.priority}</span></td>
            <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</td>
            <td><button class="btn btn-primary" onclick="showCustomerDetail(${c.id}); event.stopPropagation();">Set up goal plan</button></td>
        </tr>
    `).join('');
}

// Render customers table
function renderCustomers() {
    const tbody = document.getElementById('customersTableBody');
    
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No customers found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredCustomers.map(customer => {
        const statusClass = (customer.status || '').toLowerCase().replace(' ', '');
        const priorityClass = (customer.priority || '').toLowerCase();
        const lastContact = customer.last_contact_date 
            ? new Date(customer.last_contact_date).toLocaleDateString()
            : 'Never';
        const progress = customer.progress_pct != null ? customer.progress_pct : 0;

        return `
            <tr onclick="showCustomerDetail(${customer.id})" oncontextmenu="openRowContextMenu(event, ${customer.id}, '${escapeHtml(customer.status || '')}')" onmouseenter="expandRow(this)" onmouseleave="collapseRow(this)">
                <td>
                    <strong>${escapeHtml(customer.company_name)}</strong>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span>' : ''}
                </td>
                <td>${escapeHtml(customer.contact_name || 'N/A')}</td>
                <td>${escapeHtml(customer.service_category_name || 'Uncategorized')}</td>
                <td>
                    <div class="progress-bar-wrap" title="${progress}%"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                    <span class="progress-pct">${progress}%</span>
                </td>
                <td>
                    <span class="status-badge status-${statusClass}">
                        ${customer.status}
                    </span>
                </td>
                <td>
                    <span class="priority-badge priority-${priorityClass}">
                        ${customer.priority}
                    </span>
                </td>
                <td>${customer.years_known || 0} years</td>
                <td>
                    ${customer.employee_names 
                        ? customer.employee_names.split(', ').slice(0, 2).join(', ') + 
                          (customer.employee_names.split(', ').length > 2 ? '...' : '')
                        : 'None'}
                </td>
                <td>
                    ${lastContact}
                    <div class="expanded-details">
                    <div class="expanded-details-grid">
                        <div class="expanded-details-item">
                            <h4>Contact Information</h4>
                            <p><strong>Email:</strong> ${escapeHtml(customer.email || 'N/A')}</p>
                            <p><strong>Phone:</strong> ${escapeHtml(customer.phone || 'N/A')}</p>
                            ${customer.website ? `<p><strong>Website:</strong> ${escapeHtml(customer.website)}</p>` : ''}
                        </div>
                        <div class="expanded-details-item">
                            <h4>Location</h4>
                            ${customer.city ? `<p><strong>City:</strong> ${escapeHtml(customer.city)}</p>` : ''}
                            ${customer.state ? `<p><strong>State:</strong> ${escapeHtml(customer.state)}</p>` : ''}
                            ${customer.country ? `<p><strong>Country:</strong> ${escapeHtml(customer.country)}</p>` : ''}
                        </div>
                        <div class="expanded-details-item">
                            <h4>Relationship</h4>
                            <p><strong>First Contact:</strong> ${customer.first_contact_date 
                                ? new Date(customer.first_contact_date).toLocaleDateString()
                                : 'N/A'}</p>
                            <p><strong>Years Known:</strong> ${customer.years_known || 0}</p>
                            <p><strong>Employee Count:</strong> ${customer.employee_count || 0}</p>
                        </div>
                        ${customer.notes ? `
                        <div class="expanded-details-item">
                            <h4>Notes</h4>
                            <p>${escapeHtml(customer.notes.substring(0, 200))}${customer.notes.length > 200 ? '...' : ''}</p>
                        </div>
                        ` : ''}
                    </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function wireContextMenu() {
    const menu = document.getElementById('rowContextMenu');
    if (!menu) return;

    // Handle clicks on menu items
    menu.addEventListener('click', async (e) => {
        const btn = e.target.closest('.context-menu-item');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (!contextCustomerId) return;

        const selectedCustomerId = contextCustomerId;

        let status = null;
        if (action === 'cancelled') status = 'Cancelled';
        if (action === 'pending') status = 'Pending Plan';
        if (action === 'onhold') status = 'On Hold';
        if (action === 'delete') {
            hideContextMenu();
            await deleteCustomer(selectedCustomerId);
            return;
        }

        hideContextMenu();
        if (!status) return;
        await updateCustomerStatus(contextCustomerId, status, { silent: true });
    });

    // Close menu on outside click / scroll / resize / escape
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('scroll', hideContextMenu, true);
    window.addEventListener('resize', hideContextMenu);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideContextMenu();
    });
}

function openRowContextMenu(event, customerId) {
    event.preventDefault();
    event.stopPropagation();
    contextCustomerId = customerId;
    contextRowEl = event.currentTarget || null;
    if (contextRowEl) contextRowEl.classList.add('expanded');

    const menu = document.getElementById('rowContextMenu');
    if (!menu) return;

    const delBtn = menu.querySelector('[data-action="delete"]');
    if (delBtn) {
        delBtn.style.display = (currentTab === 'cancelled' || currentTab === 'completed') ? 'block' : 'none';
    }

    const padding = 10;
    const { clientX: x, clientY: y } = event;

    menu.style.display = 'block';
    menu.style.left = '0px';
    menu.style.top = '0px';

    // measure after display
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width + padding > window.innerWidth) left = window.innerWidth - rect.width - padding;
    if (top + rect.height + padding > window.innerHeight) top = window.innerHeight - rect.height - padding;

    menu.style.left = `${Math.max(padding, left)}px`;
    menu.style.top = `${Math.max(padding, top)}px`;
}

function hideContextMenu() {
    const menu = document.getElementById('rowContextMenu');
    if (!menu) return;
    menu.style.display = 'none';
    contextCustomerId = null;
    if (contextRowEl) contextRowEl.classList.remove('expanded');
    contextRowEl = null;
}

// Expand row on hover
function expandRow(row) {
    row.classList.add('expanded');
}

// Collapse row on mouse leave
function collapseRow(row) {
    const menu = document.getElementById('rowContextMenu');
    const menuOpen = menu && menu.style.display === 'block';
    if (menuOpen && contextRowEl === row) return;
    row.classList.remove('expanded');
}

function renderPendingGoalPlan(customerId, goalPlan, steps) {
    if (!goalPlan) {
        return `
            <div class="customer-detail-section goal-plan-section">
                <h3>Goal plan</h3>
                <p>Create a goal plan with steps. Once finalized, this customer will appear in the main table and progress will track completed steps.</p>
                <button type="button" class="btn btn-primary" onclick="createGoalPlan(${customerId})">Create goal plan</button>
            </div>
        `;
    }
    const stepsList = steps.length
        ? `<ul class="goal-steps-list">${steps.map(s => `
            <li class="goal-step-item ${s.is_completed ? 'completed' : ''}" data-step-id="${s.id}">
                <input type="checkbox" ${s.is_completed ? 'checked' : ''} onchange="toggleStepComplete(${customerId}, ${s.id}, this.checked)" />
                <div>
                    <div class="step-title">${escapeHtml(s.title)}</div>
                    ${s.description ? `<div class="step-desc">${escapeHtml(s.description)}</div>` : ''}
                </div>
                <button type="button" class="step-delete" onclick="event.stopPropagation(); deleteStep(${customerId}, ${s.id})">Delete</button>
            </li>
        `).join('')}</ul>`
        : '<p>Add at least one step, then finalize.</p>';
    return `
        <div class="customer-detail-section goal-plan-section">
            <h3>Goal plan (draft)</h3>
            ${stepsList}
            <div class="add-step-form">
                <input type="text" id="newStepTitle" placeholder="Step title" />
                <input type="text" id="newStepDesc" placeholder="Description (optional)" />
                <button type="button" class="btn btn-primary" onclick="addStep(${customerId})">Add step</button>
            </div>
            <div style="margin-top: 12px;">
                <button type="button" class="btn btn-primary" onclick="finalizePlan(${customerId})">Finalize plan (move to main table)</button>
            </div>
        </div>
    `;
}

function renderMainGoalPlan(customerId, steps, progressPct) {
    const stepsList = steps.length
        ? `<ul class="goal-steps-list">${steps.map(s => `
            <li class="goal-step-item ${s.is_completed ? 'completed' : ''}" data-step-id="${s.id}">
                <input type="checkbox" ${s.is_completed ? 'checked' : ''} onchange="toggleStepComplete(${customerId}, ${s.id}, this.checked)" />
                <div>
                    <div class="step-title">${escapeHtml(s.title)}</div>
                    ${s.description ? `<div class="step-desc">${escapeHtml(s.description)}</div>` : ''}
                </div>
                <button type="button" class="step-delete" onclick="event.stopPropagation(); deleteStep(${customerId}, ${s.id})">Delete</button>
            </li>
        `).join('')}</ul>`
        : '<p>No steps.</p>';
    return `
        <div class="customer-detail-section goal-plan-section">
            <h3>Goal plan & progress</h3>
            <div class="progress-bar-wrap" style="max-width: 100%; margin-bottom: 12px;" title="${progressPct}%">
                <div class="progress-bar-fill" style="width:${progressPct}%"></div>
            </div>
            <p><strong>${progressPct}%</strong> complete (steps completed / total)</p>
            ${stepsList}
            <div class="add-step-form">
                <input type="text" id="newStepTitle" placeholder="Step title" />
                <input type="text" id="newStepDesc" placeholder="Description (optional)" />
                <button type="button" class="btn btn-primary" onclick="addStep(${customerId})">Add step</button>
            </div>
        </div>
    `;
}

async function createGoalPlan(customerId) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
    } catch (e) {
        alert(e.message || 'Could not create goal plan');
    }
}

async function addStep(customerId) {
    const titleEl = document.getElementById('newStepTitle');
    const descEl = document.getElementById('newStepDesc');
    const title = titleEl && titleEl.value.trim();
    if (!title) {
        alert('Enter a step title');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: (descEl && descEl.value.trim()) || null })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not add step');
    }
}

async function toggleStepComplete(customerId, stepId, checked) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps/${stepId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: !!checked })
        });
        if (!res.ok) throw new Error('Failed to update step');
        await showCustomerDetail(customerId);
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not update step');
    }
}

async function deleteStep(customerId, stepId) {
    if (!confirm('Delete this step?')) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/steps/${stepId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete step');
        await showCustomerDetail(customerId);
        await loadPendingCustomers();
        await loadCustomers();
    } catch (e) {
        alert(e.message || 'Could not delete step');
    }
}

async function finalizePlan(customerId) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}/goal-plan/finalize`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to finalize');
        closeCustomerDetail();
        await loadPendingCustomers();
        await loadCustomers();
        alert('Goal plan finalized. Customer is now in the main table.');
    } catch (e) {
        alert(e.message || 'Could not finalize plan');
    }
}

async function updateCustomerStatus(customerId, status, opts = {}) {
    try {
        const res = await fetch(`${API_BASE}/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update status');

        // If modal is open for this customer, refresh it
        const modalOpen = document.getElementById('customerDetailModal')?.style?.display === 'block';
        if (modalOpen) {
            await showCustomerDetail(customerId);
        }

        // Refresh current tab
        if (currentTab === 'pending') {
            await loadPendingCustomers();
        } else {
            await loadCustomersForTab(currentTab);
        }
        await refreshSidebar();

        if (!opts.silent) {
            // eslint-disable-next-line no-alert
            alert('Status updated');
        }
    } catch (e) {
        alert(e.message || 'Could not update status');
    }
}

const COMMAND_OPS = new Set(['contains', 'starts', 'ends', 'regex', 'same', '=', '!=', '>', '<', '>=', '<=']);

function runTableFilters() {
    if (typeof window.CrmSearchCommands === 'undefined') {
        filteredCustomers = [...allCustomers];
        filteredPendingCustomers = [...pendingCustomers];
        if (currentTab === 'pending') renderPendingCustomers();
        else renderCustomers();
        return;
    }
    if (currentTab === 'pending') {
        const schema = window.CrmSearchCommands.getSearchSchemaForTab('pending');
        const qEl = document.getElementById('commandSearchInput');
        const query = qEl ? qEl.value : '';
        const parsed = window.CrmSearchCommands.parseSearchQuery(query, schema);
        filteredPendingCustomers = pendingCustomers.filter((r) =>
            window.CrmSearchCommands.rowMatchesCommands(r, parsed, schema)
        );
        renderPendingCustomers();
    } else {
        filterCustomers();
    }
}

// Filter customers (status / priority dropdowns + command search)
function filterCustomers() {
    const statusEl = document.getElementById('filterStatus');
    const priorityEl = document.getElementById('filterPriority');
    const cmdEl = document.getElementById('commandSearchInput');
    const statusFilter = (statusEl && statusEl.value) ? statusEl.value.toLowerCase() : '';
    const priorityFilter = (priorityEl && priorityEl.value) ? priorityEl.value.toLowerCase() : '';
    const query = cmdEl ? cmdEl.value : '';

    const schema = window.CrmSearchCommands.getSearchSchemaForTab(currentTab);
    const parsed = window.CrmSearchCommands.parseSearchQuery(query, schema);

    filteredCustomers = allCustomers.filter((customer) => {
        const matchesStatus = !statusFilter || (customer.status && customer.status.toLowerCase() === statusFilter);
        const matchesPriority = !priorityFilter || (customer.priority && customer.priority.toLowerCase() === priorityFilter);
        if (!(matchesStatus && matchesPriority)) return false;
        return window.CrmSearchCommands.rowMatchesCommands(customer, parsed, schema);
    });

    renderCustomers();
}

function getCommandClauseBounds(str, cursor) {
    let clauseStart = 0;
    let quote = null;
    const pos = Math.min(Math.max(0, cursor), str.length);
    for (let i = 0; i < pos; i++) {
        const c = str[i];
        if (quote) {
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            continue;
        }
        if (c === ',') clauseStart = i + 1;
    }
    let clauseEnd = str.length;
    quote = null;
    for (let i = cursor; i < str.length; i++) {
        const c = str[i];
        if (quote) {
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            continue;
        }
        if (c === ',') {
            clauseEnd = i;
            break;
        }
    }
    return { clauseStart, clauseEnd };
}

function buildValueSuggestions(field, value, valueAbsStart, cursor, schema) {
    const out = [];
    const prefix = value;
    if (field && field.suggest) {
        window.CrmSearchCommands.getValueSuggestions(field, prefix).forEach((v) => {
            out.push({
                label: v.label,
                insert: v.insert,
                kind: 'value',
                replaceStart: valueAbsStart,
                replaceEnd: cursor
            });
        });
    }
    if (prefix === '' || prefix.startsWith('@')) {
        const refP = prefix.startsWith('@') ? prefix.slice(1) : prefix;
        window.CrmSearchCommands.getColumnSuggestions(refP, schema).forEach((c) => {
            out.push({
                label: `@${c.insert}`,
                insert: `@${c.insert} `,
                kind: 'ref',
                replaceStart: valueAbsStart,
                replaceEnd: cursor
            });
        });
    }
    return out.slice(0, 14);
}

function buildCommandSuggestions(value, cursor, schema) {
    const { clauseStart, clauseEnd } = getCommandClauseBounds(value, cursor);
    const clause = value.slice(clauseStart, clauseEnd);
    const inner = Math.min(Math.max(0, cursor - clauseStart), clause.length);
    const before = clause.slice(0, inner);
    const ci = before.indexOf(':');

    if (ci === -1) {
        const trimmed = before.trimEnd();
        const lastSp = trimmed.lastIndexOf(' ');
        const wordStartInClause = lastSp === -1 ? 0 : lastSp + 1;
        const prefix = trimmed.slice(wordStartInClause);
        const replaceStart = clauseStart + wordStartInClause;
        const replaceEnd = cursor;
        return window.CrmSearchCommands.getColumnSuggestions(prefix, schema).map((c) => ({
            label: c.label,
            insert: `${c.insert}: `,
            kind: 'column',
            replaceStart,
            replaceEnd
        }));
    }

    const lhs = before.slice(0, ci).trimEnd();
    const rhs = before.slice(ci + 1);
    const field = window.CrmSearchCommands.resolveColumnKey(lhs, schema);
    const rhsTrim = rhs.trimStart();
    const leadSkip = rhs.length - rhsTrim.length;
    const opStartAbs = clauseStart + ci + 1 + leadSkip;

    if (rhsTrim.length === 0) {
        return window.CrmSearchCommands.getOperatorSuggestions().map((o) => ({
            label: o.label,
            insert: o.insert,
            kind: 'operator',
            replaceStart: cursor,
            replaceEnd: cursor
        }));
    }

    const opMatch = rhsTrim.match(/^(\S+)/);
    const firstTok = opMatch ? opMatch[1] : '';
    const opLen = firstTok.length;
    const isOp = COMMAND_OPS.has(firstTok.toLowerCase());

    if (isOp) {
        const posAfterOpInBefore = ci + 1 + leadSkip + opLen;
        if (inner <= posAfterOpInBefore) {
            const pref = firstTok.toLowerCase();
            let ops = window.CrmSearchCommands.getOperatorSuggestions().filter(
                (o) => !pref || o.label.toLowerCase().startsWith(pref)
            );
            if (ops.length === 0) ops = window.CrmSearchCommands.getOperatorSuggestions();
            return ops.map((o) => ({
                label: o.label,
                insert: o.insert,
                kind: 'operator',
                replaceStart: opStartAbs,
                replaceEnd: cursor
            }));
        }
        const afterOp = rhsTrim.slice(opLen);
        const valLead = afterOp.length - afterOp.trimStart().length;
        const valueAbsStart = opStartAbs + opLen + valLead;
        const valuePrefix = value.slice(valueAbsStart, cursor);
        return buildValueSuggestions(field, valuePrefix, valueAbsStart, cursor, schema);
    }

    const valueAbsStart = opStartAbs;
    const valuePrefix = value.slice(valueAbsStart, cursor);
    return buildValueSuggestions(field, valuePrefix, valueAbsStart, cursor, schema);
}

function hideCommandSuggest() {
    const ul = document.getElementById('commandSearchSuggest');
    if (!ul) return;
    ul.hidden = true;
    ul.innerHTML = '';
    commandSuggestItems = [];
    commandSuggestSelected = -1;
}

function renderCommandSuggestList(items) {
    const ul = document.getElementById('commandSearchSuggest');
    if (!ul) return;
    commandSuggestItems = items;
    commandSuggestSelected = items.length ? 0 : -1;
    if (!items.length) {
        ul.hidden = true;
        ul.innerHTML = '';
        return;
    }
    ul.hidden = false;
    ul.innerHTML = items
        .map(
            (it, i) =>
                `<li role="option" data-idx="${i}" aria-selected="${i === 0}">${escapeHtml(it.label)}<span class="suggest-kind">${escapeHtml(it.kind)}</span></li>`
        )
        .join('');
    ul.querySelectorAll('li').forEach((li) => {
        li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = Number(li.getAttribute('data-idx'));
            applyCommandSuggestion(idx);
        });
    });
}

function updateCommandSuggestHighlight() {
    const ul = document.getElementById('commandSearchSuggest');
    if (!ul) return;
    ul.querySelectorAll('li').forEach((li, i) => {
        const sel = i === commandSuggestSelected;
        li.setAttribute('aria-selected', String(sel));
        if (sel) li.scrollIntoView({ block: 'nearest' });
    });
}

function applyCommandSuggestion(index) {
    const input = document.getElementById('commandSearchInput');
    if (!input || index < 0 || index >= commandSuggestItems.length) return;
    const it = commandSuggestItems[index];
    const v = input.value;
    const newV = v.slice(0, it.replaceStart) + it.insert + v.slice(it.replaceEnd);
    input.value = newV;
    const pos = it.replaceStart + it.insert.length;
    input.setSelectionRange(pos, pos);
    hideCommandSuggest();
    runTableFilters();
    input.focus();
}

function updateCommandSuggestions() {
    const input = document.getElementById('commandSearchInput');
    if (!input || typeof window.CrmSearchCommands === 'undefined') return;
    const schema = window.CrmSearchCommands.getSearchSchemaForTab(currentTab);
    const items = buildCommandSuggestions(input.value, input.selectionStart ?? input.value.length, schema);
    renderCommandSuggestList(items);
}

function wireCommandSearch() {
    const input = document.getElementById('commandSearchInput');
    const ul = document.getElementById('commandSearchSuggest');
    if (!input) return;

    input.addEventListener('input', () => {
        runTableFilters();
        updateCommandSuggestions();
    });

    input.addEventListener('click', () => updateCommandSuggestions());
    input.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) return;
        updateCommandSuggestions();
    });

    input.addEventListener('keydown', (e) => {
        if (!ul || ul.hidden || commandSuggestItems.length === 0) {
            if (e.key === 'Escape') hideCommandSuggest();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            commandSuggestSelected = Math.min(commandSuggestItems.length - 1, commandSuggestSelected + 1);
            updateCommandSuggestHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            commandSuggestSelected = Math.max(0, commandSuggestSelected - 1);
            updateCommandSuggestHighlight();
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            applyCommandSuggestion(commandSuggestSelected >= 0 ? commandSuggestSelected : 0);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideCommandSuggest();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && (!ul || !ul.contains(e.target))) hideCommandSuggest();
    });
}

// Show customer detail modal (works for both main and pending customers)
async function showCustomerDetail(customerId) {
    try {
        const modal = document.getElementById('customerDetailModal');
        const content = document.getElementById('customerDetailContent');
        
        content.innerHTML = '<div class="loading">Loading customer details...</div>';
        modal.style.display = 'block';

        const customerResponse = await fetch(`${API_BASE}/customers/${customerId}`);
        if (!customerResponse.ok) {
            content.innerHTML = '<div class="loading">Customer not found.</div>';
            return;
        }
        const customer = await customerResponse.json();

        let stats = { interactionTypes: [], monthlyTrend: [], employeeInvolvement: [] };
        try {
            const statsResponse = await fetch(`${API_BASE}/customers/${customerId}/statistics`);
            if (statsResponse.ok) stats = await statsResponse.json();
        } catch (_) {}

        const isPending = !customer.goal_plan || !customer.goal_plan.finalized_at;
        const goalPlan = customer.goal_plan;
        const steps = customer.goal_steps || [];
        const progressPct = customer.progress_pct != null ? customer.progress_pct : 0;

        const goalPlanHtml = isPending
            ? renderPendingGoalPlan(customerId, goalPlan, steps)
            : renderMainGoalPlan(customerId, steps, progressPct);

        const statusUpdateHtml = `
            <div class="customer-detail-section status-update-row-wrap">
                <h3>Update record</h3>
                <div class="status-update-row">
                    <label>Status:</label>
                    <select id="detailStatusSelect" onchange="updateCustomerStatus(${customerId}, this.value)">
                        <option value="Pending Plan" ${customer.status === 'Pending Plan' ? 'selected' : ''}>Pending Plan</option>
                        <option value="Planning" ${customer.status === 'Planning' ? 'selected' : ''}>Planning</option>
                        <option value="Active" ${customer.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="On Hold" ${customer.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                        <option value="Completed" ${customer.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${customer.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
        `;

        // Render customer detail page
        content.innerHTML = `
            <div class="customer-detail-header">
                <h2>${escapeHtml(customer.company_name)}</h2>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <span class="status-badge status-${(customer.status || '').toLowerCase().replace(' ', '')}">
                        ${customer.status}
                    </span>
                    <span class="priority-badge priority-${(customer.priority || '').toLowerCase()}">
                        ${customer.priority}
                    </span>
                    ${customer.status === 'Planning' ? '<span class="status-icon planning"></span> <span>Planning in progress</span>' : ''}
                </div>
            </div>

            ${goalPlanHtml}
            ${statusUpdateHtml}

            <div class="customer-detail-section">
                <h3>Company Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Company Name</label>
                        <div class="value">${escapeHtml(customer.company_name)}</div>
                    </div>
                    <div class="detail-item">
                        <label>Contact Name</label>
                        <div class="value">${escapeHtml(customer.contact_name || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Email</label>
                        <div class="value">${escapeHtml(customer.email || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Phone</label>
                        <div class="value">${escapeHtml(customer.phone || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <label>Website</label>
                        <div class="value">${customer.website ? `<a href="${escapeHtml(customer.website)}" target="_blank">${escapeHtml(customer.website)}</a>` : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <label>Service Category</label>
                        <div class="value">${escapeHtml(customer.service_category_name || 'Uncategorized')}</div>
                    </div>
                    <div class="detail-item">
                        <label>First Contact Date</label>
                        <div class="value">${customer.first_contact_date 
                            ? new Date(customer.first_contact_date).toLocaleDateString()
                            : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <label>Years Known</label>
                        <div class="value">${customer.years_known || 0} years</div>
                    </div>
                </div>
                ${customer.address ? `
                <div class="detail-item" style="margin-top: 15px;">
                    <label>Address</label>
                    <div class="value">${escapeHtml(customer.address)}${customer.city ? ', ' + escapeHtml(customer.city) : ''}${customer.state ? ', ' + escapeHtml(customer.state) : ''} ${customer.zip_code || ''}</div>
                </div>
                ` : ''}
                ${customer.notes ? `
                <div class="detail-item" style="margin-top: 15px;">
                    <label>Notes</label>
                    <div class="value">${escapeHtml(customer.notes)}</div>
                </div>
                ` : ''}
            </div>

            ${customer.employees && customer.employees.length > 0 ? `
            <div class="customer-detail-section">
                <h3>Assigned Employees (${customer.employees.length})</h3>
                <div class="employees-list">
                    ${customer.employees.map(emp => `
                        <div class="employee-badge">
                            ${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}
                            ${emp.role ? ` - ${escapeHtml(emp.role)}` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="customer-detail-section">
                <h3>Statistics & Analytics</h3>
                <div class="charts-container">
                    ${stats.interactionTypes && stats.interactionTypes.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Interaction Types</h4>
                        <canvas id="interactionTypesChart"></canvas>
                    </div>
                    ` : ''}
                    ${stats.monthlyTrend && stats.monthlyTrend.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Monthly Interaction Trend</h4>
                        <canvas id="monthlyTrendChart"></canvas>
                    </div>
                    ` : ''}
                    ${stats.employeeInvolvement && stats.employeeInvolvement.length > 0 ? `
                    <div class="chart-wrapper">
                        <h4>Employee Involvement</h4>
                        <canvas id="employeeInvolvementChart"></canvas>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${customer.interactions && customer.interactions.length > 0 ? `
            <div class="customer-detail-section">
                <h3>Recent Interactions (${customer.interactions.length})</h3>
                <div class="interactions-list">
                    ${customer.interactions.map(interaction => `
                        <div class="interaction-item">
                            <h4>${escapeHtml(interaction.interaction_type)} - ${escapeHtml(interaction.subject || 'No Subject')}</h4>
                            <p>${escapeHtml(interaction.description || 'No description')}</p>
                            <div class="meta">
                                ${interaction.employee_name ? `By: ${escapeHtml(interaction.employee_name)} | ` : ''}
                                ${new Date(interaction.interaction_date).toLocaleString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : '<div class="customer-detail-section"><p>No interactions recorded yet.</p></div>'}
        `;

        // Render charts
        setTimeout(() => {
            renderCharts(stats);
        }, 100);

    } catch (error) {
        console.error('Error loading customer detail:', error);
        document.getElementById('customerDetailContent').innerHTML = 
            '<div class="loading">Error loading customer details</div>';
    }
}

// Render charts
function renderCharts(stats) {
    // Destroy existing charts
    charts.forEach(chart => chart.destroy());
    charts = [];

    // Interaction Types Pie Chart
    if (stats.interactionTypes && stats.interactionTypes.length > 0) {
        const ctx1 = document.getElementById('interactionTypesChart');
        if (ctx1) {
            const chart1 = new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: stats.interactionTypes.map(item => item.interaction_type),
                    datasets: [{
                        data: stats.interactionTypes.map(item => item.count),
                        backgroundColor: [
                            '#3b82f6',
                            '#22c55e',
                            '#eab308',
                            '#a855f7',
                            '#f97316',
                            '#71717a'
                        ],
                        borderColor: '#141417',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: chartPluginTheme
                }
            });
            charts.push(chart1);
        }
    }

    // Monthly Trend Line Chart
    if (stats.monthlyTrend && stats.monthlyTrend.length > 0) {
        const ctx2 = document.getElementById('monthlyTrendChart');
        if (ctx2) {
            const chart2 = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: stats.monthlyTrend.map(item => item.month),
                    datasets: [{
                        label: 'Interactions',
                        data: stats.monthlyTrend.map(item => item.count),
                        borderColor: '#e4e4e7',
                        backgroundColor: 'rgba(228, 228, 231, 0.08)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: chartPluginTheme,
                    scales: {
                        x: {
                            ticks: { color: CHART_TEXT },
                            grid: { color: CHART_GRID }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: CHART_TEXT },
                            grid: { color: CHART_GRID }
                        }
                    }
                }
            });
            charts.push(chart2);
        }
    }

    // Employee Involvement Bar Chart
    if (stats.employeeInvolvement && stats.employeeInvolvement.length > 0) {
        const ctx3 = document.getElementById('employeeInvolvementChart');
        if (ctx3) {
            const chart3 = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: stats.employeeInvolvement.map(item => item.employee_name),
                    datasets: [{
                        label: 'Interactions',
                        data: stats.employeeInvolvement.map(item => item.interaction_count),
                        backgroundColor: '#52525b',
                        borderColor: '#71717a',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: chartPluginTheme,
                    scales: {
                        x: {
                            ticks: { color: CHART_TEXT },
                            grid: { color: CHART_GRID }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: CHART_TEXT },
                            grid: { color: CHART_GRID }
                        }
                    }
                }
            });
            charts.push(chart3);
        }
    }
}

// Close customer detail modal
function closeCustomerDetail() {
    document.getElementById('customerDetailModal').style.display = 'none';
    charts.forEach(chart => chart.destroy());
    charts = [];
}

// Close modal when clicking outside
window.onclick = function(event) {
    const customerModal = document.getElementById('customerDetailModal');
    const addModal = document.getElementById('addCustomerModal');
    if (event.target === customerModal) {
        closeCustomerDetail();
    }
    if (event.target === addModal) {
        closeAddCustomerModal();
    }
}

// Show add customer modal
function showAddCustomerModal() {
    document.getElementById('addCustomerModal').style.display = 'block';
}

// Close add customer modal
function closeAddCustomerModal() {
    document.getElementById('addCustomerModal').style.display = 'none';
    document.getElementById('addCustomerForm').reset();
}

// Add new customer
async function addCustomer(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // Convert empty strings to null
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            data[key] = null;
        }
    });

    try {
        const response = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeAddCustomerModal();
            // New customers start as Pending Plan
            await switchTab('pending');
            await refreshSidebar();
            alert('Customer added successfully!');
        } else {
            const error = await response.json();
            alert('Error adding customer: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Error adding customer. Please try again.');
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
