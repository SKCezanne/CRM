import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

const layout = {
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
    gap: "16px",
  },
  panel: {
    borderRadius: "14px",
    border: "1px solid rgba(148,163,184,0.55)",
    backgroundColor: "rgba(15,23,42,0.98)",
    padding: "14px 16px",
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  label: {
    fontSize: "12px",
    color: "#9ca3af",
    marginBottom: "3px",
  },
  strong: {
    fontSize: "16px",
    fontWeight: 600,
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginTop: "10px",
    marginBottom: "10px",
  },
  badge: {
    fontSize: "11px",
    padding: "3px 9px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.7)",
    backgroundColor: "rgba(15,23,42,0.95)",
  },
  statusSelect: {
    fontSize: "12px",
    padding: "6px 9px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.7)",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
  },
  primaryButton: {
    fontSize: "12px",
    padding: "7px 12px",
    borderRadius: "999px",
    border: "1px solid rgba(129,140,248,0.9)",
    background:
      "linear-gradient(120deg, rgba(37,99,235,0.9), rgba(59,130,246,0.95))",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  secondaryButton: {
    fontSize: "12px",
    padding: "7px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.7)",
    backgroundColor: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  notesList: {
    listStyle: "none",
    margin: "8px 0 0",
    padding: 0,
    maxHeight: "260px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  noteItem: {
    padding: "8px 9px",
    borderRadius: "9px",
    border: "1px solid rgba(55,65,81,0.9)",
    backgroundColor: "rgba(15,23,42,0.95)",
    fontSize: "12px",
    color: "#e5e7eb",
  },
  noteMeta: {
    fontSize: "10px",
    color: "#9ca3af",
    marginBottom: "3px",
  },
  textarea: {
    width: "100%",
    minHeight: "70px",
    borderRadius: "10px",
    border: "1px solid rgba(55,65,81,0.9)",
    padding: "8px 9px",
    backgroundColor: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
    fontSize: "12px",
    resize: "vertical",
    marginBottom: "8px",
  },
};

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("new");
  const [newNote, setNewNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError("");
      try {
        const [leadRes, notesRes] = await Promise.all([
          api.get(`/leads/${id}`),
          api.get(`/leads/${id}/notes`),
        ]);
        if (!cancelled) {
          setLead(leadRes.data);
          setStatus(leadRes.data.status || "new");
          setNotes(notesRes.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load lead details. Check backend / id.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusSave = async () => {
    setSavingStatus(true);
    setError("");
    try {
      await api.put(`/leads/${id}`, { status });
      setLead((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      setError("Could not update status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    setError("");
    try {
      await api.post(`/leads/${id}/notes`, { note: newNote.trim() });
      setNewNote("");
      const res = await api.get(`/leads/${id}/notes`);
      setNotes(res.data || []);
    } catch (err) {
      setError("Could not add note.");
    } finally {
      setSavingNote(false);
    }
  };

  if (!lead && !error) {
    return <div style={{ fontSize: "13px" }}>Loading…</div>;
  }

  if (error) {
    return (
      <div>
        <button
          type="button"
          style={layout.secondaryButton}
          onClick={() => navigate("/dashboard")}
        >
          Back to dashboard
        </button>
        <p style={{ marginTop: "10px", fontSize: "13px", color: "#fca5a5" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        style={{ ...layout.secondaryButton, marginBottom: "10px" }}
        onClick={() => navigate("/dashboard")}
      >
        ← Back to dashboard
      </button>
      <div style={{ marginBottom: "10px" }}>
        <h1 style={{ fontSize: "20px", margin: 0, marginBottom: "4px" }}>
          Lead details
        </h1>
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
          Keep notes as you progress this deal through your pipeline.
        </p>
      </div>
      <div style={layout.grid}>
        <section style={layout.panel}>
          <div style={layout.titleRow}>
            <div>
              <div style={layout.label}>Primary contact</div>
              <div style={layout.strong}>{lead.name}</div>
            </div>
            <span style={layout.badge}>{(lead.status || "new").toUpperCase()}</span>
          </div>
          <div style={layout.fieldRow}>
            <div>
              <div style={layout.label}>Email</div>
              <div>{lead.email}</div>
            </div>
            <div>
              <div style={layout.label}>Phone</div>
              <div>{lead.phone || "Not captured"}</div>
            </div>
            <div>
              <div style={layout.label}>Source</div>
              <div>{lead.source || "Unspecified"}</div>
            </div>
          </div>
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div>
              <div style={layout.label}>Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={layout.statusSelect}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
              </select>
            </div>
            <button
              type="button"
              style={layout.primaryButton}
              onClick={handleStatusSave}
              disabled={savingStatus}
            >
              {savingStatus ? "Saving…" : "Save status"}
            </button>
          </div>
        </section>
        <section style={layout.panel}>
          <div style={layout.titleRow}>
            <div>
              <div style={layout.label}>Notes</div>
              <div style={layout.strong}>Timeline</div>
            </div>
          </div>
          <textarea
            style={layout.textarea}
            placeholder="What did you learn on the last call? Next steps?"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>
              Notes are visible only to admins in this CRM.
            </span>
            <button
              type="button"
              style={layout.primaryButton}
              onClick={handleAddNote}
              disabled={savingNote}
            >
              {savingNote ? "Saving…" : "Add note"}
            </button>
          </div>
          {notes.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "10px" }}>
              No notes yet. Capture the first interaction to start the timeline.
            </p>
          ) : (
            <ul style={layout.notesList}>
              {notes.map((n) => (
                <li key={n.id} style={layout.noteItem}>
                  <div style={layout.noteMeta}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <div>{n.note}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

