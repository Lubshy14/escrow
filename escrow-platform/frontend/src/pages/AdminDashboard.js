import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const socket = io("http://localhost:5000");

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [newTxn, setNewTxn] = useState({ title: "", amount: "", currency: "USD", client1Id: "client-001", client2Id: "client-002" });
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    axios.get("/api/messages").then(r => setMessages(r.data));
    axios.get("/api/transactions").then(r => setTransactions(r.data));
    axios.get("/api/users").then(r => setUsers(r.data));

    socket.on("new_message", msg => setMessages(prev => [...prev, msg]));
    socket.on("system_message", msg => setMessages(prev => [...prev, msg]));
    socket.on("transaction_updated", txn => setTransactions(prev => prev.map(t => t.id === txn.id ? txn : t)));
    return () => {
      socket.off("new_message");
      socket.off("system_message");
      socket.off("transaction_updated");
    };
  }, []);

  useEffect(() => {
    if (activeTab === "messages") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const createTransaction = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post("/api/transactions", { ...newTxn, amount: parseFloat(newTxn.amount) });
      setNewTxn({ title: "", amount: "", currency: "USD", client1Id: "client-001", client2Id: "client-002" });
      axios.get("/api/transactions").then(r => setTransactions(r.data));
    } finally {
      setCreating(false);
    }
  };

  const totalEscrow = transactions.reduce((s, t) => s + (t.status === "pending" ? t.amount : 0), 0);
  const chatMessages = messages.filter(m => m.type === "chat");

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="rgba(201,168,76,0.15)"/>
            <path d="M16 6L22 10V16C22 20 19 23.5 16 25C13 23.5 10 20 10 16V10L16 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
            <path d="M13 16L15 18L19 14" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={s.logoTxt}>VaultEscrow</span>
          <span style={s.adminBadge}>Admin</span>
        </div>

        <nav style={s.nav}>
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "messages", label: "Messages", icon: "💬", count: chatMessages.length },
            { id: "transactions", label: "Transactions", icon: "🔒" },
            { id: "create", label: "New Transaction", icon: "➕" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{ ...s.navBtn, ...(activeTab === item.id ? s.navBtnActive : {}) }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.count > 0 && <span style={s.navCount}>{item.count}</span>}
            </button>
          ))}
        </nav>

        <button onClick={logout} style={s.logoutBtn}>Sign Out</button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* Overview */}
        {activeTab === "overview" && (
          <div style={s.content}>
            <h1 style={{ fontSize: 26, marginBottom: 4 }}>Dashboard Overview</h1>
            <p style={{ color: "var(--text3)", marginBottom: 28, fontSize: 14 }}>Full platform visibility</p>

            <div style={s.statsGrid}>
              <div className="card" style={s.statCard}>
                <div style={s.statLabel}>Total in Escrow</div>
                <div style={s.statValue}>${totalEscrow.toLocaleString()}</div>
                <div style={s.statSub}>Across {transactions.filter(t => t.status === "pending").length} active transactions</div>
              </div>
              <div className="card" style={s.statCard}>
                <div style={s.statLabel}>Messages</div>
                <div style={s.statValue}>{chatMessages.length}</div>
                <div style={s.statSub}>Total between clients</div>
              </div>
              <div className="card" style={s.statCard}>
                <div style={s.statLabel}>Clients</div>
                <div style={s.statValue}>{users.filter(u => u.role === "client").length}</div>
                <div style={s.statSub}>Registered users</div>
              </div>
              <div className="card" style={s.statCard}>
                <div style={s.statLabel}>Transactions</div>
                <div style={s.statValue}>{transactions.length}</div>
                <div style={s.statSub}>{transactions.filter(t => t.status === "approved").length} approved</div>
              </div>
            </div>

            {/* Client links */}
            <h3 style={{ fontSize: 16, marginBottom: 12, marginTop: 8 }}>Client Access Links</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {users.filter(u => u.role === "client").map(u => (
                <div key={u.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={s.smallAvatar}>{u.name[0]}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>@{u.username}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <code style={{ background: "var(--gold-dim)", color: "var(--gold2)", padding: "4px 12px", borderRadius: 6, fontSize: 13 }}>
                      {window.location.origin}/l/{u.shortLink}
                    </code>
                    <button
                      className="btn-ghost"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/l/${u.shortLink}`)}
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {activeTab === "messages" && (
          <div style={{ ...s.content, display: "flex", flexDirection: "column", height: "100%" }}>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>All Messages</h1>
            <p style={{ color: "var(--text3)", marginBottom: 20, fontSize: 14 }}>Full conversation log between clients</p>
            <div style={s.messageLog}>
              {messages.filter(m => m.type !== "system").map(msg => (
                <div key={msg.id} className="card" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={s.smallAvatar}>{msg.senderName?.[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gold2)" }}>{msg.senderName}</span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    {msg.text && <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{msg.text}</p>}
                    {msg.imageUrl && (
                      <img
                        src={`http://localhost:5000${msg.imageUrl}`}
                        alt="attachment"
                        style={{ maxWidth: 280, maxHeight: 180, borderRadius: 8, marginTop: 6, cursor: "pointer", border: "1px solid var(--border2)" }}
                        onClick={() => window.open(`http://localhost:5000${msg.imageUrl}`, "_blank")}
                      />
                    )}
                    {msg.transactionId && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Transaction: {msg.transactionId}</div>}
                  </div>
                </div>
              ))}
              {chatMessages.length === 0 && <div style={{ color: "var(--text3)", textAlign: "center", padding: 40 }}>No messages yet</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Transactions */}
        {activeTab === "transactions" && (
          <div style={s.content}>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>All Transactions</h1>
            <p style={{ color: "var(--text3)", marginBottom: 20, fontSize: 14 }}>Monitor all escrow holdings</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {transactions.map(txn => {
                const client1 = users.find(u => u.id === txn.client1Id);
                const client2 = users.find(u => u.id === txn.client2Id);
                return (
                  <div key={txn.id} className="card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{txn.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "monospace" }}>{txn.id}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "var(--gold2)" }}>
                          ${txn.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>{txn.currency}</div>
                      </div>
                    </div>
                    <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text2)" }}>
                        <span>Party A: <strong>{client1?.name || txn.client1Id}</strong></span>
                        <span>Party B: <strong>{client2?.name || txn.client2Id}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--text3)" }}>
                          Approvals: {txn.approvedBy.length}/2
                        </span>
                        <span className={`badge badge-${txn.status}`}>
                          {txn.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {transactions.length === 0 && <div style={{ color: "var(--text3)", textAlign: "center", padding: 40 }}>No transactions yet</div>}
            </div>
          </div>
        )}

        {/* Create Transaction */}
        {activeTab === "create" && (
          <div style={s.content}>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>New Escrow Transaction</h1>
            <p style={{ color: "var(--text3)", marginBottom: 28, fontSize: 14 }}>Set up a new escrow holding between clients</p>
            <div style={{ maxWidth: 480 }}>
              <form onSubmit={createTransaction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={s.field}>
                  <label style={s.label}>Transaction Title</label>
                  <input value={newTxn.title} onChange={e => setNewTxn(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Website Development Project" required style={{ width: "100%" }} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...s.field, flex: 2 }}>
                    <label style={s.label}>Amount</label>
                    <input type="number" value={newTxn.amount} onChange={e => setNewTxn(p => ({ ...p, amount: e.target.value }))} placeholder="5000" required style={{ width: "100%" }} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <label style={s.label}>Currency</label>
                    <select value={newTxn.currency} onChange={e => setNewTxn(p => ({ ...p, currency: e.target.value }))} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none", width: "100%" }}>
                      <option>USD</option><option>EUR</option><option>GBP</option>
                    </select>
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Party A (Sender)</label>
                  <select value={newTxn.client1Id} onChange={e => setNewTxn(p => ({ ...p, client1Id: e.target.value }))} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none", width: "100%" }}>
                    {users.filter(u => u.role === "client").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Party B (Receiver)</label>
                  <select value={newTxn.client2Id} onChange={e => setNewTxn(p => ({ ...p, client2Id: e.target.value }))} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none", width: "100%" }}>
                    {users.filter(u => u.role === "client").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary" style={{ padding: "12px 0" }} disabled={creating}>
                  {creating ? "Creating…" : "Create Escrow Transaction"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", overflow: "hidden" },
  sidebar: { width: 240, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 12px", gap: 20, flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: 8, padding: "0 8px" },
  logoTxt: { fontFamily: "'Playfair Display', serif", fontSize: 15, color: "var(--gold2)" },
  adminBadge: { marginLeft: "auto", background: "var(--gold-dim)", color: "var(--gold)", fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, letterSpacing: "0.05em" },
  nav: { display: "flex", flexDirection: "column", gap: 2 },
  navBtn: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer", border: "none", textAlign: "left", transition: "all 0.15s" },
  navBtnActive: { background: "var(--gold-dim)", color: "var(--gold2)", fontWeight: 500 },
  navCount: { marginLeft: "auto", background: "var(--bg4)", border: "1px solid var(--border2)", color: "var(--text3)", borderRadius: 10, fontSize: 11, padding: "1px 7px" },
  logoutBtn: { marginTop: "auto", background: "none", border: "1px solid var(--border)", color: "var(--text3)", borderRadius: 8, padding: "8px 0", fontSize: 13, cursor: "pointer" },
  main: { flex: 1, overflow: "auto" },
  content: { padding: "32px 36px", maxWidth: 900 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 },
  statCard: { padding: 18 },
  statLabel: { fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 },
  statValue: { fontFamily: "'Playfair Display', serif", fontSize: 28, color: "var(--gold2)", lineHeight: 1 },
  statSub: { fontSize: 12, color: "var(--text3)", marginTop: 6 },
  smallAvatar: { width: 30, height: 30, borderRadius: "50%", background: "var(--gold-dim)", border: "1px solid var(--gold)", color: "var(--gold2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 },
  messageLog: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "var(--text2)", fontWeight: 500 },
};
