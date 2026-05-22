import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function LinkLogin() {
  const { code } = useParams();
  const { loginWithLink } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage(t.invalidLink);
      return;
    }

    const processLink = async () => {
      try {
        const user = await loginWithLink(code);
        setStatus("success");
        setMessage(t.loginLinkSuccess);
        setTimeout(() => {
          if (user?.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/dashboard");
          }
        }, 1800);
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.error || t.loginLinkError);
      }
    };

    processLink();
  }, [code, loginWithLink, navigate, t]);

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <h2 style={styles.title}>{t.linkLoginTitle}</h2>
        <p style={styles.sub}>{t.linkLoginSubtitle}</p>

        {status === "pending" && <div style={styles.info}>{t.linkLoginPending}</div>}
        {status === "success" && <div style={styles.success}>{message}</div>}
        {status === "error" && <div style={styles.error}>{message}</div>}

        <p style={styles.footerText}>
          <Link to="/login" style={styles.link}>{t.backToLogin}</Link>
        </p>
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
    background: "#f5f9fb",
  },
  box: {
    width: "100%",
    maxWidth: 460,
    background: "#fff",
    borderRadius: 24,
    padding: 36,
    boxShadow: "0 24px 80px rgba(34,140,94,0.08)",
    border: "1px solid rgba(34,140,94,0.12)",
  },
  title: { fontSize: 28, marginBottom: 8, color: "#142d3e" },
  sub: { color: "#5f6f83", fontSize: 15, lineHeight: 1.7, marginBottom: 20 },
  info: {
    background: "rgba(56,118,255,0.08)",
    border: "1px solid rgba(56,118,255,0.16)",
    color: "#1d4ed8",
    padding: "12px 14px",
    borderRadius: 14,
    marginBottom: 16,
  },
  success: {
    background: "rgba(44,154,100,0.12)",
    border: "1px solid rgba(44,154,100,0.18)",
    color: "#227a4f",
    padding: "12px 14px",
    borderRadius: 14,
    marginBottom: 16,
  },
  error: {
    background: "rgba(224,84,84,0.12)",
    border: "1px solid rgba(224,84,84,0.18)",
    color: "#c32f2f",
    padding: "12px 14px",
    borderRadius: 14,
    marginBottom: 16,
  },
  footerText: { color: "#7a8697", fontSize: 13, marginTop: 18, textAlign: "center" },
  link: { color: "#1f8a5e", textDecoration: "none", fontWeight: 700 },
};
