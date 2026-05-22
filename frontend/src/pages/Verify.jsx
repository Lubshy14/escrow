import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Verify() {
  const { verifyCode, resendCode, verificationEmail } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyCode(code);
      setSuccess(t.verifySuccess);
      setTimeout(() => navigate("/login"), 1400);
    } catch (err) {
      setError(err.response?.data?.error || t.verifyError);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendCode();
      setSuccess(`${t.verifySent} ${verificationEmail || "your email"}`);
    } catch (err) {
      setError(err.response?.data?.error || t.verifyError);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <h2 style={styles.title}>{t.verifyTitle}</h2>
        <p style={styles.sub}>{t.verifySubtitle}</p>

        {success && <div style={styles.success}>{success}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>{t.verifyCode}</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            style={styles.input}
            required
          />
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? `${t.verifySubmit}...` : t.verifySubmit}
          </button>
        </form>

        <button type="button" style={styles.resendBtn} onClick={handleResend}>
          {t.resendCode}
        </button>

        <p style={styles.footerText}>
          <Link to="/login" style={styles.link}>{t.backToLogin}</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f5f9fb" },
  box: { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 24, padding: 36, boxShadow: "0 24px 80px rgba(34,140,94,0.08)", border: "1px solid rgba(34,140,94,0.12)" },
  title: { fontSize: 28, marginBottom: 8, color: "#142d3e" },
  sub: { color: "#5f6f83", fontSize: 15, lineHeight: 1.7, marginBottom: 20 },
  form: { display: "flex", flexDirection: "column", gap: 16, marginBottom: 18 },
  label: { fontSize: 13, color: "#7a8697", fontWeight: 600 },
  input: { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(34,140,94,0.16)", background: "#fbfdfe" },
  submitBtn: { width: "100%", padding: "14px", borderRadius: 999, background: "#1f8a5e", color: "#fff", border: "none", cursor: "pointer" },
  resendBtn: { width: "100%", padding: "14px", borderRadius: 999, background: "#f2f7f3", color: "#1f8a5e", border: "1px solid rgba(31,138,94,0.18)", cursor: "pointer" },
  success: { background: "rgba(44,154,100,0.12)", border: "1px solid rgba(44,154,100,0.18)", color: "#227a4f", padding: "12px 14px", borderRadius: 14, marginBottom: 16 },
  error: { background: "rgba(224,84,84,0.12)", border: "1px solid rgba(224,84,84,0.18)", color: "#c32f2f", padding: "12px 14px", borderRadius: 14, marginBottom: 16 },
  footerText: { color: "#7a8697", fontSize: 13, marginTop: 18, textAlign: "center" },
  link: { color: "#1f8a5e", textDecoration: "none", fontWeight: 700 },
};
