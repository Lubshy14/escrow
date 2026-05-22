const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const optionalRequire = (name) => {
  try {
    return require(name);
  } catch (error) {
    return null;
  }
};

const pg = optionalRequire("pg");
const dotenv = optionalRequire("dotenv");
const cloudinaryModule = optionalRequire("cloudinary");
const cloudinary = cloudinaryModule?.v2;

dotenv?.config();

const app = express();
const port = process.env.PORT || 4000;
const databaseUrl = process.env.DATABASE_URL;
const useDatabase = Boolean(databaseUrl && pg);
const seedDemoData = process.env.SEED_DEMO_DATA === "true";
const authSecret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "development-auth-secret-change-me");
const tokenTtlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24);
const useCloudinary = Boolean(
  cloudinary
    && process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
);
const pool = useDatabase ? new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
}) : null;

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length && process.env.NODE_ENV !== "production") return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
}));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "8mb" }));

const users = new Map();
const shortLinks = new Map();
const invites = new Map();
const transactions = [];
const messages = [];
const rateLimitBuckets = new Map();

const makeId = (length = 8) => crypto.randomBytes(length).toString("hex").slice(0, length);
const nowIso = () => new Date().toISOString();
const signTokenPart = (value) => crypto.createHmac("sha256", authSecret).update(value).digest("base64url");
const encodeTokenPart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const createAuthToken = (user) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    role: user.role,
    iat: issuedAt,
    exp: issuedAt + tokenTtlSeconds,
  };
  const body = encodeTokenPart(payload);
  return `${body}.${signTokenPart(body)}`;
};
const verifyAuthToken = (token) => {
  if (!authSecret || !token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = signTokenPart(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (error) {
    return null;
  }
};
const sameIdentity = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$310000$${salt}$${hash}`;
};
const verifyPassword = (password, user) => {
  if (!user?.passwordHash) {
    return user?.password === password;
  }

  try {
    const [scheme, iterations, salt, storedHash] = user.passwordHash.split("$");
    if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !storedHash) return false;

    const storedBuffer = Buffer.from(storedHash, "hex");
    const candidateBuffer = crypto.pbkdf2Sync(password, salt, Number(iterations), storedBuffer.length, "sha256");
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  } catch (error) {
    return false;
  }
};
const rateLimit = ({ windowMs, max, keyPrefix }) => (req, res, next) => {
  const now = Date.now();
  const key = `${keyPrefix}:${req.ip}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (bucket.count >= max) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  bucket.count += 1;
  return next();
};

const normalizeUser = (row) => ({
  id: row.id,
  name: row.name,
  username: row.username,
  passwordHash: row.password_hash || row.passwordHash || null,
  email: row.email,
  role: row.role,
  invitedBy: row.invited_by || row.invitedBy || null,
});

const normalizeTransaction = (row) => ({
  id: row.id,
  buyer: row.buyer,
  seller: row.seller,
  item: row.item,
  amount: Number(row.amount),
  currency: row.currency,
  status: row.status,
  risk: row.risk,
  openedAt: row.opened_at || row.openedAt,
  dueAt: row.due_at || row.dueAt,
  stage: row.stage,
});

const normalizeInvite = (row) => ({
  code: row.code,
  invitedBy: row.invited_by || row.invitedBy,
  invitedByName: row.invited_by_name || row.invitedByName,
  createdAt: row.created_at || row.createdAt,
});

const normalizeMessage = (row) => ({
  id: row.id,
  from: row.sender_username || row.from,
  to: row.recipient_username || row.to,
  text: row.text,
  image: row.image_url || row.image || null,
  createdAt: row.created_at || row.createdAt,
});

const isFinalTransactionStatus = (status) => status === "Completed" || status === "Denied";

const userCanRespondToTransaction = (user, transaction) => {
  return Boolean(
    user?.role === "client"
      && transaction?.status === "Pending Acceptance"
      && (sameIdentity(transaction.seller, user.username) || sameIdentity(transaction.seller, user.name)),
  );
};

const decorateTransactionForUser = (transaction, user) => ({
  ...transaction,
  canRespond: userCanRespondToTransaction(user, transaction),
});

const demoUsers = [
  { name: "Site Admin", username: "admin", password: "admin123", email: "admin@example.com", role: "admin", linkCode: "ad1234" },
  { name: "Amina Otieno", username: "client1", password: "client123", email: "client1@example.com", role: "client", linkCode: "cl1234" },
  { name: "Kenji Sato", username: "client2", password: "client123", email: "client2@example.com", role: "client", linkCode: "cl5678" },
];

const demoTransactions = [
  {
    id: "TX-1048",
    buyer: "Amina Otieno",
    seller: "Nairobi Auto Imports",
    item: "Vehicle import escrow",
    amount: 12400,
    currency: "USD",
    status: "In Review",
    risk: "Medium",
    openedAt: "2026-05-18",
    dueAt: "2026-05-24",
    stage: "Document verification",
  },
  {
    id: "TX-1049",
    buyer: "Mika Tanaka",
    seller: "Kenji Sato",
    item: "Software milestone payment",
    amount: 3850,
    currency: "USD",
    status: "Awaiting Release",
    risk: "Low",
    openedAt: "2026-05-19",
    dueAt: "2026-05-22",
    stage: "Buyer approval",
  },
  {
    id: "TX-1050",
    buyer: "Omondi Holdings",
    seller: "Greenfield Supplies",
    item: "Bulk equipment purchase",
    amount: 28750,
    currency: "USD",
    status: "Disputed",
    risk: "High",
    openedAt: "2026-05-13",
    dueAt: "2026-05-21",
    stage: "Admin mediation",
  },
  {
    id: "TX-1051",
    buyer: "Amina Otieno",
    seller: "Apex Freelance Studio",
    item: "Brand identity package",
    amount: 2100,
    currency: "USD",
    status: "Completed",
    risk: "Low",
    openedAt: "2026-05-10",
    dueAt: "2026-05-17",
    stage: "Funds released",
  },
  {
    id: "TX-1052",
    buyer: "Lagos Retail Group",
    seller: "Kenji Sato",
    item: "Inventory deposit",
    amount: 9400,
    currency: "USD",
    status: "Pending Acceptance",
    risk: "Medium",
    openedAt: "2026-05-20",
    dueAt: "2026-05-25",
    stage: "Seller review",
  },
];

const demoMessages = [
  {
    id: makeId(12),
    from: "client1",
    to: "client2",
    text: "Hi, can you confirm the milestone files before release?",
    image: null,
    createdAt: "2026-05-21T08:15:00.000Z",
  },
  {
    id: makeId(12),
    from: "client2",
    to: "client1",
    text: "Yes, I am reviewing them now and will send feedback shortly.",
    image: null,
    createdAt: "2026-05-21T08:23:00.000Z",
  },
];

const seedMemory = () => {
  users.clear();
  shortLinks.clear();
  invites.clear();
  transactions.splice(0, transactions.length);
  messages.splice(0, messages.length);

  for (const demoUser of demoUsers) {
    const userId = makeId(10);
    const user = {
      id: userId,
      name: demoUser.name,
      username: demoUser.username,
      passwordHash: hashPassword(demoUser.password),
      email: demoUser.email,
      role: demoUser.role,
      invitedBy: null,
    };
    users.set(userId, user);
    shortLinks.set(demoUser.linkCode, userId);
  }

  transactions.push(...demoTransactions);
  messages.push(...demoMessages);
};

const initDatabase = async () => {
  if (!useDatabase) return;

  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schemaSql);

  if (!seedDemoData) return;

  for (const demoUser of demoUsers) {
    const userId = makeId(10);
    await pool.query(
      `INSERT INTO users (id, name, username, password_hash, email, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      [userId, demoUser.name, demoUser.username, hashPassword(demoUser.password), demoUser.email, demoUser.role],
    );

    const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", [demoUser.username]);
    await pool.query(
      `INSERT INTO short_links (code, user_id)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [demoUser.linkCode, rows[0].id],
    );
  }

  for (const transaction of demoTransactions) {
    await pool.query(
      `INSERT INTO transactions (id, buyer, seller, item, amount, currency, status, risk, opened_at, due_at, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        transaction.id,
        transaction.buyer,
        transaction.seller,
        transaction.item,
        transaction.amount,
        transaction.currency,
        transaction.status,
        transaction.risk,
        transaction.openedAt,
        transaction.dueAt,
        transaction.stage,
      ],
    );
  }

  for (const message of demoMessages) {
    await pool.query(
      `INSERT INTO messages (id, sender_username, recipient_username, text, image_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [message.id, message.from, message.to, message.text, message.image, message.createdAt],
    );
  }
};

const ensureBootstrapAdmin = async () => {
  if (!useDatabase) return;

  const { rows } = await pool.query("SELECT COUNT(*)::INT AS count FROM users WHERE role = 'admin'");
  if (rows[0]?.count > 0) return;

  const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME || "Site Admin";

  if (!adminUsername || !adminPassword || !adminEmail) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("No admin account exists. Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_EMAIL for the first production startup.");
    }
    return;
  }

  await pool.query(
    `INSERT INTO users (id, name, username, password_hash, email, role)
     VALUES ($1, $2, $3, $4, $5, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [makeId(10), adminName, adminUsername.trim(), hashPassword(adminPassword), adminEmail.trim().toLowerCase()],
  );
};

const validateRuntimeConfig = () => {
  if (process.env.NODE_ENV !== "production") return;

  const missing = [];
  if (!authSecret) missing.push("AUTH_SECRET");
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!allowedOrigins.length) missing.push("FRONTEND_ORIGIN");

  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (!pg) {
    throw new Error("PostgreSQL dependency is required in production.");
  }
};

seedMemory();

const db = {
  async getUserById(id) {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
      return rows[0] ? normalizeUser(rows[0]) : null;
    }

    return users.get(id) || null;
  },

  async getUserByUsername(username) {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      return rows[0] ? normalizeUser(rows[0]) : null;
    }

    for (const user of users.values()) {
      if (user.username === username) return user;
    }
    return null;
  },

  async getUserByShortCode(code) {
    if (useDatabase) {
      const { rows } = await pool.query(
        `SELECT users.* FROM short_links
         JOIN users ON users.id = short_links.user_id
         WHERE short_links.code = $1`,
        [code],
      );
      return rows[0] ? normalizeUser(rows[0]) : null;
    }

    return users.get(shortLinks.get(code)) || null;
  },

  async listDebugUsers() {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT username, role FROM users ORDER BY created_at");
      return rows;
    }

    return Array.from(users.values()).map((user) => ({
      username: user.username,
      role: user.role,
    }));
  },

  async listClientUsers(exceptUsername) {
    if (useDatabase) {
      const { rows } = await pool.query(
        "SELECT id, name, username, email FROM users WHERE role = 'client' AND username <> $1 ORDER BY name",
        [exceptUsername],
      );
      return rows;
    }

    return Array.from(users.values())
      .filter((user) => user.role === "client" && user.username !== exceptUsername)
      .map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      }));
  },

  async getClientByNameOrUsername(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();
    if (!normalizedValue) return null;

    if (useDatabase) {
      const { rows } = await pool.query(
        `SELECT * FROM users
         WHERE role = 'client'
           AND (LOWER(username) = $1 OR LOWER(name) = $1)`,
        [normalizedValue],
      );
      return rows[0] ? normalizeUser(rows[0]) : null;
    }

    return Array.from(users.values()).find((user) => (
      user.role === "client"
        && (
          String(user.username || "").trim().toLowerCase() === normalizedValue
          || String(user.name || "").trim().toLowerCase() === normalizedValue
        )
    )) || null;
  },

  async createUser({ name, username, password, email, invitedBy }) {
    const user = {
      id: makeId(10),
      name,
      username,
      passwordHash: hashPassword(password),
      email,
      role: "client",
      invitedBy: invitedBy || null,
    };

    if (useDatabase) {
      await pool.query(
        `INSERT INTO users (id, name, username, password_hash, email, role, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, user.name, user.username, user.passwordHash, user.email, user.role, user.invitedBy],
      );
    } else {
      users.set(user.id, user);
    }

    return user;
  },

  async createShortLink(code, userId) {
    if (useDatabase) {
      await pool.query(
        "INSERT INTO short_links (code, user_id) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET user_id = EXCLUDED.user_id",
        [code, userId],
      );
    } else {
      shortLinks.set(code, userId);
    }
  },

  async listTransactions() {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC, id DESC");
      return rows.map(normalizeTransaction);
    }

    return transactions;
  },

  async getTransactionById(id) {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT * FROM transactions WHERE id = $1", [id]);
      return rows[0] ? normalizeTransaction(rows[0]) : null;
    }

    return transactions.find((transaction) => transaction.id === id) || null;
  },

  async getClientTransactions(username) {
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const userNames = [user.name, user.username]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    if (useDatabase) {
      const { rows } = await pool.query(
        `SELECT * FROM transactions
         WHERE LOWER(buyer) = ANY($1)
            OR LOWER(seller) = ANY($1)
         ORDER BY created_at DESC, id DESC`,
        [userNames],
      );
      return rows.map(normalizeTransaction);
    }

    return transactions.filter((transaction) => {
      const buyer = String(transaction.buyer || "").trim().toLowerCase();
      const seller = String(transaction.seller || "").trim().toLowerCase();
      return userNames.includes(buyer) || userNames.includes(seller);
    });
  },

  async nextTransactionId() {
    const allTransactions = await this.listTransactions();
    const highestNumber = allTransactions.reduce((highest, transaction) => {
      const number = Number(transaction.id.replace("TX-", ""));
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 1000);

    return `TX-${highestNumber + 1}`;
  },

  async createTransaction(transaction) {
    if (useDatabase) {
      await pool.query(
        `INSERT INTO transactions (id, buyer, seller, item, amount, currency, status, risk, opened_at, due_at, stage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          transaction.id,
          transaction.buyer,
          transaction.seller,
          transaction.item,
          transaction.amount,
          transaction.currency,
          transaction.status,
          transaction.risk,
          transaction.openedAt,
          transaction.dueAt,
          transaction.stage,
        ],
      );
    } else {
      transactions.unshift(transaction);
    }

    return transaction;
  },

  async respondToTransaction(id, status, stage) {
    if (useDatabase) {
      const { rows } = await pool.query(
        "UPDATE transactions SET status = $1, stage = $2 WHERE id = $3 RETURNING *",
        [status, stage, id],
      );
      return rows[0] ? normalizeTransaction(rows[0]) : null;
    }

    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return null;

    transaction.status = status;
    transaction.stage = stage;
    return transaction;
  },

  async deleteTransaction(id) {
    if (useDatabase) {
      const { rows } = await pool.query("DELETE FROM transactions WHERE id = $1 RETURNING *", [id]);
      return rows[0] ? normalizeTransaction(rows[0]) : null;
    }

    const index = transactions.findIndex((transaction) => transaction.id === id);
    if (index === -1) return null;

    const [deletedTransaction] = transactions.splice(index, 1);
    return deletedTransaction;
  },

  async createInvite(invite) {
    if (useDatabase) {
      await pool.query(
        "INSERT INTO invites (code, invited_by, invited_by_name, created_at) VALUES ($1, $2, $3, $4)",
        [invite.code, invite.invitedBy, invite.invitedByName, invite.createdAt],
      );
    } else {
      invites.set(invite.code, invite);
    }

    return invite;
  },

  async getInvite(code) {
    if (useDatabase) {
      const { rows } = await pool.query("SELECT * FROM invites WHERE code = $1", [code]);
      return rows[0] ? normalizeInvite(rows[0]) : null;
    }

    return invites.get(code) || null;
  },

  async getConversationMessages(username, otherUsername) {
    if (useDatabase) {
      const { rows } = await pool.query(
        `SELECT * FROM messages
         WHERE (sender_username = $1 AND recipient_username = $2)
            OR (sender_username = $2 AND recipient_username = $1)
         ORDER BY created_at ASC`,
        [username, otherUsername],
      );
      return rows.map(normalizeMessage);
    }

    return messages.filter((message) => (
      (message.from === username && message.to === otherUsername)
        || (message.from === otherUsername && message.to === username)
    ));
  },

  async createMessage(message) {
    if (useDatabase) {
      await pool.query(
        `INSERT INTO messages (id, sender_username, recipient_username, text, image_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [message.id, message.from, message.to, message.text, message.image, message.createdAt],
      );
    } else {
      messages.push(message);
    }

    return message;
  },
};

const uploadMessageImage = async (image) => {
  if (!image) return null;

  if (!String(image).startsWith("data:image/")) {
    const error = new Error("Only image attachments are supported.");
    error.statusCode = 400;
    throw error;
  }

  if (!useCloudinary) return image;

  const result = await cloudinary.uploader.upload(image, {
    folder: process.env.CLOUDINARY_MESSAGE_FOLDER || "escrow/messages",
    resource_type: "image",
  });

  return result.secure_url;
};

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "auth" });

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const requireAuth = (...roles) => asyncHandler(async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  const payload = scheme === "Bearer" ? verifyAuthToken(token) : null;

  if (!payload) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const user = await db.getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (roles.length && !roles.includes(user.role)) {
    return res.status(403).json({ error: "You do not have permission to access this resource." });
  }

  req.user = user;
  return next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    database: useDatabase ? "postgresql" : "memory",
    imageStorage: useCloudinary ? "cloudinary" : "memory",
  });
});

if (process.env.ENABLE_DEBUG_USERS === "true") {
  app.get("/debug/users", requireAuth("admin"), asyncHandler(async (req, res) => {
    return res.json(await db.listDebugUsers());
  }));
}

app.get("/api/admin/transactions", requireAuth("admin"), asyncHandler(async (req, res) => {
  const allTransactions = await db.listTransactions();
  const totalValue = allTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const openTransactions = allTransactions.filter((transaction) => !isFinalTransactionStatus(transaction.status)).length;
  const highRisk = allTransactions.filter((transaction) => transaction.risk === "High").length;
  const pendingRelease = allTransactions.filter((transaction) => transaction.status === "Awaiting Release").length;
  const pendingAcceptance = allTransactions.filter((transaction) => transaction.status === "Pending Acceptance").length;

  return res.json({
    summary: {
      totalValue,
      openTransactions,
      highRisk,
      pendingRelease,
      pendingAcceptance,
    },
    transactions: allTransactions,
  });
}));

app.delete("/api/admin/transactions/:id", requireAuth("admin"), asyncHandler(async (req, res) => {
  const deletedTransaction = await db.deleteTransaction(req.params.id);

  if (!deletedTransaction) {
    return res.status(404).json({ error: "Transaction not found." });
  }

  return res.json({ transaction: deletedTransaction });
}));

app.get("/api/client/transactions", requireAuth("client"), asyncHandler(async (req, res) => {
  const user = req.user;
  const clientTransactions = await db.getClientTransactions(user.username);

  if (!user || !clientTransactions) {
    return res.status(404).json({ error: "Client not found." });
  }

  const decoratedTransactions = clientTransactions.map((transaction) => decorateTransactionForUser(transaction, user));
  const activeTransactions = decoratedTransactions.filter((transaction) => !isFinalTransactionStatus(transaction.status)).length;
  const totalValue = decoratedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const pendingAction = decoratedTransactions.filter((transaction) => (
    transaction.status === "Pending Acceptance"
      || transaction.status === "Awaiting Release"
      || transaction.status === "Funding Pending"
  )).length;

  return res.json({
    summary: {
      activeTransactions,
      totalValue,
      pendingAction,
    },
    transactions: decoratedTransactions,
  });
}));

app.post("/api/client/transactions", requireAuth("client"), asyncHandler(async (req, res) => {
  const { seller, item, amount, dueAt } = req.body;
  const user = req.user;
  const sellerUser = await db.getClientByNameOrUsername(seller);
  const parsedAmount = Number(amount);

  if (!sellerUser || sellerUser.username === user.username) {
    return res.status(400).json({ error: "Choose another registered client to receive this request." });
  }

  if (!seller || !item || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !dueAt) {
    return res.status(400).json({ error: "Seller, item, amount, and due date are required." });
  }

  const transaction = {
    id: await db.nextTransactionId(),
    buyer: user.name || user.username,
    seller: sellerUser.name || sellerUser.username,
    item: item.trim(),
    amount: parsedAmount,
    currency: "USD",
    status: "Pending Acceptance",
    risk: parsedAmount > 10000 ? "Medium" : "Low",
    openedAt: new Date().toISOString().slice(0, 10),
    dueAt,
    stage: "Seller review",
  };

  const createdTransaction = await db.createTransaction(transaction);
  return res.status(201).json({ transaction: decorateTransactionForUser(createdTransaction, user) });
}));

app.patch("/api/client/transactions/:id/respond", requireAuth("client"), asyncHandler(async (req, res) => {
  const { decision } = req.body;
  const user = req.user;
  const transaction = await db.getTransactionById(req.params.id);

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found." });
  }

  if (!userCanRespondToTransaction(user, transaction)) {
    return res.status(403).json({ error: "Only the receiving seller can respond to this request." });
  }

  if (decision !== "accept" && decision !== "deny") {
    return res.status(400).json({ error: "Decision must be accept or deny." });
  }

  const accepted = decision === "accept";
  const nextTransaction = await db.respondToTransaction(
    transaction.id,
    accepted ? "Funding Pending" : "Denied",
    accepted ? "Accepted by seller - awaiting funding" : "Denied by seller",
  );

  return res.json({ transaction: decorateTransactionForUser(nextTransaction, user) });
}));

app.get("/api/client/users", requireAuth("client"), asyncHandler(async (req, res) => {
  return res.json({ clients: await db.listClientUsers(req.user.username) });
}));

app.get("/api/client/messages", requireAuth("client"), asyncHandler(async (req, res) => {
  const { otherUsername } = req.query;
  const username = req.user.username;

  if (!await db.getUserByUsername(username) || !await db.getUserByUsername(otherUsername)) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  return res.json({
    messages: await db.getConversationMessages(username, otherUsername),
  });
}));

app.post("/api/client/messages", requireAuth("client"), asyncHandler(async (req, res) => {
  const { to, text, image } = req.body;
  const from = req.user.username;
  const sender = req.user;
  const recipient = await db.getUserByUsername(to);
  const trimmedText = text?.trim() || "";

  if (!sender || !recipient || sender.role !== "client" || recipient.role !== "client") {
    return res.status(404).json({ error: "Sender or recipient not found." });
  }

  if (!trimmedText && !image) {
    return res.status(400).json({ error: "Message text or an image is required." });
  }

  const imageUrl = await uploadMessageImage(image);
  const message = {
    id: makeId(12),
    from,
    to,
    text: trimmedText,
    image: imageUrl,
    createdAt: nowIso(),
  };

  return res.status(201).json({ message: await db.createMessage(message) });
}));

app.post("/api/client/invites", requireAuth("client"), asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user || user.role !== "client") {
    return res.status(404).json({ error: "Client not found." });
  }

  const code = makeId(10);
  await db.createInvite({
    code,
    invitedBy: user.username,
    invitedByName: user.name || user.username,
    createdAt: nowIso(),
  });

  return res.status(201).json({
    code,
    invitedByName: user.name || user.username,
    path: `/register?invite=${code}`,
  });
}));

app.get("/api/invites/:code", asyncHandler(async (req, res) => {
  const invite = await db.getInvite(req.params.code);

  if (!invite) {
    return res.status(404).json({ error: "Invite not found." });
  }

  return res.json({ invite });
}));

app.post("/api/auth/register", authRateLimit, asyncHandler(async (req, res) => {
  const { name, username, password, email, inviteCode } = req.body;
  if (!name || !username || !password || !email) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (await db.getUserByUsername(username)) {
    return res.status(400).json({ error: "Username already exists." });
  }

  const invite = inviteCode ? await db.getInvite(inviteCode) : null;
  const user = await db.createUser({
    name: name.trim(),
    username: username.trim(),
    password,
    email: email.trim().toLowerCase(),
    invitedBy: invite?.invitedBy || null,
  });
  const token = createAuthToken(user);
  const linkCode = makeId(6);
  await db.createShortLink(linkCode, user.id);

  if (invite) {
    await db.createMessage({
      id: makeId(12),
      from: invite.invitedBy,
      to: user.username,
      text: `Welcome to escrow, ${user.name}. I sent you this invite so we can coordinate here.`,
      image: null,
      createdAt: nowIso(),
    });
  }

  return res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
    linkCode,
  });
}));

app.post("/api/auth/login", authRateLimit, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await db.getUserByUsername(username);

  if (!user || !verifyPassword(password, user)) {
    return res.status(400).json({ error: "Invalid username or password." });
  }

  const token = createAuthToken(user);
  return res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
  });
}));

app.get("/api/link/:code", authRateLimit, asyncHandler(async (req, res) => {
  if (process.env.ENABLE_SHORT_LINK_LOGIN !== "true") {
    return res.status(404).json({ error: "Link login is disabled." });
  }

  const user = await db.getUserByShortCode(req.params.code);

  if (!user) {
    return res.status(404).json({ error: "Link not found." });
  }

  const token = createAuthToken(user);
  return res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } });
}));

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("/", (req, res) => {
  res.json({ message: "Escrow backend running" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message || "Server error." });
});

Promise.resolve()
  .then(validateRuntimeConfig)
  .then(initDatabase)
  .then(ensureBootstrapAdmin)
  .then(() => {
    app.listen(port, () => {
      console.log(`Escrow backend listening on http://localhost:${port}`);
      console.log(`Database: ${useDatabase ? "PostgreSQL" : "in-memory fallback"}`);
      console.log(`Image storage: ${useCloudinary ? "Cloudinary" : "in-memory/base64 fallback"}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize backend storage", error);
    process.exit(1);
  });
