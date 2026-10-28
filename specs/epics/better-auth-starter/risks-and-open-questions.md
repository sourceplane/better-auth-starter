# Risks and open questions — better-auth-starter

| # | Risk | Mitigation / decision |
|---|---|---|
| BA-A | `better-auth-cloudflare` is a community wrapper with one maintainer. A release could break the example's shape, lag better-auth, or stop. | Pinned exactly (`0.4.1`), with `better-auth` and `@better-auth/drizzle-adapter` at `1.7.3`, the versions its own tests run. Upgrading is a deliberate change: bump all three together, re-run the e2e. The wrapper is thin (D1/KV/R2 adapters, geolocation fields, an R2 plugin); if it stops, its adapters are better-auth's documented secondary-storage and Drizzle APIs. |
| BA-B | better-auth versions after `1.7.3` carry fixes the pin does not get. | Recorded here; the owner bumps the pins (BA-A). |
| BA-C | The middleware asks the Worker's own `/api/auth/get-session` over the network. On workers.dev that is a subrequest back into the same Worker. | Upstream's own design, kept; `global_fetch_strictly_public` routes it out and back. The dashboard checks the session itself, so a failed self-request only skips a redirect. |
| BA-D | No mail sender, so addresses are not verified and passwords cannot be reset by email. | Out of scope (design.md); better-auth's `sendVerificationEmail`/`sendResetPassword` are the seams. |
| BA-E | R2 must be enabled on a Cloudflare account once (it asks for a payment method even on the free tier). | Said in BOOTSTRAP's troubleshooting; the R2 root's apply fails until it is. |
| BA-F | D1, KV and R2 apply, the migrations and the deploy are proven only by a live bootstrap. | The roots are held to `terraform validate`, the migrations run against a stand-in D1 API, and the Worker is served by `wrangler dev` in Baseline CI. |
