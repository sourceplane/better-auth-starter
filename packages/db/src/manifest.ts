import type { MigrationManifest } from "./types.js";

// Every migration the runner applies, in order, with the sha256 of its file.
// `pnpm --filter @saas/db run manifest:check` verifies the checksums;
// `manifest:fix` rewrites them after a migration file changes (only ever
// before that migration has been applied anywhere — an applied migration's
// checksum is immutable).
export const manifest: MigrationManifest = {
  version: 1,
  migrations: [
    {
      id: "000_control_baseline",
      context: "control",
      path: "000_control/up.sql",
      checksum:
        "c7f11499fa82d6fd2baa1af7fc75eeb73cd7be252af2e56841509c66001d638b",
      description:
        "Baseline control migration — creates the migration tracking schema",
    },
    {
      id: "010_auth",
      context: "app",
      path: "010_auth/up.sql",
      checksum: "16034b1988d6884551fade416a4971d96de73860d717e9b4fcae315e2318cdf7",
      description:
        "better-auth's tables (users, sessions with the wrapper's geolocation, accounts, verifications, rate limits) and the R2 plugin's user_files",
    },
    {
      id: "020_app_secrets",
      context: "app",
      path: "020_app_secrets/up.sql",
      checksum: "8c6a9775a68d0e07d5413581df21bd58a60d4a9cc7cb7bea44b8b13a9a6918b2",
      description:
        "The secret better-auth signs sessions and tokens with, generated once per database and never typed",
    },
  ],
};
