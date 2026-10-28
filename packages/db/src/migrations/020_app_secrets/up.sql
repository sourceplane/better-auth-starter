-- The secret better-auth signs its session cookies and tokens with, generated
-- once per database and never typed: the example asked its owner to put a
-- BETTER_AUTH_SECRET in .dev.vars and the dashboard by hand. Read by the Worker
-- (apps/web/src/auth/secret.ts); a BETTER_AUTH_SECRET Worker secret wins.
-- INSERT OR IGNORE, so a re-run never rotates it — rotating it signs every
-- user out.
-- Owner: app
CREATE TABLE IF NOT EXISTS app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO app_secrets (name, value) VALUES ('auth', lower(hex(randomblob(32))));
