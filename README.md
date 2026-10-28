# better-auth-starter

zpg6's [better-auth-cloudflare OpenNext example](https://github.com/zpg6/better-auth-cloudflare/tree/main/examples/opennextjs)
— open-source authentication with [better-auth](https://www.better-auth.com):
anonymous, email-and-password and (once keys are stored) GitHub and Google
sign-in, every session enriched with Cloudflare's geolocation and kept in
**Workers KV**, the users in a **Cloudflare D1** database, files a signed-in
user uploads in **R2** — running on **Cloudflare Workers + Static Assets**
through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

The example and its wrapper, `better-auth-cloudflare`, are kept as they are
and pinned to exact versions (`better-auth-cloudflare@0.4.1`,
`better-auth@1.7.3`, `@better-auth/drizzle-adapter@1.7.3`); the wrapper has
one maintainer, so an upgrade is a deliberate change. The design, the
milestones and the as-built status are in
[`specs/epics/better-auth-starter`](specs/epics/better-auth-starter/README.md).
MIT, © 2025 Zach Grimaldi (`apps/web/LICENSE`).

## What is here

| Surface | Where |
|---|---|
| The sign-in page, the dashboard (user, geolocation, file upload) and the redirects between them | `apps/web/src/app`, `apps/web/src/proxy.ts` |
| better-auth through better-auth-cloudflare: D1, KV, R2, geolocation, the anonymous and OpenAPI plugins, email and optional OAuth sign-in | `apps/web/src/auth` |
| The site's name and source link | `apps/web/src/lib/site.ts` |
| The health route the deploy's smoke reads | `apps/web/src/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.mjs`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ the committed `wrangler.jsonc`), `component.yaml` |
| The schema (migrations) and the runner that applies them over the D1 REST API | `packages/db` |
| Tests | `tests/web` (the providers, the generated secret, the health route, the redirects), `tests/db` (the migrations through the runner, into real SQLite) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build + opennextjs-cloudflare build → apps/web/.open-next
```

```bash
pnpm --filter @app/web db:migrate:local   # better-auth's tables and the auth secret in wrangler's local D1
pnpm --filter @app/web dev                # http://localhost:3000 — the local D1, KV and R2 through wrangler's platform proxy
pnpm --filter @app/web preview            # wrangler dev over the built Worker, same local bindings
```

## Sign-in providers

Anonymous and email-and-password sign-in work with nothing configured.
GitHub or Google sign-in appears once a provider's client id **and** secret
are both set — `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`,
`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — in `apps/web/.dev.vars`
locally. The OAuth app's callback URL is `<origin>/api/auth/callback/<provider>`.
No mail sender is configured, so email addresses are not verified.

## How it maps to the example's Cloudflare setup

| The example | Here |
|---|---|
| `wrangler.toml` with placeholder database, namespace and bucket ids | `wrangler.template.jsonc` → `wrangler.jsonc`, rendered per environment from wiring documents (`tooling/wire`); the binding names (`DATABASE`, `KV`, `R2_BUCKET`) are the example's |
| `better-auth-cloudflare: file:../../` (the repository's own build) | `better-auth-cloudflare@0.4.1` from npm, exact, with `better-auth` and the Drizzle adapter at `1.7.3` |
| drizzle-kit migrations, `wrangler d1 migrations apply` | `packages/db` migrations — `010_auth` (the three drizzle files' end state), `020_app_secrets` — applied locally by `db:migrate:local` |
| `BETTER_AUTH_SECRET` typed into `.dev.vars` | generated once per database by `020_app_secrets`; a `BETTER_AUTH_SECRET` secret wins |
| `BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` vars | optional; unset, the base URL and the trusted origin are the origin the request came to |
| anonymous sign-in only | anonymous, email and password, and GitHub/Google when their keys are stored |
| Next.js 15 `middleware.ts` | Next.js 16 `proxy.ts`, the same self-request to `/api/auth/get-session` |
| `next build` ignoring lint and type errors | `pnpm lint` and `pnpm typecheck` clean; the build checks types |
| `[placement] mode = "smart"` | not set: D1, KV and R2 are in the Worker's own account |
