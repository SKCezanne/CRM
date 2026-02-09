import { useState } from "react";
import api from "../api";

const styles = {
  wrapper: {
    maxWidth: "460px",
  },
  label: {
    fontSize: "12px",
    color: "#9ca3af",
    marginBottom: "4px",
  },
  input: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid rgba(55,65,81,0.9)",
    padding: "9px 10px",
    backgroundColor: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
    fontSize: "13px",
    marginBottom: "10px",
  },
  select: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid rgba(55,65,81,0.9)",
    padding: "8px 10px",
    backgroundColor: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
    fontSize: "13px",
    marginBottom: "12px",
  },
  primaryButton: {
    fontSize: "13px",
    padding: "9px 14px",
    borderRadius: "999px",
    border: "1px solid rgba(129,140,248,0.9)",
    background:
      "linear-gradient(120deg, rgba(37,99,235,0.9), rgba(59,130,246,0.95))",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  helper: {
    fontSize: "11px",
    color: "#9ca3af",
    marginTop: "6px",
  },
  success: {
    fontSize: "12px",
    color: "#bbf7d0",
    marginTop: "10px",
  },
  error: {
    fontSize: "12px",
    color: "#fecaca",
    marginTop: "10px",
  },
};

export default function NewLead() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    setLoading(true);
    try {
      await api.post("/leads", {
        name,
        email,
        phone,
        source,
      });
      setSuccess("Lead captured successfully.");
      setName("");
      setEmail("");
      setPhone("");
      setSource("");
    } catch (err) {
      setError("Could not create lead. Check backend / payload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={{ marginBottom: "10px" }}>
        <h1 style={{ fontSize: "20px", margin: 0, marginBottom: "4px" }}>
          Capture lead
        </h1>
        <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
          This form hits your `/api/leads` endpoint and writes directly into
          MySQL.
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <div style={styles.label}>Name *</div>
          <input
            style={styles.input}
            placeholder="Jane Future"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <div style={styles.label}>Email *</div>
          <input
            style={styles.input}
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div style={styles.label}>Phone</div>
          <input
            style={styles.input}
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <div style={styles.label}>Source</div>
          <select
            style={styles.select}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Select a source</option>
            <option value="Website form">Website form</option>
            <option value="Outbound">Outbound</option>
            <option value="Referral">Referral</option>
            <option value="Event">Event</option>
          </select>
        </div>
        <button type="submit" style={styles.primaryButton} disabled={loading}>
          {loading ? "Submitting…" : "Create lead"}
        </button>
      </form>
      <p style={styles.helper}>
        Tip: you can reuse this exact payload from a marketing site to push
        leads into this CRM.
      </p>
      {success && <p style={styles.success}>{success}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

