import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="rgba(201,168,76,0.15)"/>
            <path d="M16 6L22 10V16C22 20 19 23.5 16 25C13 23.5 10 20 10 16V10L16 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
            <path d="M13 16L15 18L19 14" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={styles.logoText}>VaultEscrow</span>
        </div>

        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.sub}>Sign in to your escrow account</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Enter username" style={styles.input} required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter password" style={styles.input} required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px", marginTop: 4 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={styles.hint}>
          <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 20, textAlign: "center" }}>
            Demo: admin/admin123 · client1/client123 · client2/client123
          </p>
          <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 6, textAlign: "center" }}>
            Or use short links: <code style={{ color: "var(--gold)", background: "var(--gold-dim)", padding: "1px 6px", borderRadius: 4 }}>/l/al7x2</code> · <code style={{ color: "var(--gold)", background: "var(--gold-dim)", padding: "1px 6px", borderRadius: 4 }}>/l/bk9m4</code>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "radial-gradient(ellipse at 60% 40%, rgba(201,168,76,0.04) 0%, transparent 60%)" },
  box: { width: "100%", maxWidth: 400, background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 16, padding: 36 },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--gold2)", fontWeight: 600 },
  title: { fontSize: 24, marginBottom: 6 },
  sub: { color: "var(--text2)", fontSize: 14, marginBottom: 24 },
  error: { background: "var(--red-dim)", border: "1px solid rgba(224,84,84,0.3)", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "var(--text2)", fontWeight: 500 },
  input: { width: "100%" },
};
