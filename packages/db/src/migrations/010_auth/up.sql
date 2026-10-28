-- better-auth's tables, as better-auth-cloudflare's OpenNext example declares
-- them (src/db/auth.schema.ts; plural names, `usePlural: true`): the end state
-- of the example's three drizzle-kit migrations (0000, 0001 — the defaults
-- and indexes — and 0002, the rate-limit table), written idempotently so the
-- local apply (`pnpm db:migrate:local`) can run twice. The wrapper adds the
-- geolocation columns on `sessions` and the R2 plugin's `user_files`;
-- `rate_limits` is better-auth's own, because the example keeps its rate
-- limits in the database. Timestamps are milliseconds since the epoch.
-- Owner: app
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER DEFAULT false NOT NULL,
  image TEXT,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  updated_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  is_anonymous INTEGER DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  timezone TEXT,
  city TEXT,
  country TEXT,
  region TEXT,
  region_code TEXT,
  colo TEXT,
  latitude TEXT,
  longitude TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_unique ON sessions (token);
CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts (user_id);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  updated_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier);

CREATE TABLE IF NOT EXISTS user_files (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  category TEXT,
  is_public INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  last_request INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_unique ON rate_limits (key);
