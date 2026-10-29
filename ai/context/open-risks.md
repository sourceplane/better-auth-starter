# better-auth-starter — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/better-auth-starter/risks-and-open-questions.md`; this page lists only
what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| BA-F | Not yet proven live: the `d1-edit` and `r2-data` mints, the three Terraform applies and their wiring publishes, the migrations against the real D1 API, the deploy, the Worker-secret push and the workers.dev probes | OPEN | One bootstrap from a tag against a workspace whose Cloudflare token can mint D1 Edit and R2 |
| BA-A | `better-auth-cloudflare` has one maintainer; a release could lag better-auth or stop | OPEN (pinned) | Nothing closes it; the pins hold it, and the wrapper is thin enough to replace with better-auth's own adapters |

Accepted, and worth knowing before you change them: BA-B (the pinned
better-auth misses later fixes until the owner bumps all three pins), BA-C
(the proxy asks the Worker's own `/api/auth/get-session` over the network —
upstream's design; the dashboard checks the session itself), BA-D (no mail
sender: addresses are not verified and passwords cannot be reset by email),
BA-E (R2 must be enabled on the Cloudflare account once, or the bucket's
apply fails).
