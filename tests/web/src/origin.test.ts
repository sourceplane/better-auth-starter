import { describe, expect, it } from "vitest";
import { originOf } from "@/auth/origin";

// The dashboard keys its auth instance on the origin its request came to.
describe("originOf (a server component's request origin)", () => {
  it("is https on a deployed host, http on a local one", () => {
    expect(originOf(new Headers({ host: "acme-web-stage.acme.workers.dev" }))).toBe("https://acme-web-stage.acme.workers.dev");
    expect(originOf(new Headers({ host: "127.0.0.1:8787" }))).toBe("http://127.0.0.1:8787");
    expect(originOf(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("prefers the forwarded host and protocol a proxy in front sets", () => {
    expect(originOf(new Headers({ host: "internal", "x-forwarded-host": "auth.acme.dev", "x-forwarded-proto": "https" }))).toBe("https://auth.acme.dev");
  });

  it("is unknown with no host at all", () => {
    expect(originOf(new Headers())).toBeUndefined();
  });
});

describe("requestOrigin (a route handler's request origin)", () => {
  it("is the URL's scheme with the Host header the browser sent", async () => {
    const { requestOrigin } = await import("@/auth/origin");
    expect(requestOrigin(new Request("https://acme-web-prod.acme.workers.dev/api/auth/get-session"))).toBe("https://acme-web-prod.acme.workers.dev");
    // wrangler dev: the URL says localhost, Host says what the browser asked for.
    expect(requestOrigin(new Request("http://localhost:8787/api/auth/sign-up/email", { headers: { host: "127.0.0.1:8787" } }))).toBe("http://127.0.0.1:8787");
  });
});
