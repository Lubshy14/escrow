import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const initialForm = {
  seller: "",
  item: "",
  amount: "",
  dueAt: "",
};

const statuses = [
  "All",
  "Pending Acceptance",
  "Funding Pending",
  "In Review",
  "Awaiting Release",
  "Disputed",
  "Denied",
  "Completed",
];

const formatDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatMessageTime = (value) => {
  const date = new Date(value);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeStatus, setActiveStatus] = useState("All");
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const loadTransactions = async () => {
    if (!user?.username) return;

    setLoading(true);
    setError("");

    try {
      const { data } = await axios.get("/api/client/transactions");
      setTransactions(data.transactions || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.response?.data?.error || t.unableTransactions);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    if (!user?.username) return;

    try {
      const { data } = await axios.get("/api/client/users");
      const nextClients = data.clients || [];
      setClients(nextClients);
      setSelectedClient((current) => current || nextClients[0]?.username || "");
    } catch (err) {
      setError(err.response?.data?.error || t.unableContacts);
    }
  };

  const loadMessages = async (otherUsername = selectedClient) => {
    if (!user?.username || !otherUsername) return;

    setMessagesLoading(true);

    try {
      const { data } = await axios.get("/api/client/messages", {
        params: {
          otherUsername,
        },
      });
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.response?.data?.error || t.unableMessages);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "client") {
      loadTransactions();
      loadClients();
    }
  }, [user?.username, user?.role]);

  useEffect(() => {
    if (selectedClient) {
      loadMessages(selectedClient);
    }
  }, [selectedClient]);

  const selectedClientName = useMemo(() => (
    clients.find((client) => client.username === selectedClient)?.name || selectedClient
  ), [clients, selectedClient]);

  const resolveClientUsername = (value) => {
    const normalizedValue = String(value || "").trim().toLowerCase();
    if (!normalizedValue) return "";

    return clients.find((client) => (
      String(client.username || "").trim().toLowerCase() === normalizedValue
        || String(client.name || "").trim().toLowerCase() === normalizedValue
    ))?.username || "";
  };

  const filteredTransactions = useMemo(() => (
    transactions.filter((transaction) => (
      activeStatus === "All" || transaction.status === activeStatus
    ))
  ), [activeStatus, transactions]);

  const nextAction = useMemo(() => {
    const actionTransaction = transactions.find((transaction) => transaction.canRespond)
      || transactions.find((transaction) => (
        transaction.status === "Funding Pending" || transaction.status === "Awaiting Release"
      ));

    if (!actionTransaction) return t.noActionNeeded;
    return `${actionTransaction.id}: ${actionTransaction.stage}`;
  }, [transactions, t.noActionNeeded]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));

    if (name === "seller") {
      const receiverUsername = resolveClientUsername(value);
      if (receiverUsername) {
        setSelectedClient(receiverUsername);
      }
    }
  };

  const handleCreateTransaction = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/client/transactions", form);
      const receiverUsername = resolveClientUsername(form.seller);
      if (receiverUsername) {
        setSelectedClient(receiverUsername);
        await loadMessages(receiverUsername);
      }
      setForm(initialForm);
      setSuccess(t.transactionRequestSent);
      await loadTransactions();
    } catch (err) {
      setError(err.response?.data?.error || t.unableCreateTransaction);
    } finally {
      setSaving(false);
    }
  };

  const handleTransactionResponse = async (transactionId, decision) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await axios.patch(`/api/client/transactions/${transactionId}/respond`, {
        decision,
      });
      setSuccess(decision === "accept" ? t.transactionAccepted : t.transactionDenied);
      await loadTransactions();
    } catch (err) {
      setError(err.response?.data?.error || t.unableUpdateTransaction);
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    setError("");

    if (!file) {
      setImagePreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(t.attachImageFile);
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t.imageTooLarge);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/client/messages", {
        to: selectedClient,
        text: messageText,
        image: imagePreview,
      });
      setMessageText("");
      setImagePreview("");
      setSuccess(t.messageSent);
      await loadMessages(selectedClient);
    } catch (err) {
      setError(err.response?.data?.error || t.unableSendMessage);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await axios.post("/api/client/invites");
      const nextLink = `${window.location.origin}${data.path}`;
      setInviteLink(nextLink);
      setSuccess(t.inviteCreated);
    } catch (err) {
      setError(err.response?.data?.error || t.unableInvite);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess(t.inviteCopied);
    } catch (err) {
      setSuccess(t.inviteReady);
    }
  };

  if (!user) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.emptyBox}>
          <h2 style={styles.title}>{t.signInRequired}</h2>
          <p style={styles.sub}>{t.notSignedIn || "You are not signed in."}</p>
          <Link to="/login" style={styles.linkButton}>{t.signIn}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page client-page" style={styles.page}>
      <header className="client-dashboard-header" style={styles.header}>
        <div>
          <p style={styles.eyebrow}>{t.clientWorkspace}</p>
          <h1 style={styles.title}>{formatText(t.dashboardWelcome, { name: user.name || user.username })}</h1>
          <p style={styles.sub}>{t.dashboardSubtitle}</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>{t.signOut || "Sign out"}</button>
      </header>

      {(error || success) && (
        <div style={error ? styles.error : styles.success}>
          {error || success}
        </div>
      )}

      <section className="metric-grid" style={styles.metricGrid}>
        <Metric label={t.activeTransactions} value={summary?.activeTransactions || 0} helper={t.activeTransactionsHelp} />
        <Metric label={t.totalEscrowValue} value={money.format(summary?.totalValue || 0)} helper={t.totalEscrowValueHelp} />
        <Metric label={t.pendingAction} value={summary?.pendingAction || 0} helper={t.pendingActionHelp} />
        <Metric label={t.nextStep} value={nextAction} helper={t.nextStepHelp} compact />
      </section>

      <main className="client-dashboard-content" style={styles.contentGrid}>
        <section className="app-panel" style={styles.panel}>
          <div className="panel-header" style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>{t.yourTransactions}</h2>
              <p style={styles.panelSub}>{formatText(t.escrowRecordsCount, { shown: filteredTransactions.length, total: transactions.length })}</p>
            </div>
            <button onClick={loadTransactions} style={styles.refreshBtn} disabled={loading}>
              {loading ? t.refreshing : t.refresh}
            </button>
          </div>

          <div style={styles.filters}>
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                style={{
                  ...styles.filterButton,
                  ...(activeStatus === status ? styles.activeFilter : null),
                }}
              >
                {getStatusLabel(status, t)}
              </button>
            ))}
          </div>

          <div style={styles.transactionList}>
            {loading ? (
              <p style={styles.emptyText}>{t.loadingTransactions}</p>
            ) : filteredTransactions.length ? (
              filteredTransactions.map((transaction) => (
                <article key={transaction.id} style={styles.transactionCard}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong style={styles.transactionId}>{transaction.id}</strong>
                      <h3 style={styles.transactionTitle}>{transaction.item}</h3>
                    </div>
                    <span style={{ ...styles.badge, ...getStatusStyle(transaction.status) }}>{getStatusLabel(transaction.status, t)}</span>
                  </div>

                  <div style={styles.detailGrid}>
                    <Detail label={t.buyer} value={transaction.buyer} />
                    <Detail label={t.seller} value={transaction.seller} />
                    <Detail label={t.amount} value={money.format(transaction.amount)} />
                    <Detail label={t.due} value={formatDate(transaction.dueAt)} />
                  </div>
                  <div style={styles.responseActions}>
                    <p style={styles.responseNote}>
                      {getResponseNote(transaction, t)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTransactionResponse(transaction.id, "accept")}
                      style={{
                        ...styles.acceptBtn,
                        ...(!transaction.canRespond ? styles.disabledActionBtn : null),
                      }}
                      disabled={saving || !transaction.canRespond}
                    >
                      {t.accept}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransactionResponse(transaction.id, "deny")}
                      style={{
                        ...styles.denyBtn,
                        ...(!transaction.canRespond ? styles.disabledActionBtn : null),
                      }}
                      disabled={saving || !transaction.canRespond}
                    >
                      {t.deny}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p style={styles.emptyText}>{t.noTransactionsStatus}</p>
            )}
          </div>
        </section>

        <aside className="app-panel" style={styles.panel}>
          <h2 style={styles.panelTitle}>{t.newTransaction}</h2>
          <p style={styles.panelSub}>{t.newTransactionHelp}</p>

          <form onSubmit={handleCreateTransaction} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>{t.receivingClient}</span>
              <input
                name="seller"
                value={form.seller}
                onChange={handleChange}
                style={styles.input}
                placeholder={t.receivingClientPlaceholder}
                list="client-options"
                required
              />
              <datalist id="client-options">
                {clients.map((client) => (
                  <option key={client.username} value={client.username}>
                    {client.name}
                  </option>
                ))}
              </datalist>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.itemOrService}</span>
              <input name="item" value={form.item} onChange={handleChange} style={styles.input} placeholder={t.itemPlaceholder} required />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.amount}</span>
              <input name="amount" value={form.amount} onChange={handleChange} style={styles.input} type="number" min="1" placeholder="0" required />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.dueDate}</span>
              <input name="dueAt" value={form.dueAt} onChange={handleChange} style={styles.input} type="date" required />
            </label>

            <button type="submit" style={styles.createBtn} disabled={saving}>
              {saving ? t.creating : t.createTransaction}
            </button>
          </form>

          <div style={styles.inviteBox}>
            <h3 style={styles.inviteTitle}>{t.inviteClient}</h3>
            <p style={styles.inviteText}>{t.inviteClientHelp}</p>
            <button type="button" onClick={handleGenerateInvite} style={styles.secondaryActionBtn} disabled={inviteLoading}>
              {inviteLoading ? t.creatingLink : t.createInviteLink}
            </button>
            {inviteLink && (
              <div className="invite-link-row" style={styles.inviteLinkRow}>
                <input value={inviteLink} readOnly style={styles.input} />
                <button type="button" onClick={handleCopyInvite} style={styles.copyBtn}>{t.copy}</button>
              </div>
            )}
          </div>
        </aside>
      </main>

      <section className="app-panel messages-panel" style={{ ...styles.panel, ...styles.messagesPanel }}>
        <div className="client-message-layout" style={styles.messageLayout}>
          <div>
            <div className="panel-header" style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>{t.messages}</h2>
                <p style={styles.panelSub}>
                  {selectedClient
                    ? formatText(t.conversingWith, { name: selectedClientName })
                    : t.messagesHelp}
                </p>
              </div>
              <button onClick={() => loadMessages()} style={styles.refreshBtn} disabled={messagesLoading || !selectedClient}>
                {messagesLoading ? t.refreshing : t.refresh}
              </button>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>{t.client}</span>
              <select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)} style={styles.input}>
                {clients.map((client) => (
                  <option key={client.username} value={client.username}>
                    {client.name} ({client.username})
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.thread}>
              {messagesLoading ? (
                <p style={styles.emptyText}>{t.loadingMessages}</p>
              ) : messages.length ? (
                messages.map((message) => {
                  const isMine = message.from === user.username;
                  return (
                    <article className="message-bubble" key={message.id} style={{ ...styles.messageBubble, ...(isMine ? styles.myMessage : styles.theirMessage) }}>
                      <div style={styles.messageMeta}>
                        <strong>{isMine ? t.you : selectedClientName}</strong>
                        <span>{formatMessageTime(message.createdAt)}</span>
                      </div>
                      {message.text && <p style={styles.messageText}>{message.text}</p>}
                      {message.image && <img src={message.image} alt="Message attachment" style={styles.messageImage} />}
                    </article>
                  );
                })
              ) : (
                <p style={styles.emptyText}>{t.noMessages}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSendMessage} style={styles.messageForm}>
            <label style={styles.field}>
              <span style={styles.label}>{t.message}</span>
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                style={{ ...styles.input, ...styles.textarea }}
                placeholder={t.writeMessage}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.image}</span>
              <input type="file" accept="image/*" onChange={handleImageChange} style={styles.input} />
            </label>

            {imagePreview && (
              <div style={styles.previewBox}>
                <img src={imagePreview} alt="Selected attachment preview" style={styles.previewImage} />
                <button type="button" onClick={() => setImagePreview("")} style={styles.removeImageBtn}>{t.removeImage}</button>
              </div>
            )}

            <button type="submit" style={styles.createBtn} disabled={sending || !selectedClient || (!messageText.trim() && !imagePreview)}>
              {sending ? t.sending : t.sendMessage}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, helper, compact }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={compact ? styles.metricTextValue : styles.metricValue}>{value}</strong>
      <span style={styles.metricHelper}>{helper}</span>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{value}</strong>
    </div>
  );
}

function formatText(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function getStatusLabel(status, t) {
  const labels = {
    All: t.statusAll,
    "Pending Acceptance": t.statusPendingAcceptance,
    "Funding Pending": t.statusFundingPending,
    "In Review": t.statusInReview,
    "Awaiting Release": t.statusAwaitingRelease,
    Disputed: t.statusDisputed,
    Denied: t.statusDenied,
    Completed: t.statusCompleted,
  };

  return labels[status] || status;
}

function getResponseNote(transaction, t) {
  if (transaction.canRespond) {
    return t.requestPendingCanRespond;
  }

  if (transaction.status === "Pending Acceptance") {
    return t.requestPendingWaiting;
  }

  if (transaction.status === "Denied") {
    return t.requestDenied;
  }

  if (transaction.status === "Completed") {
    return t.transactionCompleted;
  }

  return t.requestActionUnavailable;
}

function getStatusStyle(status) {
  if (status === "Pending Acceptance") return { background: "#fff5d9", color: "#8a5b00" };
  if (status === "Denied") return { background: "#f4e8e8", color: "#8a1f1f" };
  if (status === "Disputed") return { background: "#fdecea", color: "#a82920" };
  if (status === "Completed") return { background: "#e8f4ee", color: "#1f7a52" };
  if (status === "Awaiting Release") return { background: "#fff5d9", color: "#8a5b00" };
  return { background: "#eaf1fb", color: "#285a8f" };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px clamp(16px, 4vw, 48px)",
    background: "#f5f9fb",
  },
  centerPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#f5f9fb",
  },
  emptyBox: {
    width: "100%",
    maxWidth: 520,
    background: "#ffffff",
    borderRadius: 8,
    padding: 32,
    border: "1px solid rgba(20,45,62,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 28,
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#1f8a5e",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#142d3e",
    fontSize: 34,
    lineHeight: 1.1,
  },
  sub: {
    maxWidth: 680,
    margin: "10px 0 0",
    color: "#5f6f83",
    lineHeight: 1.6,
  },
  logoutBtn: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#e64d4d",
    color: "#ffffff",
    fontWeight: 700,
  },
  error: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 10,
    background: "#fdecea",
    color: "#a82920",
    border: "1px solid rgba(168,41,32,0.12)",
  },
  success: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 10,
    background: "#e8f4ee",
    color: "#1f7a52",
    border: "1px solid rgba(31,122,82,0.12)",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid rgba(20,45,62,0.08)",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 16px 45px rgba(20,45,62,0.06)",
  },
  metricLabel: {
    display: "block",
    color: "#6c7887",
    fontSize: 13,
    fontWeight: 700,
  },
  metricValue: {
    display: "block",
    marginTop: 10,
    color: "#142d3e",
    fontSize: 28,
  },
  metricTextValue: {
    display: "block",
    minHeight: 34,
    marginTop: 10,
    color: "#142d3e",
    fontSize: 16,
    lineHeight: 1.4,
  },
  metricHelper: {
    display: "block",
    marginTop: 8,
    color: "#7a8697",
    fontSize: 13,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
    gap: 18,
    alignItems: "start",
  },
  panel: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 20,
    border: "1px solid rgba(20,45,62,0.08)",
    boxShadow: "0 16px 45px rgba(20,45,62,0.06)",
  },
  messagesPanel: {
    marginTop: 18,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    color: "#142d3e",
    fontSize: 20,
  },
  panelSub: {
    margin: "6px 0 0",
    color: "#7a8697",
    fontSize: 13,
  },
  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    background: "#ffffff",
    color: "#142d3e",
    fontWeight: 700,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "0 0 16px",
  },
  filterButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.12)",
    background: "#f7fafb",
    color: "#5f6f83",
    fontSize: 13,
    fontWeight: 700,
  },
  activeFilter: {
    background: "#1f8a5e",
    color: "#ffffff",
    borderColor: "#1f8a5e",
  },
  transactionList: {
    display: "grid",
    gap: 12,
  },
  transactionCard: {
    padding: 16,
    borderRadius: 8,
    background: "#f7fafb",
    border: "1px solid rgba(20,45,62,0.08)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  transactionId: {
    display: "block",
    color: "#1f8a5e",
    fontSize: 13,
    marginBottom: 5,
  },
  transactionTitle: {
    margin: 0,
    color: "#142d3e",
    fontSize: 18,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  responseActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(20,45,62,0.08)",
  },
  responseNote: {
    flexBasis: "100%",
    margin: "0 0 2px",
    color: "#7a8697",
    fontSize: 13,
    lineHeight: 1.5,
  },
  acceptBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#1f8a5e",
    color: "#ffffff",
    fontWeight: 800,
  },
  denyBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(168,41,32,0.18)",
    background: "#fdecea",
    color: "#a82920",
    fontWeight: 800,
  },
  disabledActionBtn: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  detailLabel: {
    display: "block",
    color: "#7a8697",
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    display: "block",
    color: "#142d3e",
    fontSize: 14,
    lineHeight: 1.4,
  },
  form: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  },
  field: {
    display: "grid",
    gap: 7,
  },
  label: {
    color: "#5f6f83",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    color: "#142d3e",
    background: "#ffffff",
  },
  createBtn: {
    marginTop: 4,
    padding: "13px 14px",
    borderRadius: 10,
    border: "none",
    background: "#1f8a5e",
    color: "#ffffff",
    fontWeight: 800,
  },
  inviteBox: {
    display: "grid",
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    background: "#f7fafb",
    border: "1px solid rgba(20,45,62,0.08)",
  },
  inviteTitle: {
    margin: 0,
    color: "#142d3e",
    fontSize: 16,
  },
  inviteText: {
    margin: 0,
    color: "#7a8697",
    fontSize: 13,
    lineHeight: 1.5,
  },
  secondaryActionBtn: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(31,138,94,0.22)",
    background: "#e8f4ee",
    color: "#1f7a52",
    fontWeight: 800,
  },
  inviteLinkRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
  },
  copyBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    background: "#ffffff",
    color: "#142d3e",
    fontWeight: 700,
  },
  emptyText: {
    margin: 0,
    padding: 20,
    color: "#7a8697",
    textAlign: "center",
  },
  messageLayout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
    alignItems: "start",
  },
  thread: {
    display: "grid",
    gap: 12,
    maxHeight: 440,
    overflowY: "auto",
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    background: "#f7fafb",
    border: "1px solid rgba(20,45,62,0.08)",
  },
  messageBubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid rgba(20,45,62,0.08)",
  },
  myMessage: {
    justifySelf: "end",
    background: "#e8f4ee",
  },
  theirMessage: {
    justifySelf: "start",
    background: "#ffffff",
  },
  messageMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#6c7887",
    fontSize: 12,
    marginBottom: 7,
  },
  messageText: {
    margin: 0,
    color: "#142d3e",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  messageImage: {
    display: "block",
    width: "100%",
    maxHeight: 280,
    objectFit: "cover",
    borderRadius: 8,
    marginTop: 10,
  },
  messageForm: {
    display: "grid",
    gap: 14,
    maxWidth: 720,
  },
  textarea: {
    minHeight: 130,
    resize: "vertical",
  },
  previewBox: {
    display: "grid",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    background: "#f7fafb",
    border: "1px solid rgba(20,45,62,0.08)",
  },
  previewImage: {
    width: "100%",
    maxHeight: 220,
    objectFit: "cover",
    borderRadius: 8,
  },
  removeImageBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    background: "#ffffff",
    color: "#142d3e",
    fontWeight: 700,
  },
  linkButton: {
    display: "inline-block",
    marginTop: 20,
    color: "#1f8a5e",
    textDecoration: "none",
    fontWeight: 700,
  },
};
