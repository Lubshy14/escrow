import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Logo from "../components/Logo";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/verify");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
          <header style={styles.headerBar}>
          <div style={styles.brandRow}>
            <Logo size={28} showText={false} />
            <span style={styles.brandLabel}>ticket board</span>
          </div>
          <Link to="/register" style={styles.headerLink}>新規登録</Link>
        </header>

        <div style={styles.bodyTop}>
          <h2 style={styles.title}>{t.welcomeBack}</h2>
          <p style={styles.sub}>{t.welcomeTo}</p>
        </div>
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t.username}</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder={t.username} style={styles.input} required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{t.password}</label>
            <div style={styles.passwordRow}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.password}
                style={{ ...styles.input, marginRight: 10 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={styles.showPasswordBtn}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{t.language}</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={styles.input}>
              <option>English</option>
              <option>Japanese</option>
              <option>French</option>
              <option>Spanish</option>
              <option>Mandarin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" style={styles.submitBtn} disabled={loading}>
            {loading ? `${t.signIn}…` : t.signIn}
          </button>
        </form>

        <div style={styles.hint}>
          <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 20, textAlign: "center" }}>
            {t.registerPrompt}
          </p>
          <p style={{ textAlign: "center", marginTop: 6 }}>
            <Link to="/register" style={styles.registerLink}>{t.signUp}</Link>
          </p>
          <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 8, textAlign: "center" }}>
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
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "transparent",
  },
  box: {
    width: "100%",
    maxWidth: 420,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 24px 80px rgba(34,140,94,0.08)",
    border: "1px solid rgba(34,140,94,0.12)",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  brandLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--primary)",
    textTransform: "lowercase",
  },
  headerLink: {
    color: "var(--text2)",
    textDecoration: "none",
    fontWeight: 600,
  },
  bodyTop: { marginBottom: 20 },
  title: { fontSize: 28, marginBottom: 8, color: "var(--text)" },
  sub: { color: "var(--text2)", fontSize: 15, lineHeight: 1.7 },
  error: {
    background: "rgba(224,84,84,0.12)",
    border: "1px solid rgba(224,84,84,0.18)",
    color: "var(--red)",
    padding: "12px 14px",
    borderRadius: 14,
    fontSize: 13,
    marginBottom: 16,
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, color: "var(--text3)", fontWeight: 600 },
  input: { width: "100%" },
  passwordRow: { display: "flex", alignItems: "center", gap: 10 },
  showPasswordBtn: {
    border: "1px solid rgba(34,140,94,0.16)",
    background: "#f6fbf7",
    color: "var(--primary)",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 13,
  },
  submitBtn: { width: "100%", padding: "14px", marginTop: 4, borderRadius: 999 },
  registerLink: { color: "var(--primary)", textDecoration: "none", fontWeight: 700 },
};
