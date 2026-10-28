# Epic: better-auth-starter (BA)

**better-auth already runs on Workers; what it needs from Cloudflare is a database, a cache and a bucket. zpg6's better-auth-cloudflare wraps all three — D1 through Drizzle for the users, Workers KV as better-auth's secondary storage for the sessions, R2 for uploaded files — and adds Cloudflare's geolocation to every session. Its OpenNext example is a sign-in page and a dashboard over them. The port keeps the example and its wrapper as they are, pinned to exact versions, provisions the three bindings with Terraform through Orun, turns the example's drizzle-kit migrations into db-migrate migrations, and generates the auth secret in the database instead of asking for one.**

The port keeps the sign-in page, the dashboard (user, geolocation and file-upload tabs), the session check that redirects between them, the R2 upload and download hooks and the OpenAPI reference. It adds email-and-password sign-in beside the example's anonymous one, GitHub and Google sign-in when their keys are stored, a read-only health route, the Workers build, the monorepo wrapper, tests, the three Terraform roots, the migrations and the deploy contract.

## Status

| Field | Value |
|-------|-------|
| Status | In progress — BA0 shipped (#1), BA1 |
| Cluster | **BA** (BA0–BA4) |
| Owner(s) | `apps/web` · `tests/web` · `infra/terraform/cloudflare-{d1,kv,r2}` · `packages/db` + `infra/db-migrate` · `tests/db` |
| Builds on | `turso-starter`: its scaffolding, its `cloudflare-d1` root and its migrations runner; `kv-redis-starter`'s `cloudflare-kv` root; `blob-starter`'s `cloudflare-r2` root; `saas-starter`'s generated app secret |
| Upstream | [zpg6/better-auth-cloudflare `examples/opennextjs`](https://github.com/zpg6/better-auth-cloudflare/tree/main/examples/opennextjs) (MIT) |
| Changes | Next.js 16 and the Workers build, exact version pins, email-and-password and optional OAuth sign-in, the generated auth secret, the health route, tests, the Terraform roots and the deploy contract |
| Gate | BA1 is the first user-visible rung. BA2's roots apply only with a linked workspace; verified by `terraform validate`. |

## Read order

1. `design.md` — what maps to what, the wiring flow, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| BA0 — the spec | intent, CI, tooling, the spec index, this doc set and the task contracts | merged on `main` |
| BA1 — the auth app on Workers | `apps/web`, the rendered wrangler config, `tests/web` | `wrangler dev` signs a user in and shows the dashboard |
| BA2 — D1, KV and R2 from Terraform | `infra/terraform/cloudflare-{d1,kv,r2}`, `packages/db`, `infra/db-migrate`, `tests/db` | the roots validate; the migrations apply; the plan orders roots → migrations → Worker |
| BA3 — ready to instantiate | README, as-built status | a reader can run, test, preview and deploy it |
| BA4 — a baseline | card, build document, rename, bootstrap tooling, tests | a new auth app goes from nothing to live in one landing; Baseline CI green |
