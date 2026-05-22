BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  username CITEXT UNIQUE NOT NULL CHECK (length(trim(username::TEXT)) >= 3),
  password_hash TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL CHECK (email::TEXT ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  invited_by CITEXT REFERENCES users(username) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS short_links (
  code TEXT PRIMARY KEY CHECK (length(trim(code)) >= 4),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  buyer TEXT NOT NULL CHECK (length(trim(buyer)) > 0),
  seller TEXT NOT NULL CHECK (length(trim(seller)) > 0),
  item TEXT NOT NULL CHECK (length(trim(item)) > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = upper(currency)),
  status TEXT NOT NULL CHECK (status IN (
    'In Review',
    'Awaiting Release',
    'Disputed',
    'Completed',
    'Pending Acceptance',
    'Funding Pending',
    'Denied'
  )),
  risk TEXT NOT NULL CHECK (risk IN ('Low', 'Medium', 'High')),
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at DATE NOT NULL,
  stage TEXT NOT NULL CHECK (length(trim(stage)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_at >= opened_at)
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY CHECK (length(trim(code)) >= 8),
  invited_by CITEXT NOT NULL REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE,
  invited_by_name TEXT NOT NULL CHECK (length(trim(invited_by_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_username CITEXT NOT NULL REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE,
  recipient_username CITEXT NOT NULL REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_username <> recipient_username),
  CHECK (length(trim(text)) > 0 OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_users_role_name ON users (role, name);
CREATE INDEX IF NOT EXISTS idx_short_links_user_id ON short_links (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_lower ON transactions (lower(buyer));
CREATE INDEX IF NOT EXISTS idx_transactions_seller_lower ON transactions (lower(seller));
CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON invites (invited_by);
CREATE INDEX IF NOT EXISTS idx_messages_pair_created_at ON messages (
  sender_username,
  recipient_username,
  created_at
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_created_at ON messages (
  recipient_username,
  sender_username,
  created_at
);

COMMIT;
