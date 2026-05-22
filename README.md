# Escrow Platform

Escrow Platform is a demo full-stack app for monitoring escrow transactions, creating client deals, sharing invite links, and sending client-to-client messages with optional image attachments.

## Quick Start

Install dependencies for each app:

```bash
cd backend
npm install
cd ../frontend
npm install
```

Run the API and frontend in separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:3000` and proxies API requests to `http://localhost:4000`.

## Demo Accounts

- Admin: `admin` / `admin123`
- Client: `client1` / `client123`
- Client: `client2` / `client123`

Short-link login examples:

- `/l/ad1234`
- `/l/cl1234`

## Production Database

Use PostgreSQL for production. The backend applies `backend/schema.sql` on startup when `DATABASE_URL` is set.

Recommended environment:

```bash
NODE_ENV=production
AUTH_SECRET=replace_with_a_long_random_secret
AUTH_TOKEN_TTL_SECONDS=86400
FRONTEND_ORIGIN=https://your-domain.example
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=true
SEED_DEMO_DATA=false
ENABLE_DEBUG_USERS=false
ENABLE_SHORT_LINK_LOGIN=false
BOOTSTRAP_ADMIN_NAME=Site Admin
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=replace_with_a_strong_password
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
```

The schema creates validated tables for users, short links, escrow transactions, invites, and messages, with uniqueness rules, foreign keys, check constraints, and indexes for the main dashboard/message queries. Passwords are stored as PBKDF2 hashes.

For local demos only, set `SEED_DEMO_DATA=true` before starting the backend.

In production, the server refuses to start without `AUTH_SECRET`, `DATABASE_URL`, and `FRONTEND_ORIGIN`. API routes validate signed bearer tokens server-side, admin/client routes enforce roles, and browser-supplied usernames are not trusted for authorization.

On a fresh production database, set the `BOOTSTRAP_ADMIN_*` variables for the first startup so the app can create the initial admin account. After the admin exists, remove the bootstrap password from your host environment.

## Optional Services

Cloudinary can be used for production image storage:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` enable Cloudinary image uploads.

Copy `backend/.env.example` for a starting point.
