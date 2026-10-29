# better-auth-starter — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a product built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

better-auth-cloudflare's OpenNext.js example (zpg6/better-auth-cloudflare,
`examples/opennextjs`, MIT) — open-source sign-in with better-auth: email and
password, anonymous sessions, GitHub and Google once their keys are stored,
per-user file uploads — on Cloudflare Workers + Static Assets, the users in a
D1 database, the sessions in a Workers KV namespace and the uploads in an R2
bucket, all three provisioned by Terraform, the session secret generated in
each environment's database. Packaged as an Orun baseline:
`orun new --blueprint repo-blueprint.yaml` builds a new product in its own
repository and takes it to live on stage and prod in one landing
(`01-product`: cloudflare-d1, cloudflare-kv, cloudflare-r2 → db-migrate →
web per environment), then records what went live (`02-docs`).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (BA0–BA4: the auth app on Workers, its D1, KV and R2 from Terraform and its schema through db-migrate, providers optional) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI: the migration lane against a stand-in D1 API, the built Worker served by `wrangler dev` through every sign-in flow, an R2 round trip and a GitHub sign-in started with keys handed over as the deploy hands them. A live bootstrap from a tag is still to come (risk BA-F) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/better-auth-starter/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/better-auth-starter/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/better-auth-starter/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `<component>/docs/` beside each `component.yaml` — `apps/web`, `packages/db`, `infra/db-migrate`, `infra/terraform/cloudflare-{d1,kv,r2}`, `tests/{web,db}` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one product from `baseline-v1` against a workspace whose
   Cloudflare token can mint D1 Edit and R2 as well as Workers Scripts, sign
   up, upload a file, connect a GitHub OAuth app and sign in with it, and
   record the timings (closes BA-F).
