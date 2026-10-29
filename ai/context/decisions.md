# better-auth-starter — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | The app is better-auth-cloudflare's `examples/opennextjs`, kept close: `withCloudflare` over D1 (Drizzle, plural table names), KV as better-auth's secondary storage, the R2 plugin, geolocation on sessions; the anonymous and OpenAPI plugins | The example is what the wrapper's maintainer tests; the closer it stays, the cheaper an upgrade | design.md, "How it maps" |
| 2 | `better-auth-cloudflare` 0.4.1, `better-auth` and `@better-auth/drizzle-adapter` 1.7.3, pinned exactly and bumped together | A single-maintainer wrapper over a fast-moving library; an unpinned range would change the product under it | risk BA-A |
| 3 | Email and password on; GitHub and Google offered only when both a client id and a secret reach the Worker | A fresh product signs users in with no provider; a half-configured provider would show a button that fails | IMPLEMENTATION-STATUS 3 |
| 4 | The provider keys are optional Orun secrets, kept out of the build (`env -u`) and handed to the Worker as Worker secrets (`tooling/wire/worker-secrets.mjs`) | They are read at request time; no bundle, build cache or log holds them | IMPLEMENTATION-STATUS 3 |
| 5 | The session secret is generated once per database (`020_app_secrets`); a `BETTER_AUTH_SECRET` Worker secret wins | Nothing secret is typed at build or committed, and stage and prod differ | IMPLEMENTATION-STATUS 4 |
| 6 | The base URL is the request's origin unless `BETTER_AUTH_URL` is set, and that origin (plus `BETTER_AUTH_TRUSTED_ORIGINS`) is what better-auth trusts; the instance is rebuilt when the origin changes | stage, prod, a custom domain and a local `wrangler dev` each sign in on their own URL with nothing configured | IMPLEMENTATION-STATUS 5 |
| 7 | The schema is migrations (`packages/db`: `010_auth`, `020_app_secrets`), idempotent, applied by `infra/db-migrate` between the D1 apply and the Worker's deploy — not drizzle-kit at deploy | The convergence's order then includes the schema; the runner records checksums | IMPLEMENTATION-STATUS 6 |
| 8 | The smoke requires `</html>` on `/` and `"ok":true` from `/api/health`, which reads D1, KV and R2 and writes nothing | Only a Worker bound to its migrated database, its namespace and its bucket answers it | IMPLEMENTATION-STATUS 7 |
| 9 | Next.js 16.3.8, `proxy.ts`, `next build --webpack` | The reference starters' toolchain; OpenNext 1.20.11 accepts 16.3 | IMPLEMENTATION-STATUS 1 |
| 10 | `wrangler.jsonc` is rendered from the three roots' wiring documents per environment, and the fixture render is committed; dev renders the fixture | The deploy lane checks the config exists before the build; no root applies in dev | design.md, "The wiring flow" |
| 11 | One landing (`01-product`) then the record (`02-docs`); edges `mode: enforced` on main, advisory on a pull request | The plan, not a landing boundary, orders the database, namespace and bucket, the schema and the Worker | design.md, "The wiring flow" |
| 12 | The D1 apply and the migrations use a `d1-edit` key, the R2 apply an `r2-data` key; the KV root applies with the deploy token | The `workers-deploy` token covers Workers and KV but not D1 or R2 | design.md, "The wiring flow" |
| 13 | No mail sender: no address verification, no password reset by email | Out of scope; better-auth's `sendVerificationEmail` and `sendResetPassword` are the seams | risk BA-D |
| 14 | The migrations package is named `@saas/db` | stack-tectonic's db-migrate composition builds `--filter=@saas/db` | turso-starter's shape |
| 15 | Component docs are generated from the manifests and checked in CI | A hand-written copy of the dependency graph, bindings and migrations drifts silently | `tooling/catalog/gen-component-docs.py` |
