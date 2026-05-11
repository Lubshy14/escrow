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
            <Logo size={32} showText={true} />
          </div>

        <h2 style={styles.title}>{t.welcomeBack}</h2>
        <p style={styles.sub}>{t.welcomeTo}</p>
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
          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px", marginTop: 4 }} disabled={loading}>
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
  passwordRow: { display: "flex", alignItems: "center" },
  showPasswordBtn: { border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--gold)", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" },
  registerLink: { color: "var(--gold)", textDecoration: "none", fontWeight: 600 },
};
