# Design — better-auth-starter

## What the example is

`examples/opennextjs` in zpg6/better-auth-cloudflare: a Next.js app on
`@opennextjs/cloudflare` whose `src/auth/index.ts` builds a better-auth
instance with `withCloudflare(...)` from `better-auth-cloudflare`:

- **D1** through Drizzle (`drizzle-orm/d1`, `@better-auth/drizzle-adapter`,
  plural table names) — `users`, `sessions`, `accounts`, `verifications`,
  `user_files`, `rate_limits`;
- **Workers KV** as better-auth's secondary storage — the sessions, read on
  every request without a D1 round trip;
- **R2** for files a signed-in user uploads (`user_files` records them), with
  upload and download hooks deciding who may do what;
- **geolocation** — every session records the request's `cf` country, city,
  region, timezone, colo and coordinates;
- the `anonymous` and `openAPI` plugins: sign in with no personal data, and
  `/api/auth/reference` documents every endpoint.

The pages: `/` (sign in), `/dashboard` (user, geolocation and file-upload
tabs), and a middleware that sends a signed-in visitor from `/` to
`/dashboard` and a signed-out one back, by asking the app's own
`/api/auth/get-session`.

## How it maps

| Upstream | Here |
|---|---|
| `wrangler.toml` with placeholder ids | `wrangler.template.jsonc` → `wrangler.jsonc`, rendered per environment from the Terraform roots' wiring documents (`tooling/wire`) |
| `better-auth-cloudflare: file:../../` (the repository's own build) | `better-auth-cloudflare@0.4.1` from npm, exact; `better-auth` and `@better-auth/drizzle-adapter` at `1.7.3`, exact — the versions the wrapper's own tests run |
| drizzle-kit migrations applied with `wrangler d1 migrations apply` | `packages/db` migrations (`010_auth`: the three drizzle files' end state), applied by `infra/db-migrate` over D1's REST API before the Worker deploys |
| `BETTER_AUTH_SECRET` typed into `.dev.vars` | generated once per database by the `020_app_secrets` migration (`lower(hex(randomblob(32)))`); a `BETTER_AUTH_SECRET` Worker secret wins |
| `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` vars | optional; unset, the base URL is the request's own origin |
| anonymous sign-in only | anonymous, plus email and password (better-auth's `emailAndPassword`), plus GitHub and Google when `GITHUB_CLIENT_ID`/`_SECRET` or `GOOGLE_CLIENT_ID`/`_SECRET` are stored (optional Orun secrets → Worker secrets) |
| `next lint`, `eslint`/`typescript` errors ignored in the build | the build checks nothing it does not need; `pnpm lint` and `pnpm typecheck` are their own lanes |
| `middleware.ts` | `proxy.ts` (Next.js 16's name), the same self-request to `/api/auth/get-session` |
| `[placement] mode = "smart"` | dropped: the Worker talks to D1, KV and R2 in its own account |

## The wiring flow

```
infra/terraform/cloudflare-d1 ─apply─► WIRING_CLOUDFLARE_D1 ─┬─► infra/db-migrate (apply: the migrations)
infra/terraform/cloudflare-kv ─apply─► WIRING_CLOUDFLARE_KV ─┤
infra/terraform/cloudflare-r2 ─apply─► WIRING_CLOUDFLARE_R2 ─┴─► apps/web (build: wrangler.jsonc with the ids) → deploy
```

Each reader `dependsOn` its publishers with `mode: enforced` on a push to
main and advisory on a pull request.

## Out of scope

- A mail sender: email verification and password reset need one; the port
  signs users in without verifying the address, as the example's
  configuration does.
- Custom domains: the Worker goes live on workers.dev.
- The wrapper's Hyperdrive (Postgres/MySQL) modes: D1 is the example's
  database.
