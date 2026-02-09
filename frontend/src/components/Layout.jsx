const shellStyles = {
  outer: {
    minHeight: "100vh",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
  },
  card: {
    width: "100%",
    maxWidth: "1200px",
    backgroundColor: "#0b1220",
    borderRadius: "18px",
    boxShadow: "0 24px 80px rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.3)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  chromeHiddenCard: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#0b1220",
    borderRadius: "18px",
    boxShadow: "0 24px 80px rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.3)",
    overflow: "hidden",
  },
  header: {
    padding: "14px 20px",
    borderBottom: "1px solid rgba(148,163,184,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background:
      "linear-gradient(120deg, rgba(15,23,42,0.98), rgba(30,64,175,0.85))",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#e5e7eb",
    fontSize: "14px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  logoDot: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background:
      "conic-gradient(from 180deg, #38bdf8, #4ade80, #22c55e, #38bdf8)",
    boxShadow: "0 0 24px rgba(56,189,248,0.9)",
  },
  navButtons: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
  },
  navButton: {
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(148,163,184,0.5)",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  logoutButton: {
    padding: "6px 12px",
    borderRadius: "999px",
    background:
      "linear-gradient(120deg, rgba(248,113,113,0.9), rgba(220,38,38,0.95))",
    border: "none",
    color: "#fef2f2",
    cursor: "pointer",
    fontWeight: 500,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    minHeight: "520px",
  },
  sidebar: {
    padding: "18px 18px 20px 18px",
    borderRight: "1px solid rgba(148,163,184,0.2)",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.2), transparent 55%)",
    color: "#e5e7eb",
    fontSize: "13px",
  },
  sidebarSectionTitle: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#9ca3af",
    marginBottom: "10px",
  },
  sidebarList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sidebarItem: {
    padding: "7px 10px",
    borderRadius: "9px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid transparent",
  },
  sidebarItemActive: {
    background:
      "linear-gradient(120deg, rgba(30,64,175,0.5), rgba(37,99,235,0.75))",
    border: "1px solid rgba(129,140,248,0.8)",
    boxShadow: "0 0 18px rgba(59,130,246,0.5)",
  },
  sidebarItemBadge: {
    fontSize: "11px",
    padding: "2px 7px",
    borderRadius: "999px",
    backgroundColor: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.6)",
  },
  main: {
    padding: "18px 22px 22px 22px",
    background:
      "radial-gradient(circle at top right, rgba(56,189,248,0.16), transparent 55%)",
    color: "#e5e7eb",
    overflow: "auto",
  },
};

import { useLocation, useNavigate } from "react-router-dom";

function Layout({ children, hideChrome = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  if (hideChrome) {
    return (
      <div style={shellStyles.outer}>
        <div style={shellStyles.chromeHiddenCard}>{children}</div>
      </div>
    );
  }

  return (
    <div style={shellStyles.outer}>
      <div style={shellStyles.card}>
        <header style={shellStyles.header}>
          <div style={shellStyles.brand}>
            <div style={shellStyles.logoDot} />
            <span>Future CRM</span>
          </div>
          <div style={shellStyles.navButtons}>
            <button
              type="button"
              style={shellStyles.navButton}
              onClick={() => navigate("/dashboard")}
            >
              Overview
            </button>
            <button
              type="button"
              style={shellStyles.navButton}
              onClick={() => navigate("/leads/new")}
            >
              New lead
            </button>
            <button type="button" style={shellStyles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <div style={shellStyles.content}>
          <aside style={shellStyles.sidebar}>
            <div style={{ marginBottom: "18px" }}>
              <div style={shellStyles.sidebarSectionTitle}>Workspace</div>
              <ul style={shellStyles.sidebarList}>
                <li
                  style={{
                    ...shellStyles.sidebarItem,
                    ...(path === "/dashboard" || path === "/"
                      ? shellStyles.sidebarItemActive
                      : null),
                  }}
                  onClick={() => navigate("/dashboard")}
                >
                  <span>Leads board</span>
                  <span style={shellStyles.sidebarItemBadge}>Live</span>
                </li>
                <li
                  style={{
                    ...shellStyles.sidebarItem,
                    ...(path.startsWith("/leads/new")
                      ? shellStyles.sidebarItemActive
                      : null),
                  }}
                  onClick={() => navigate("/leads/new")}
                >
                  <span>Capture form</span>
                </li>
              </ul>
            </div>
            <div>
              <div style={shellStyles.sidebarSectionTitle}>Insights</div>
              <ul style={shellStyles.sidebarList}>
                <li style={shellStyles.sidebarItem}>
                  <span>Conversion health</span>
                  <span style={shellStyles.sidebarItemBadge}>Beta</span>
                </li>
              </ul>
            </div>
          </aside>
          <main style={shellStyles.main}>{children}</main>
        </div>
      </div>
    </div>
  );
}

export default Layout;

