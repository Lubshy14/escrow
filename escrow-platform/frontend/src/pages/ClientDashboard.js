import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const socket = io("http://localhost:5000");

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const transaction = transactions[0];

  useEffect(() => {
    axios.get("/api/messages").then(r => setMessages(r.data));
    axios.get("/api/transactions").then(r => setTransactions(r.data));

    socket.on("new_message", (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on("system_message", (msg) => {
      setMessages(prev => [...prev, msg]);
      setNotification(msg.text);
      setTimeout(() => setNotification(null), 6000);
    });
    socket.on("transaction_updated", (txn) => {
      setTransactions(prev => prev.map(t => t.id === txn.id ? txn : t));
    });
    return () => {
      socket.off("new_message");
      socket.off("system_message");
      socket.off("transaction_updated");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imageFile) return;
    setSending(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text);
      if (imageFile) fd.append("image", imageFile);
      if (transaction) fd.append("transactionId", transaction.id);
      await axios.post("/api/messages", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setText("");
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setSending(false);
    }
  };

  const approvePayment = async () => {
    if (!transaction) return;
    await axios.post(`/api/transactions/${transaction.id}/approve`);
  };

  const alreadyApproved = transaction?.approvedBy?.includes(user.id);

  return (
    <div style={s.page}>
      {/* Notification Banner */}
      {notification && (
        <div style={s.notifBanner}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.logo}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="rgba(201,168,76,0.15)"/>
              <path d="M16 6L22 10V16C22 20 19 23.5 16 25C13 23.5 10 20 10 16V10L16 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
              <path d="M13 16L15 18L19 14" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={s.logoTxt}>VaultEscrow</span>
          </div>
          <div style={s.userCard}>
            <div style={s.avatar}>{user.name[0]}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Client</div>
            </div>
          </div>
        </div>

        {/* Escrow Balance Card */}
        {transaction && (
          <div style={s.escrowCard}>
            <div style={s.escrowLabel}>Escrow Holds</div>
            <div style={s.escrowAmount}>${transaction.amount.toLocaleString()}</div>
            <div style={s.escrowCurrency}>{transaction.currency}</div>
            <div style={s.escrowDivider} />
            <div style={s.escrowProject}>{transaction.title}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`badge badge-${transaction.status}`}>
                {transaction.status === "pending" ? "⏳" : transaction.status === "approved" ? "✅" : "📋"} {transaction.status}
              </span>
            </div>
            {transaction.status === "pending" && (
              <button
                onClick={approvePayment}
                disabled={alreadyApproved}
                style={s.approveBtn}
              >
                {alreadyApproved ? "✓ Approval sent" : "Approve Release"}
              </button>
            )}
          </div>
        )}

        <button onClick={logout} style={s.logoutBtn}>Sign Out</button>
      </aside>

      {/* Chat Area */}
      <main style={s.main}>
        <div style={s.chatHeader}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Transaction Chat</h2>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>Secure messaging between parties</p>
          </div>
          {transaction && (
            <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "right" }}>
              <div>Escrow ID: <span style={{ color: "var(--gold)", fontFamily: "monospace" }}>{transaction.id}</span></div>
            </div>
          )}
        </div>

        <div style={s.messages}>
          {messages.filter(m => m.type === "system" || m.transactionId === transaction?.id).map(msg => {
            if (msg.type === "system") return (
              <div key={msg.id} style={s.systemMsg}>
                <div style={s.systemMsgInner}>{msg.text}</div>
              </div>
            );

            const isMine = msg.senderId === user.id;
            return (
              <div key={msg.id} style={{ ...s.msgRow, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                {!isMine && <div style={s.msgAvatar}>{msg.senderName?.[0]}</div>}
                <div style={{ maxWidth: "68%" }}>
                  {!isMine && <div style={s.msgSender}>{msg.senderName}</div>}
                  <div style={{ ...s.bubble, ...(isMine ? s.bubbleMine : s.bubbleOther) }}>
                    {msg.imageUrl && (
                      <img
                        src={`http://localhost:5000${msg.imageUrl}`}
                        alt="attachment"
                        style={s.msgImage}
                        onClick={() => window.open(`http://localhost:5000${msg.imageUrl}`, "_blank")}
                      />
                    )}
                    {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
                  </div>
                  <div style={s.msgTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div style={s.previewBar}>
            <img src={imagePreview} alt="preview" style={{ height: 56, borderRadius: 6, border: "1px solid var(--border2)" }} />
            <span style={{ fontSize: 12, color: "var(--text2)" }}>{imageFile?.name}</span>
            <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ ...s.removeImg }}>✕</button>
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} style={s.inputRow}>
          <button type="button" onClick={() => fileInputRef.current.click()} style={s.attachBtn} title="Attach image">
            📎
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <input
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Type a message…"
            style={{ ...s.textInput, flex: 1 }}
          />
          <button type="submit" className="btn-primary" style={{ padding: "10px 20px" }} disabled={sending || (!text.trim() && !imageFile)}>
            {sending ? "…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" },
  notifBanner: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "var(--green-dim)", border: "1px solid rgba(46,204,122,0.3)", color: "var(--green)", padding: "12px 24px", borderRadius: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 500, textAlign: "center" },
  sidebar: { width: 280, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: 20, gap: 16, flexShrink: 0 },
  sidebarTop: { display: "flex", flexDirection: "column", gap: 20 },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoTxt: { fontFamily: "'Playfair Display', serif", fontSize: 16, color: "var(--gold2)" },
  userCard: { display: "flex", alignItems: "center", gap: 10, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" },
  avatar: { width: 34, height: 34, borderRadius: "50%", background: "var(--gold-dim)", border: "1px solid var(--gold)", color: "var(--gold2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flexShrink: 0 },
  escrowCard: { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 12, padding: 16, flex: 1 },
  escrowLabel: { fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  escrowAmount: { fontFamily: "'Playfair Display', serif", fontSize: 32, color: "var(--gold2)", lineHeight: 1.1 },
  escrowCurrency: { fontSize: 12, color: "var(--text3)", marginBottom: 10 },
  escrowDivider: { height: 1, background: "var(--border)", margin: "10px 0" },
  escrowProject: { fontSize: 13, color: "var(--text2)", lineHeight: 1.4 },
  approveBtn: { marginTop: 12, width: "100%", background: "var(--green-dim)", border: "1px solid rgba(46,204,122,0.3)", color: "var(--green)", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" },
  logoutBtn: { background: "none", border: "1px solid var(--border)", color: "var(--text3)", borderRadius: 8, padding: "8px 0", fontSize: 13, cursor: "pointer", marginTop: "auto", transition: "all 0.2s" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  chatHeader: { padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  messages: { flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 },
  systemMsg: { display: "flex", justifyContent: "center" },
  systemMsgInner: { background: "var(--green-dim)", border: "1px solid rgba(46,204,122,0.2)", color: "var(--green)", padding: "8px 16px", borderRadius: 20, fontSize: 13, textAlign: "center", maxWidth: 480 },
  msgRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  msgAvatar: { width: 28, height: 28, borderRadius: "50%", background: "var(--bg4)", border: "1px solid var(--border2)", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 },
  msgSender: { fontSize: 11, color: "var(--text3)", marginBottom: 3, paddingLeft: 2 },
  bubble: { padding: "10px 14px", borderRadius: 12, fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" },
  bubbleMine: { background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.25)", borderBottomRightRadius: 4, color: "var(--text)" },
  bubbleOther: { background: "var(--bg3)", border: "1px solid var(--border2)", borderBottomLeftRadius: 4 },
  msgImage: { maxWidth: "100%", maxHeight: 240, borderRadius: 8, display: "block", cursor: "pointer", marginBottom: 6 },
  msgTime: { fontSize: 10, color: "var(--text3)", marginTop: 3, textAlign: "right" },
  previewBar: { display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", background: "var(--bg2)", borderTop: "1px solid var(--border)" },
  removeImg: { marginLeft: "auto", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 14 },
  inputRow: { padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", background: "var(--bg2)" },
  attachBtn: { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" },
  textInput: { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none" },
};
