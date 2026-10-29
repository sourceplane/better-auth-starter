# db-migrate

Applies better-auth's schema and the generated auth secret (packages/db's migrations) to the stage and prod Cloudflare D1 databases

Applies this repository's ordered database migrations per environment: plan on pull requests, apply on merge to `main`.

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| Type         | `db-migrate`                                                                               |
| Source       | `infra/db-migrate`                                                                         |
| Environments | `stage`: `plan`, `apply` on a push to `main` · `prod`: `plan`, `apply` on a push to `main` |

## Depends on

- **db** — better-auth's schema and the generated auth secret as migrations, and the runner that applies them to D1 (built by the db-migrate component before it plans or applies)
- **cloudflare-d1** — Provisions the Cloudflare D1 database for stage and prod — better-auth's users, sessions, accounts and files, and the generated auth secret

## Depended on by

- **web** — The auth app (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment; better-auth through better-auth-cloudflare, its users in D1, its sessions in KV, its uploads in R2)
