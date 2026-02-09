import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={styles.title}>Future CRM admin</h2>

        <p style={styles.subtitle}>
          Sign in with your seeded admin credentials to unlock the pipeline
          dashboard.
        </p>

        {error && <p style={styles.error}>{error}</p>}

        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    padding: "24px",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.4), transparent 60%)",
  },
  card: {
    width: "100%",
    padding: "30px 26px 24px 26px",
    backgroundColor: "rgba(15,23,42,0.98)",
    borderRadius: "16px",
    boxShadow: "0 26px 70px rgba(15,23,42,0.9)",
    border: "1px solid rgba(148,163,184,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  title: {
    textAlign: "left",
    color: "#e5e7eb",
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: "12px",
    color: "#9ca3af",
    margin: 0,
    marginBottom: "8px",
  },
  input: {
    padding: "10px",
    fontSize: "13px",
    borderRadius: "10px",
    border: "1px solid rgba(55,65,81,0.9)",
    backgroundColor: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
  },
  button: {
    padding: "10px",
    background:
      "linear-gradient(120deg, rgba(37,99,235,0.95), rgba(56,189,248,0.95))",
    color: "#0b1120",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    borderRadius: "999px",
    fontWeight: 600,
  },
  error: {
    color: "#fecaca",
    fontSize: "13px",
    textAlign: "left",
  },
};
