# better-auth-starter

Open-source sign-in for a Next.js app on **Cloudflare Workers + Static
Assets**, through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare):
[better-auth](https://www.better-auth.com) wired to Cloudflare by
[better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare) —
email and password, anonymous sessions, GitHub and Google sign-in once you
add their keys, and per-user file uploads. The users, their accounts and
uploads' records live in a **Cloudflare D1** database, the sessions in a
**Workers KV** namespace and the uploaded files in an **R2** bucket, all three
provisioned per environment by Terraform, the schema applied by migrations
before every deploy. The session secret is generated in each environment's
database; nothing to set before the first sign-in.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, which sign-in providers are connected and the secrets the site
uses into [ai/context/deployment.md](ai/context/deployment.md); how the site
deploys and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Sign-in providers

The site deploys and serves before any provider is connected: email and
password and anonymous sign-in work from the first deploy, and the sign-in
page says how to add more. To add **GitHub** (Google is the same, with the
`GOOGLE_` names):

1. **Create an OAuth app** — GitHub → Settings → Developer settings → OAuth
   Apps → New (Google: Cloud Console → APIs & Services → Credentials → OAuth
   client ID, a web application). Its **callback URL** is the site's own:
   `https://<host>/api/auth/callback/github` (`…/callback/google`), where
   `<host>` is the environment's workers.dev host or its domain. One app per
   environment, or one app whose callback lists both.
2. **Give the site its keys**, once per deployed environment. They are this
   repository's Orun secrets, and stage and prod can each use their own:

   ```bash
   orun secrets set GITHUB_CLIENT_ID --env stage       # prompts for the value
   orun secrets set GITHUB_CLIENT_SECRET --env stage
   ```

   Both are needed: a provider with one of the pair is left off. The build
   never sees them; the deploy hands them to the Worker as Worker secrets
   (`wrangler secret bulk`), so they are in no bundle, no build cache and no
   log.
3. **Redeploy the site**: a secret reaches the Worker when the site deploys,
   and setting one deploys nothing. Use **Deploy by hand** below, or change
   the stamp on the last line of `apps/web/component.yaml`
   (`# orun: redeploy …`) and merge. From that deploy on, the sign-in page
   shows **Continue with GitHub**.

**The session secret.** better-auth signs sessions with a secret the
`020_app_secrets` migration generates in each environment's database, once —
so stage and prod differ, and nothing secret is committed. To use your own,
store `BETTER_AUTH_SECRET` as an Orun secret for the environment and
redeploy; it wins over the generated one. Changing it signs everyone out.

## What is here

| Surface | Where |
|---|---|
| The sign-in page (email, anonymous, providers) and the dashboard (session, location, uploads) | `apps/web/src/app` |
| better-auth's configuration: D1, KV, R2, providers, plugins | `apps/web/src/auth/index.ts` |
| Which providers are offered, from the Worker's secrets | `apps/web/src/auth/providers.ts` |
| The generated session secret | `apps/web/src/auth/secret.ts` |
| The redirects between `/` and `/dashboard` | `apps/web/src/proxy.ts` |
| The upload demo (R2) | `apps/web/src/components/FileUploadDemo.tsx` |
| The Drizzle schema better-auth reads | `apps/web/src/db` |
| The site's name and source link | `apps/web/src/lib/site.ts` |
| The health route the deploy smoke-tests | `apps/web/src/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.mjs`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The D1 database, the KV namespace and the R2 bucket (stage, prod) | `infra/terraform/cloudflare-d1`, `infra/terraform/cloudflare-kv`, `infra/terraform/cloudflare-r2` |
| The schema (migrations) and their runner | `packages/db`, applied by `infra/db-migrate` |
| Handing the provider keys to the Worker | `tooling/wire/worker-secrets.mjs` |
| Tests | `tests/web`, `tests/db` (vitest) |

better-auth's own endpoints are under `/api/auth` — its OpenAPI reference is
at `/api/auth/reference`.

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build --webpack + opennextjs-cloudflare build → apps/web/.open-next
```

```bash
pnpm --filter @app/web db:migrate:local   # better-auth's tables and a session secret in wrangler's local D1
pnpm --filter @app/web dev                # http://localhost:3000 — local D1, KV and R2 through wrangler's platform proxy
pnpm --filter @app/web preview            # wrangler dev over the built Worker, the same local bindings
```

To try a provider locally, put its keys in `apps/web/.dev.vars`
(`GITHUB_CLIENT_ID=…`, `GITHUB_CLIENT_SECRET=…`, for `wrangler dev`) or
`.env.local` (for `next dev`) — never commit them — with the OAuth app's
callback set to `http://localhost:3000/api/auth/callback/github`.

Make the site yours in `apps/web/src`, and its name and the repository it
links to in `apps/web/src/lib/site.ts`.

## How the bindings are wired

The Worker binds the database as `DATABASE`, the namespace as `KV` and the
bucket as `R2_BUCKET`. None of their ids or names is hand-written:
`apps/web/wrangler.template.jsonc` names them as wiring tokens, and
`wrangler.jsonc` is that template rendered — from `wiring.fixture.json`
(placeholders) for local work and verification, and on every deploy from the
documents the `cloudflare-d1`, `cloudflare-kv` and `cloudflare-r2` Terraform
roots publish after their applies (`WIRING_CLOUDFLARE_D1`, `_KV`, `_R2`, per
environment). Edit the template, then `pnpm run wire:fixture` and commit the
render with the template.

The schema is `packages/db`'s migrations: each
`src/migrations/<NNN>_<name>/up.sql` is listed in `src/manifest.ts` with its
checksum, and the `db-migrate` component applies the pending ones to each
environment's database before the site deploys. A better-auth plugin that
adds tables (organizations, two-factor, passkeys) needs them twice: in the
Drizzle schema better-auth reads (`apps/web/src/db/auth.schema.ts`, which
better-auth's CLI generates — `npx @better-auth/cli generate`) and, as SQL,
in the next migration's `<NNN>_<name>/up.sql`; then
`pnpm --filter @saas/db run manifest:fix`. Never edit an applied migration —
its checksum is recorded. Locally, `pnpm --filter @app/web db:migrate:local`
applies the same files to wrangler's local D1.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. Per environment, the D1 database, the
KV namespace and the R2 bucket apply first, then the migrations, then the
site builds with that environment's bindings, hands it the provider keys and
the session secret it has (none on a fresh product) and deploys — to
`stage`, then to `prod` once stage has converged on the same commit; `dev`
only verifies. The Worker is `better-auth-starter-web-<env>` on your
account's workers.dev subdomain, and every deploy is smoke-tested over HTTP:
the sign-in page must render to its end, and `/api/health` must answer ok —
which only a Worker that read its database, its namespace and its bucket
can. A pull request runs the same pipeline's verify lanes: the packages
type-checked, linted, tested and built, both test suites, and the site built
and dry-deployed for each environment, with nothing deployed. (A push to
`main` applies, migrates, builds and deploys.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare tokens (one to deploy and apply the namespace, one scoped to D1,
one to R2) and the account id are brokered per run from the workspace's
Cloudflare connection, the binding ids travel as Orun secrets, and the
provider keys are the product's own Orun secrets; nothing provider-shaped is
stored in the repository or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after storing a
provider's keys, say. A component with nothing to run in that environment
(a test suite in `prod`) is left out with a notice.

## Custom domain

The site answers on workers.dev from its first deploy. To serve it on your
own domain:

1. Add the domain to the Cloudflare account the site deploys into, and attach
   it to the Worker (dashboard → Workers & Pages →
   `better-auth-starter-web-prod` → Settings → Domains & Routes → Add →
   Custom domain).
2. Sign-in works on it at once: better-auth takes the site's origin from each
   request. Add the domain's callback URL
   (`https://better-auth-starter.example.com/api/auth/callback/github`) to
   each OAuth app. To pin one origin instead — links in emails, say — set
   a Worker variable `BETTER_AUTH_URL`; a front end on another origin that
   calls `/api/auth` goes in `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated).

The site was born with the reserved placeholder
`better-auth-starter.example.com` where its domain goes: that example, and
`BASE_DOMAIN` under each environment in `intent.yaml`. Replace it with your
domain when you attach it.

## Credits

The app is better-auth-cloudflare's OpenNext.js example by Zach Grimaldi
([zpg6/better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare),
`examples/opennextjs`, MIT — `apps/web/LICENSE`), on
[better-auth](https://github.com/better-auth/better-auth) (MIT). The
sign-in page links the wrapper and this repository. Geist is served by
`next/font/google` (OFL-1.1).
