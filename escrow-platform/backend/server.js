require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve React build as static files
const reactBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(reactBuildPath)) {
  app.use(express.static(reactBuildPath));
}

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const JWT_SECRET = process.env.JWT_SECRET || "escrow_secret_key_change_in_prod";

// ─── In-Memory Data Store ────────────────────────────────────────────────────
const db = {
  users: [
    {
      id: "admin-001",
      username: "admin",
      password: bcrypt.hashSync("admin123", 10),
      role: "admin",
      name: "Admin",
    },
    {
      id: "client-001",
      username: "client1",
      password: bcrypt.hashSync("client123", 10),
      role: "client",
      name: "Alice Johnson",
      shortLink: "al7x2",
    },
    {
      id: "client-002",
      username: "client2",
      password: bcrypt.hashSync("client123", 10),
      role: "client",
      name: "Bob Smith",
      shortLink: "bk9m4",
    },
  ],
  transactions: [
    {
      id: "txn-001",
      title: "Website Development Project",
      amount: 5000,
      currency: "USD",
      client1Id: "client-001",
      client2Id: "client-002",
      status: "pending", // pending | approved | released | disputed
      createdAt: new Date().toISOString(),
      approvedBy: [],
    },
  ],
  messages: [],
};

// ─── Multer Storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, uuidv4() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.json({
    token,
    user: { id: user.id, role: user.role, name: user.name, shortLink: user.shortLink },
  });
});

// Short link login
app.get("/api/link/:code", (req, res) => {
  const user = db.users.find((u) => u.shortLink === req.params.code);
  if (!user) return res.status(404).json({ error: "Invalid link" });
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.json({
    token,
    user: { id: user.id, role: user.role, name: user.name, shortLink: user.shortLink },
  });
});

// ─── Transaction Routes ───────────────────────────────────────────────────────
app.get("/api/transactions", auth, (req, res) => {
  if (req.user.role === "admin") return res.json(db.transactions);
  const txns = db.transactions.filter(
    (t) => t.client1Id === req.user.id || t.client2Id === req.user.id
  );
  res.json(txns);
});

app.post("/api/transactions", auth, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  const txn = {
    id: "txn-" + uuidv4().slice(0, 8),
    ...req.body,
    status: "pending",
    createdAt: new Date().toISOString(),
    approvedBy: [],
  };
  db.transactions.push(txn);
  io.emit("transaction_updated", txn);
  res.json(txn);
});

app.post("/api/transactions/:id/approve", auth, (req, res) => {
  const txn = db.transactions.find((t) => t.id === req.params.id);
  if (!txn) return res.status(404).json({ error: "Not found" });

  if (!txn.approvedBy.includes(req.user.id)) {
    txn.approvedBy.push(req.user.id);
  }

  // Check if the OTHER client approved (not the requester)
  const approverId = req.user.id;
  const otherClientId = txn.client1Id === approverId ? txn.client2Id : txn.client1Id;
  const otherApproved = txn.approvedBy.includes(otherClientId);

  if (otherApproved || txn.approvedBy.length >= 2) {
    txn.status = "approved";
    // Notify both clients
    const notifyMsg = {
      id: uuidv4(),
      type: "system",
      text: `✅ Payment of $${txn.amount.toLocaleString()} has been approved and is being released from escrow.`,
      transactionId: txn.id,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(notifyMsg);
    io.emit("system_message", notifyMsg);
  }

  io.emit("transaction_updated", txn);
  res.json(txn);
});

// ─── Message Routes ───────────────────────────────────────────────────────────
app.get("/api/messages", auth, (req, res) => {
  if (req.user.role === "admin") return res.json(db.messages);

  // Get the transaction this client is part of
  const userTxn = db.transactions.find(
    (t) => t.client1Id === req.user.id || t.client2Id === req.user.id
  );
  if (!userTxn) return res.json([]);

  const msgs = db.messages.filter(
    (m) =>
      m.transactionId === userTxn.id ||
      m.type === "system"
  );
  res.json(msgs);
});

app.post("/api/messages", auth, upload.single("image"), (req, res) => {
  const { text, transactionId } = req.body;
  const msg = {
    id: uuidv4(),
    senderId: req.user.id,
    senderName: req.user.name,
    text: text || "",
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    transactionId,
    type: "chat",
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  io.emit("new_message", msg);
  res.json(msg);
});

// ─── Users Route (admin) ──────────────────────────────────────────────────────
app.get("/api/users", auth, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  res.json(
    db.users.map(({ password, ...u }) => u)
  );
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

// ─── Fallback Route (React Router) ────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "../frontend/build/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: "Frontend not built. Run: cd frontend && npm run build" });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🔒 Escrow server running on http://localhost:${PORT}`));
