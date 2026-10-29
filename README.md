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
one maintainer, so an upgrade is a deliberate change. The database, the
namespace and the bucket are provisioned by Terraform through
[Orun](https://github.com/sourceplane/orun), the schema applied by
migrations, and the whole is packaged as an **Orun baseline**: one command
takes a new product from nothing to live on stage and prod, in its own
repository, under its own name — in ONE landing. The session secret is
generated in each environment's database, so the site signs users in with
nothing typed; GitHub and Google sign-in appear when their keys are stored.
What the baseline adds is everything needed to make a copy of it somebody
else's, built the way [cirrus-baseline](https://github.com/sourceplane/cirrus-baseline)
is. The design, the milestones and the as-built status are in
[`specs/epics/better-auth-starter`](specs/epics/better-auth-starter/README.md).
MIT, © 2025 Zach Grimaldi (`apps/web/LICENSE`).

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/better-auth-starter
cd better-auth-starter
orun new --blueprint repo-blueprint.yaml --out ~/sites/acme-accounts --run-hooks --resume \
  --set reponame=acme-accounts --set productname="Acme Accounts" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`better-auth-starter` → Build). Two phases: **`01-product`** creates the
repository and lands the whole product as ONE pull request — intent, CI,
tooling, the D1, KV and R2 roots, the migrations, the site and its tests —
and one convergence, per environment, applies the database, the namespace
and the bucket, then the migrations, then deploys the site bound to them;
**`02-docs`** records the live deployment from probed facts.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **product only** — the app, its D1, KV and
R2 roots, its migrations and their runner, its tests, its CI, its tooling, a
README of its own and its operating contract — renamed throughout to the
product's name, repository, Cloudflare Worker, database, namespace and
bucket names. None of this repository's machinery ships.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's README and context pack | `.baseline/product/README.md`, `ai/context/` |
| The baseline's tests: contract, wiring, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The sign-in page, the dashboard (user, geolocation, file upload) and the redirects between them | `apps/web/src/app`, `apps/web/src/proxy.ts` |
| better-auth through better-auth-cloudflare: D1, KV, R2, geolocation, the anonymous and OpenAPI plugins, email and optional OAuth sign-in | `apps/web/src/auth` |
| The site's name and source link | `apps/web/src/lib/site.ts` |
| The health route the deploy's smoke reads | `apps/web/src/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.mjs`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ the committed `wrangler.jsonc`), `component.yaml` |
| The D1 database, the KV namespace and the R2 bucket (stage, prod) | `infra/terraform/cloudflare-d1`, `cloudflare-kv`, `cloudflare-r2` |
| The schema (migrations) and the runner that applies them over the D1 REST API | `packages/db`, run by `infra/db-migrate` |
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

## Deploying

The Orun pipeline (`.github/workflows/ci.yml`) plans nothing while
`intent.yaml` names the placeholder workspace `ws_CHANGE_ME`. Link the
repository to an Orun Cloud workspace (`orun cloud link`), set
`execution.state.workspace` to it, connect Cloudflare in the workspace, and
every merge to `main` then applies the D1 database, the KV namespace and the
R2 bucket, migrates the database and deploys `better-auth-starter-web-stage`,
then `-prod`, each smoke-tested on `/api/health`. A pull request verifies the
same lanes and deploys nothing. A manual run of `ci.yml` (Run workflow on
`main`, or Orunbase's Deploy button) redeploys the components it names.

The deploy needs nothing typed: the auth secret is generated in each
environment's database by the migrations, and the sign-in page works with no
provider. R2 must be enabled on the Cloudflare account once (the dashboard
asks for a payment method even on the free tier); until it is, the R2 root's
apply fails.

## Custom domain

The Worker answers on `workers.dev` from its first deploy. To serve it on a
domain of your own, attach the domain to the Worker in Cloudflare (Workers &
Pages → the Worker → Settings → Domains & Routes) and replace
`better-auth-starter.example.com` in `intent.yaml`'s `BASE_DOMAIN`. better-auth
takes the origin each request arrives on, so sign-in works on the new domain
without changing a line; set `BETTER_AUTH_URL` only to pin one origin (an
OAuth app's callback URL must match it).

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
| drizzle-kit migrations, `wrangler d1 migrations apply` | `packages/db` migrations — `010_auth` (the three drizzle files' end state), `020_app_secrets` — applied by `infra/db-migrate` before the Worker deploys, and locally by `db:migrate:local` |
| a database, a namespace and a bucket created by hand in the dashboard | `infra/terraform/cloudflare-{d1,kv,r2}`, applied by Orun before the migrations and the Worker |
| `BETTER_AUTH_SECRET` typed into `.dev.vars` | generated once per database by `020_app_secrets`; a `BETTER_AUTH_SECRET` secret wins |
| `BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` vars | optional; unset, the base URL and the trusted origin are the origin the request came to |
| anonymous sign-in only | anonymous, email and password, and GitHub/Google when their keys are stored |
| Next.js 15 `middleware.ts` | Next.js 16 `proxy.ts`, the same self-request to `/api/auth/get-session` |
| `next build` ignoring lint and type errors | `pnpm lint` and `pnpm typecheck` clean; the build checks types |
| `[placement] mode = "smart"` | not set: D1, KV and R2 are in the Worker's own account |

## How the data reaches the Worker

```
infra/terraform/cloudflare-d1 ──apply──► WIRING_CLOUDFLARE_D1 ─┬─► infra/db-migrate  apply: packages/db's runner → POST …/d1/database/<id>/query
infra/terraform/cloudflare-kv ──apply──► WIRING_CLOUDFLARE_KV ─┤        (better-auth's tables, the generated auth secret)
infra/terraform/cloudflare-r2 ──apply──► WIRING_CLOUDFLARE_R2 ─┴─► apps/web  build: tooling/wire/live.mjs → wrangler.jsonc with the ids
                                                                          (dev, verify-only, renders the fixture) → next build → OpenNext → deploy
```

Each reader declares an enforced `dependsOn` on what it reads on a push to
`main` (advisory on a pull request), so one convergence per environment runs
the three roots, then the migrations, then the Worker. `wrangler.jsonc` is
committed as the fixture render of `wrangler.template.jsonc`, because the
deploy lane's `verify-app-structure` step checks the config exists before it
builds.

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (packages type-checked, linted, tested and built, both test suites, the site built and dry-deployed per environment), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone is the check; a merge applies the D1 database, the namespace and the bucket, migrates, then deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the wiring path, the blueprint read by the pinned orun, the leak gate, the offline bootstrap with the product's own plan, the product built in the job tree, migrated, dry-deployed and served — every sign-in flow and an R2 round trip with no provider connected, then a GitHub sign-in started with keys handed over as the deploy hands them | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |
