# Implementation plan — better-auth-starter

| Milestone | Task | What lands | Done when |
|---|---|---|---|
| BA0 — the spec | BA-1 | intent (`ws_CHANGE_ME`), `ci.yml` (turso-starter's, byte for byte), shared tooling, the spec index, this doc set, the task contracts | merged; CI's plan job green |
| BA1 — the auth app on Workers | BA-2 | `apps/web` — the example on Next.js 16, OpenNext, exact pins, email and optional OAuth sign-in, `/api/health`; `tests/web` | typecheck, lint, test and build green; under `wrangler dev` a user signs in anonymously and with email, the dashboard renders, a file round-trips through R2 |
| BA2 — D1, KV and R2 from Terraform, the schema through db-migrate | BA-3 | `infra/terraform/cloudflare-{d1,kv,r2}`, `packages/db` (`@saas/db`), `infra/db-migrate`, `tests/db`; the web component's enforced edges and live wiring | the roots validate; the migrations apply into real SQLite through the runner, twice; the plan orders roots → migrations → Worker |
| BA3 — ready to instantiate | BA-4 | the README, the as-built status | a reader can run, test, preview and deploy it |
| BA4 — a baseline | BA-5 | `blueprint.yaml`, `repo-blueprint.yaml`, `.baseline/`, the rename and bootstrap tooling, the context pack, the component docs, `testing/`, `baseline.yml`, `tag.yml` | Baseline CI green; `baseline-v1` cut by `tag.yml` |
