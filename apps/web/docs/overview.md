# web

The auth app (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment; better-auth through better-auth-cloudflare, its users in D1, its sessions in KV, its uploads in R2)

A Cloudflare Worker with Static Assets (server rendering plus static files), deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-workers-assets-turbo`                                                                                  |
| Source       | `apps/web`                                                                                                         |
| Package      | `@app/web`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- **cloudflare-d1** — Provisions the Cloudflare D1 database for stage and prod — better-auth's users, sessions, accounts and files, and the generated auth secret
- **cloudflare-kv** — Provisions the Cloudflare KV namespace better-auth keeps its sessions in (stage and prod)
- **cloudflare-r2** — Provisions the Cloudflare R2 bucket signed-in users' uploads are kept in (stage and prod)
- **db-migrate** — Applies better-auth's schema and the generated auth secret (packages/db's migrations) to the stage and prod Cloudflare D1 databases

## Depended on by

- (none)
