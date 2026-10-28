// The bindings wrangler.jsonc declares, as the Worker (and `next dev` through
// the platform proxy) sees them, and the secrets and vars the Worker reads.
// Binding names are the example's own.
interface CloudflareEnv {
  /** better-auth's users, sessions, accounts, files and the generated auth secret (Cloudflare D1). */
  DATABASE: D1Database;
  /** better-auth's secondary storage: the sessions, read without a D1 round trip (Workers KV). */
  KV: KVNamespace;
  /** Files signed-in users upload (Cloudflare R2), through the wrapper's R2 plugin. */
  R2_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  /** Overrides the auth secret generated in D1 (app_secrets). */
  BETTER_AUTH_SECRET?: string;
  /** The app's public origin. Unset, it is the request's own. */
  BETTER_AUTH_URL?: string;
  /** Further origins allowed to call the auth API, comma-separated. */
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  /** GitHub sign-in, offered only when both are set. */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** Google sign-in, offered only when both are set. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
