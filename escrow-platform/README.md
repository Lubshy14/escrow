# VaultEscrow Platform

A full-stack escrow platform with real-time messaging, image sharing, and payment approval workflows.

## Project Structure

```
escrow-platform/
├── backend/          ← Node.js + Express + Socket.IO
│   ├── server.js
│   ├── package.json
│   └── uploads/      ← auto-created for image storage
└── frontend/         ← React
    ├── public/
    └── src/
        ├── App.js
        ├── index.css
        ├── context/AuthContext.js
        └── pages/
            ├── Login.js
            ├── LinkLogin.js
            ├── ClientDashboard.js
            └── AdminDashboard.js
```

## Setup in VS Code

### Step 1 — Install backend dependencies
Open a terminal in VS Code (Ctrl+`) and run:
```bash
cd escrow-platform/backend
npm install
```

### Step 2 — Install frontend dependencies
Open a second terminal:
```bash
cd escrow-platform/frontend
npm install
```

### Step 3 — Start the backend
In the first terminal:
```bash
npm run dev
# Server runs on http://localhost:5000
```

### Step 4 — Start the frontend
In the second terminal:
```bash
npm start
# App runs on http://localhost:3000
```

---

## Login Credentials

| Role    | Username | Password   |
|---------|----------|------------|
| Admin   | admin    | admin123   |
| Client 1 (Alice) | client1 | client123 |
| Client 2 (Bob)   | client2 | client123 |

## Short Links (no password needed)

| Client | Link |
|--------|------|
| Alice  | http://localhost:3000/l/al7x2 |
| Bob    | http://localhost:3000/l/bk9m4 |

---

## Features

### Client Dashboard
- View escrow balance ("Escrow holds $X")
- Real-time chat with the other party
- Send text messages and images
- Approve payment release
- Instant notification when both parties approve

### Admin Dashboard
- Overview: total funds, message count, client links
- **Messages tab**: View ALL messages + images from both clients
- **Transactions tab**: Monitor all escrow holdings and approval status
- **Create tab**: Set up new escrow transactions
- Copy client short links to share

### Real-time
- Messages appear instantly via Socket.IO
- Payment approval triggers a system message to both clients
- Transaction status updates live

---

## Customisation

### Add more clients
Edit `db.users` in `backend/server.js` — add a new entry with a unique `shortLink`.

### Persistent storage
Replace the in-memory `db` object with a database (SQLite, MongoDB, PostgreSQL).
Recommended: use `better-sqlite3` for a zero-config local database.

### Environment variables
Create `backend/.env`:
```
PORT=5000
JWT_SECRET=your_very_secret_key_here
```
