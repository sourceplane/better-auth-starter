# Implementation status — better-auth-starter

| Milestone | Status | Shipped in |
|---|---|---|
| BA0 — the spec | ✅ Shipped | [#1](https://github.com/sourceplane/better-auth-starter/pull/1) |
| BA1 — the auth app on Workers | In progress | |
| BA2 — D1, KV and R2 from Terraform | Not started | |
| BA3 — ready to instantiate | Not started | |
| BA4 — a baseline | Not started | |

## Departures from the upstream example

1. **Next.js 16.3.8** (the example: 15.5): the reference starters' toolchain. `middleware.ts` is `proxy.ts` (Next 16's name), its logic unchanged except that it no longer logs each signed-in visitor's city and country.
2. **Exact pins** — `better-auth-cloudflare@0.4.1` (the example: `file:../../`), `better-auth@1.7.3`, `@better-auth/drizzle-adapter@1.7.3`, and the example's transitive overrides (`@better-auth/utils`, `defu`, `nanoid`) in `pnpm-workspace.yaml`. Risk BA-A.
3. **Email and password sign-in**, and **GitHub and Google** sign-in when both a client id and a secret are set (`src/auth/providers.ts`); the example offers anonymous sign-in only. The sign-in card keeps the example's anonymous tab.
4. **The auth secret is generated in D1** by the `020_app_secrets` migration (`src/auth/secret.ts`); a `BETTER_AUTH_SECRET` secret wins.
5. **The base URL is the request's origin** when `BETTER_AUTH_URL` is unset, and that origin is the trusted one: the auth instance is built per origin (`src/auth/index.ts`, `src/auth/origin.ts`). The origin is the request's scheme and Host header — `wrangler dev` rewrites the URL's host to `localhost`, which would refuse a browser's own Origin.
6. **The schema is two migrations** — `010_auth`, the end state of the example's three drizzle-kit files, idempotent; `020_app_secrets` — in `packages/db`, not drizzle-kit's folder. The CLI-only `auth` export the example kept for `auth:generate` is dropped with its scripts.
7. **`/api/health`** reads D1 (the generated secret), KV and R2 and writes nothing: the deploy's smoke.
8. **The site's name and source link** (`src/lib/site.ts`) head the sign-in page and title the document; the example's "Powered by better-auth-cloudflare" and its GitHub/npm links stay.
9. Small lint fixes in the example's code (an escaped apostrophe, `any` → the file record's type); `debugLogs` and Drizzle's query logger off; `[placement]` not set.
10. **`incremental` off** in `apps/web/tsconfig.json`: its build info prints better-auth's inferred instance type, which overflows the compiler's stack.
