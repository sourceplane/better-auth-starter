# cloudflare-d1

Provisions the Cloudflare D1 database for stage and prod — better-auth's users, sessions, accounts and files, and the generated auth secret

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-d1`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **db-migrate** — Applies better-auth's schema and the generated auth secret (packages/db's migrations) to the stage and prod Cloudflare D1 databases
- **web** — The auth app (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment; better-auth through better-auth-cloudflare, its users in D1, its sessions in KV, its uploads in R2)
