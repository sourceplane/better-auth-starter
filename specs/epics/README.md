# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`better-auth-starter/`](./better-auth-starter/) | **BA** | ✅ Shipped (`baseline-v1`); not yet live | zpg6's better-auth-cloudflare OpenNext example — anonymous, email and OAuth sign-in through better-auth, sessions in KV, users in D1, file uploads in R2 — on Cloudflare Workers, and an Orun baseline that instantiates it in one landing |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
