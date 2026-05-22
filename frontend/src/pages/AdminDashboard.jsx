import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const statuses = ["All", "Pending Acceptance", "Funding Pending", "In Review", "Awaiting Release", "Disputed", "Denied", "Completed"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeStatus, setActiveStatus] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let ignore = false;

    const loadTransactions = async () => {
      setLoading(true);
      setError("");

      try {
        const { data } = await axios.get("/api/admin/transactions");
        if (!ignore) {
          setTransactions(data.transactions || []);
          setSummary(data.summary || null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Unable to load transactions.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    if (user?.role === "admin") {
      loadTransactions();
    }

    return () => {
      ignore = true;
    };
  }, [user]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesStatus = activeStatus === "All" || transaction.status === activeStatus;
      const searchable = [
        transaction.id,
        transaction.buyer,
        transaction.seller,
        transaction.item,
        transaction.stage,
      ].join(" ").toLowerCase();

      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [activeStatus, query, transactions]);

  const riskQueue = useMemo(() => (
    transactions
      .filter((transaction) => transaction.risk !== "Low" || transaction.status === "Disputed")
      .slice(0, 3)
  ), [transactions]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleClearTransaction = async (transaction) => {
    const confirmed = window.confirm(`Clear transaction ${transaction.id}? This removes it from admin and client dashboards.`);
    if (!confirmed) return;

    setClearingId(transaction.id);
    setError("");

    try {
      await axios.delete(`/api/admin/transactions/${transaction.id}`);
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      const { data } = await axios.get("/api/admin/transactions");
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to clear transaction.");
    } finally {
      setClearingId("");
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="app-page admin-page" style={styles.page}>
      <header className="admin-dashboard-header" style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Escrow middleman</p>
          <h1 style={styles.title}>Transaction Control Room</h1>
          <p style={styles.sub}>Monitor every request between clients, from seller acceptance through funding, review, release, disputes, and denials.</p>
        </div>

        <div style={styles.headerActions}>
          <Link to="/dashboard" style={styles.secondaryButton}>Client view</Link>
          <button onClick={handleLogout} style={styles.logoutButton}>Sign out</button>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <section className="metric-grid" style={styles.metricGrid}>
        <Metric label="Escrow volume" value={money.format(summary?.totalValue || 0)} helper="Across monitored deals" />
        <Metric label="Open transactions" value={summary?.openTransactions || 0} helper="Still requiring attention" />
        <Metric label="Pending acceptance" value={summary?.pendingAcceptance || 0} helper="Waiting on sellers" />
        <Metric label="High risk" value={summary?.highRisk || 0} helper="Needs admin action" tone="danger" />
      </section>

      <main className="admin-dashboard-content" style={styles.contentGrid}>
        <section className="app-panel" style={styles.panel}>
          <div className="admin-panel-header" style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Transactions</h2>
              <p style={styles.panelSub}>{filteredTransactions.length} records shown</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search buyer, seller, ID"
              style={styles.search}
            />
          </div>

          <div style={styles.filters}>
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                style={{
                  ...styles.filterButton,
                  ...(activeStatus === status ? styles.activeFilter : null),
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="admin-table-wrap" style={styles.tableWrap}>
            <table className="admin-table" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Transaction</th>
                  <th style={styles.th}>Parties</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Middleman Stage</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={styles.empty}>Loading transactions...</td>
                  </tr>
                ) : filteredTransactions.length ? (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td data-label="Transaction" style={styles.td}>
                        <strong style={styles.transactionId}>{transaction.id}</strong>
                        <span style={styles.muted}>{transaction.item}</span>
                      </td>
                      <td data-label="Parties" style={styles.td}>
                        <span style={styles.party}>{transaction.buyer}</span>
                        <span style={styles.muted}>to {transaction.seller}</span>
                      </td>
                      <td data-label="Amount" style={styles.td}>{money.format(transaction.amount)}</td>
                      <td data-label="Status" style={styles.td}>
                        <span style={{ ...styles.badge, ...getStatusStyle(transaction.status) }}>{transaction.status}</span>
                      </td>
                      <td data-label="Middleman Stage" style={styles.td}>
                        <span style={styles.party}>{transaction.stage}</span>
                        <span>{formatDate(transaction.dueAt)}</span>
                        <span style={{ ...styles.risk, ...getRiskStyle(transaction.risk) }}>{transaction.risk}</span>
                      </td>
                      <td data-label="Actions" style={styles.td}>
                        <button
                          type="button"
                          onClick={() => handleClearTransaction(transaction)}
                          style={styles.clearButton}
                          disabled={clearingId === transaction.id}
                        >
                          {clearingId === transaction.id ? "Clearing..." : "Clear"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={styles.empty}>No transactions match this view.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="app-panel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Risk Queue</h2>
          <p style={styles.panelSub}>Items most likely to need admin follow-up.</p>

          <div style={styles.queueList}>
            {riskQueue.map((transaction) => (
              <div key={transaction.id} style={styles.queueItem}>
                <div style={styles.queueTop}>
                  <strong>{transaction.id}</strong>
                  <span style={{ ...styles.risk, ...getRiskStyle(transaction.risk) }}>{transaction.risk}</span>
                </div>
                <p style={styles.queueTitle}>{transaction.item}</p>
                <p style={styles.queueMeta}>{transaction.stage} - due {formatDate(transaction.dueAt)}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Metric({ label, value, helper, tone }) {
  return (
    <div style={{ ...styles.metricCard, ...(tone === "danger" ? styles.metricDanger : null) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricHelper}>{helper}</span>
    </div>
  );
}

function getStatusStyle(status) {
  if (status === "Pending Acceptance") return { background: "#fff5d9", color: "#8a5b00" };
  if (status === "Denied") return { background: "#f4e8e8", color: "#8a1f1f" };
  if (status === "Disputed") return { background: "#fdecea", color: "#a82920" };
  if (status === "Completed") return { background: "#e8f4ee", color: "#1f7a52" };
  if (status === "Awaiting Release") return { background: "#fff5d9", color: "#8a5b00" };
  return { background: "#eaf1fb", color: "#285a8f" };
}

function getRiskStyle(risk) {
  if (risk === "High") return { background: "#fdecea", color: "#a82920" };
  if (risk === "Medium") return { background: "#fff5d9", color: "#8a5b00" };
  return { background: "#e8f4ee", color: "#1f7a52" };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px clamp(16px, 4vw, 48px)",
    background: "#f5f9fb",
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
  headerActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    background: "#ffffff",
    color: "#142d3e",
    textDecoration: "none",
    fontWeight: 700,
  },
  logoutButton: {
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
  metricDanger: {
    borderColor: "rgba(168,41,32,0.18)",
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
  metricHelper: {
    display: "block",
    marginTop: 8,
    color: "#7a8697",
    fontSize: 13,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 340px)",
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
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
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
  search: {
    width: 240,
    maxWidth: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(20,45,62,0.14)",
    color: "#142d3e",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "18px 0",
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
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    textAlign: "left",
    color: "#7a8697",
    fontSize: 12,
    padding: "12px 10px",
    borderBottom: "1px solid rgba(20,45,62,0.1)",
  },
  td: {
    padding: "15px 10px",
    borderBottom: "1px solid rgba(20,45,62,0.07)",
    color: "#142d3e",
    verticalAlign: "top",
  },
  transactionId: {
    display: "block",
    marginBottom: 5,
  },
  party: {
    display: "block",
    fontWeight: 700,
    marginBottom: 5,
  },
  muted: {
    display: "block",
    color: "#7a8697",
    fontSize: 13,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  risk: {
    display: "inline-flex",
    marginTop: 7,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  clearButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(168,41,32,0.18)",
    background: "#fdecea",
    color: "#a82920",
    fontWeight: 800,
  },
  empty: {
    padding: 28,
    textAlign: "center",
    color: "#7a8697",
  },
  queueList: {
    display: "grid",
    gap: 12,
    marginTop: 18,
  },
  queueItem: {
    padding: 14,
    borderRadius: 8,
    background: "#f7fafb",
    border: "1px solid rgba(20,45,62,0.08)",
  },
  queueTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  queueTitle: {
    margin: "10px 0 4px",
    color: "#142d3e",
    fontWeight: 700,
  },
  queueMeta: {
    margin: 0,
    color: "#7a8697",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
