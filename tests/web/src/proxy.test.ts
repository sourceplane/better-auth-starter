import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

// The example's redirects, kept: a signed-in visitor on / goes to /dashboard,
// a signed-out one on /dashboard goes to /, decided by asking the app's own
// /api/auth/get-session with the visitor's cookie.
afterEach(() => vi.unstubAllGlobals());

function session(answer: object | null, status = 200) {
  const seen: { url: string; cookie: string | null }[] = [];
  vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
    seen.push({ url: String(input), cookie: new Headers(init?.headers).get("cookie") });
    return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
  });
  return seen;
}
const signedIn = { session: { id: "s1", userId: "u1", country: "GB" }, user: { id: "u1" } };

describe("the proxy (the example's middleware.ts)", () => {
  it("runs on /, /sign-in and /dashboard only", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/", "/sign-in"]);
  });

  it("sends a signed-out visitor from /dashboard to /, asking the app's own session route with their cookie", async () => {
    const seen = session(null);
    const res = await proxy(new NextRequest("https://app.test/dashboard", { headers: { cookie: "better-auth.session_token=x" } }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    expect(seen).toEqual([{ url: "https://app.test/api/auth/get-session", cookie: "better-auth.session_token=x" }]);
  });

  it("sends a signed-in visitor from / to /dashboard", async () => {
    session(signedIn);
    const res = await proxy(new NextRequest("https://app.test/"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("lets a signed-in visitor through to /dashboard and a signed-out one through to /", async () => {
    session(signedIn);
    expect((await proxy(new NextRequest("https://app.test/dashboard"))).headers.get("location")).toBeNull();
    session(null);
    expect((await proxy(new NextRequest("https://app.test/"))).headers.get("location")).toBeNull();
  });

  it("treats a failing session route as signed out, so a protected page is never served on an error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const res = await proxy(new NextRequest("https://app.test/dashboard"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    const home = await proxy(new NextRequest("https://app.test/"));
    expect(home.headers.get("location")).toBeNull();
  });
});
