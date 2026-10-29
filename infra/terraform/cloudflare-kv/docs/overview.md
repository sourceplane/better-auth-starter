# cloudflare-kv

Provisions the Cloudflare KV namespace better-auth keeps its sessions in (stage and prod)

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-kv`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **web** — The auth app (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment; better-auth through better-auth-cloudflare, its users in D1, its sessions in KV, its uploads in R2)
