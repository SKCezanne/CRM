import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const cardStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  card: {
    borderRadius: "14px",
    padding: "14px 14px 12px 14px",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,64,175,0.9))",
    border: "1px solid rgba(129,140,248,0.7)",
    boxShadow: "0 18px 45px rgba(37,99,235,0.65)",
  },
  cardMuted: {
    background:
      "radial-gradient(circle at top left, rgba(15,23,42,0.96), rgba(15,23,42,0.92))",
    border: "1px solid rgba(148,163,184,0.6)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.85)",
  },
  cardLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#9ca3af",
    marginBottom: "4px",
  },
  cardNumber: {
    fontSize: "24px",
    fontWeight: 600,
    marginBottom: "2px",
  },
  cardHint: {
    fontSize: "11px",
    color: "#9ca3af",
  },
};

const tableStyles = {
  wrapper: {
    borderRadius: "14px",
    border: "1px solid rgba(148,163,184,0.5)",
    backgroundColor: "rgba(15,23,42,0.95)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid rgba(55,65,81,0.8)",
    background:
      "linear-gradient(120deg, rgba(15,23,42,0.98), rgba(17,24,39,0.98))",
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: 500,
  },
  headerSub: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  pill: {
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.6)",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
  },
  filterSelect: {
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.6)",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    color: "#9ca3af",
    backgroundColor: "rgba(15,23,42,0.98)",
    borderBottom: "1px solid rgba(55,65,81,0.9)",
    fontWeight: 500,
  },
  td: {
    padding: "9px 14px",
    borderBottom: "1px solid rgba(31,41,55,0.85)",
    color: "#e5e7eb",
  },
  statusBadge: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "999px",
    border: "1px solid transparent",
  },
  rowButton: {
    fontSize: "11px",
    padding: "4px 9px",
    borderRadius: "999px",
    border: "1px solid rgba(129,140,248,0.9)",
    background:
      "linear-gradient(120deg, rgba(37,99,235,0.9), rgba(59,130,246,0.95))",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  emptyState: {
    padding: "26px 18px",
    textAlign: "center",
    color: "#9ca3af",
  },
};

function statusStyles(status) {
  if (status === "converted") {
    return {
      ...tableStyles.statusBadge,
      backgroundColor: "rgba(22,163,74,0.16)",
      borderColor: "rgba(34,197,94,0.8)",
      color: "#bbf7d0",
    };
  }
  if (status === "contacted") {
    return {
      ...tableStyles.statusBadge,
      backgroundColor: "rgba(59,130,246,0.16)",
      borderColor: "rgba(59,130,246,0.9)",
      color: "#bfdbfe",
    };
  }
  return {
    ...tableStyles.statusBadge,
    backgroundColor: "rgba(148,163,184,0.16)",
    borderColor: "rgba(148,163,184,0.8)",
    color: "#e5e7eb",
  };
}

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/leads");
        if (!cancelled) {
          setLeads(res.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not load leads. Check backend / token.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLeads =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

  const total = leads.length;
  const converted = leads.filter((l) => l.status === "converted").length;
  const contacted = leads.filter((l) => l.status === "contacted").length;

  const handleRowClick = (id) => {
    navigate(`/leads/${id}`);
  };

  return (
    <div>
      <div style={{ marginBottom: "10px" }}>
        <h1 style={{ fontSize: "20px", margin: 0, marginBottom: "4px" }}>
          Pipeline overview
        </h1>
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
          Logged in as admin. Data live from MySQL CRM backend.
        </p>
      </div>

      <section style={cardStyles.grid}>
        <article style={cardStyles.card}>
          <div style={cardStyles.cardLabel}>Open leads</div>
          <div style={cardStyles.cardNumber}>{total}</div>
          <div style={cardStyles.cardHint}>Captured in the last 90 days</div>
        </article>
        <article style={{ ...cardStyles.card, ...cardStyles.cardMuted }}>
          <div style={cardStyles.cardLabel}>Contacted</div>
          <div style={cardStyles.cardNumber}>{contacted}</div>
          <div style={cardStyles.cardHint}>Awaiting follow-up cadence</div>
        </article>
        <article style={{ ...cardStyles.card, ...cardStyles.cardMuted }}>
          <div style={cardStyles.cardLabel}>Converted</div>
          <div style={cardStyles.cardNumber}>{converted}</div>
          <div style={cardStyles.cardHint}>
            Simple conversion = status marked converted
          </div>
        </article>
      </section>

      <section style={tableStyles.wrapper}>
        <div style={tableStyles.header}>
          <div>
            <div style={tableStyles.headerTitle}>Leads table</div>
            <div style={tableStyles.headerSub}>
              Change status and drill into context notes.
            </div>
          </div>
          <div style={tableStyles.headerControls}>
            <span style={tableStyles.pill}>{total} total</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={tableStyles.filterSelect}
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={tableStyles.emptyState}>Loading leads…</div>
        ) : error ? (
          <div style={tableStyles.emptyState}>{error}</div>
        ) : filteredLeads.length === 0 ? (
          <div style={tableStyles.emptyState}>
            No leads for this filter yet. Capture one from the form or seed your
            database.
          </div>
        ) : (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>Email</th>
                <th style={tableStyles.th}>Phone</th>
                <th style={tableStyles.th}>Source</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td style={tableStyles.td}>{lead.name}</td>
                  <td style={tableStyles.td}>{lead.email}</td>
                  <td style={tableStyles.td}>{lead.phone || "—"}</td>
                  <td style={tableStyles.td}>{lead.source || "Unspecified"}</td>
                  <td style={tableStyles.td}>
                    <span style={statusStyles(lead.status || "new")}>
                      {(lead.status || "new").toUpperCase()}
                    </span>
                  </td>
                  <td style={tableStyles.td}>
                    <button
                      type="button"
                      style={tableStyles.rowButton}
                      onClick={() => handleRowClick(lead.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

