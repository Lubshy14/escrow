import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LinkLogin() {
  const { code } = useParams();
  const { loginWithLink } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    loginWithLink(code)
      .then(user => navigate(user.role === "admin" ? "/admin" : "/dashboard"))
      .catch(() => setError("Invalid or expired link."));
  }, [code]);

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ color: "var(--red)", fontSize: 16 }}>{error}</p>
      <a href="/login" style={{ color: "var(--gold)", textDecoration: "none", fontSize: 14 }}>← Back to login</a>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "2px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "var(--text2)", fontSize: 14 }}>Signing you in…</p>
    </div>
  );
}
