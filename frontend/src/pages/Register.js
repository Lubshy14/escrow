import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import Logo from "../components/Logo";

export default function Register() {
  const { language, setLanguage, t } = useLanguage();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/register", {
        name: name.trim(),
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      navigate("/dashboard");
    } catch (err) {
      setError(t.registerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logoStrip}>
          <Logo size={28} showText />
        </div>

        <h2 style={styles.title}>{t.signUp}</h2>
        <p style={styles.sub}>{t.registerSubtitle}</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t.name}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.name}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{t.username}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.username}
              style={styles.input}
              required
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
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={styles.input}
            >
              <option>English</option>
              <option>Japanese</option>
              <option>French</option>
              <option>Spanish</option>
              <option>Mandarin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" style={styles.submitBtn} disabled={loading}>
            {loading ? `${t.signUp}…` : t.signUp}
          </button>
        </form>

        <p style={styles.footerText}>
          {t.haveAccount} <Link to="/login" style={styles.link}>{t.signIn}</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "radial-gradient(ellipse at 60% 40%, rgba(201,168,76,0.04) 0%, transparent 60%)" },
  box: { width: "100%", maxWidth: 420, background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 16, padding: 36 },
  logoStrip: { marginBottom: 28 },
  title: { fontSize: 24, marginBottom: 8 },
  sub: { color: "var(--text2)", fontSize: 14, marginBottom: 24 },
  error: { background: "var(--red-dim)", border: "1px solid rgba(224,84,84,0.3)", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "var(--text2)", fontWeight: 500 },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--text)" },
  passwordRow: { display: "flex", alignItems: "center" },
  showPasswordBtn: { border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--gold)", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" },
  submitBtn: { width: "100%", padding: "12px", marginTop: 4 },
  footerText: { color: "var(--text3)", fontSize: 13, marginTop: 18, textAlign: "center" },
  link: { color: "var(--gold)", textDecoration: "none" },
};

