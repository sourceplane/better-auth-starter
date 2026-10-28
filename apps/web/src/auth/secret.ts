// The secret better-auth signs session cookies and tokens with.
//
// The example asked its owner to type a BETTER_AUTH_SECRET into .dev.vars and
// the dashboard. Here the `020_app_secrets` migration generates one per
// database (32 random bytes, once, never rotated by a re-run), so a fresh
// deploy signs users in with nothing typed; a BETTER_AUTH_SECRET Worker secret
// still wins. Read once per isolate.
type Env = Pick<CloudflareEnv, "DATABASE" | "BETTER_AUTH_SECRET">;

let cached: string | undefined;

export async function authSecret(env: Env): Promise<string> {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (cached) return cached;
  let row: { value: string } | null;
  try {
    row = await env.DATABASE.prepare("SELECT value FROM app_secrets WHERE name = ?").bind("auth").first<{ value: string }>();
  } catch (err) {
    throw new Error(
      `the auth secret could not be read from D1 (${err instanceof Error ? err.message : String(err)}): apply the migrations (pnpm db:migrate:local, or the db-migrate lane)`,
    );
  }
  if (!row?.value) throw new Error('no "auth" secret in app_secrets: apply the migrations (pnpm db:migrate:local, or the db-migrate lane)');
  cached = row.value;
  return cached;
}

/** Test seam: forget the cached secret. */
export function resetAuthSecret(): void {
  cached = undefined;
}
