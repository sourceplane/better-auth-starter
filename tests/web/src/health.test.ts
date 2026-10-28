import { beforeEach, describe, expect, it, vi } from "vitest";
import { broken, d1, kv, r2, sqlite } from "./support/bindings";

// /api/health is what the deploy's smoke reads: ok only when the Worker can
// read all three bindings and the migrations have run — and it writes nothing.
const env: Record<string, unknown> = {};
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env }) }));

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
});

async function health() {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, cache: res.headers.get("cache-control") };
}

describe("GET /api/health", () => {
  it("answers ok when D1 holds the generated secret and KV and R2 answer, reading and writing nothing else", async () => {
    const store = kv();
    const bucket = r2();
    Object.assign(env, { DATABASE: d1(sqlite()), KV: store, R2_BUCKET: bucket });
    const { status, body, cache } = await health();
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, d1: true, kv: true, r2: true });
    expect(cache).toBe("no-store");
    expect(store.values.size).toBe(0);
    expect(bucket.objects.size).toBe(0);
    expect(store.reads).toEqual(["health:probe"]);
    expect(bucket.heads).toEqual(["health/probe"]);
  });

  it("answers 503 naming the fix before the migrations have run", async () => {
    Object.assign(env, { DATABASE: d1(sqlite([])), KV: kv(), R2_BUCKET: r2() });
    const { status, body } = await health();
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.d1).toBe(false);
    expect(String((body.errors as string[])[0])).toMatch(/no such table: app_secrets/);
  });

  it("answers 503 naming each binding that is missing", async () => {
    Object.assign(env, { DATABASE: d1(sqlite()), KV: broken("KV"), R2_BUCKET: broken("R2_BUCKET") });
    const { status, body } = await health();
    expect(status).toBe(503);
    expect(body).toMatchObject({ ok: false, d1: true, kv: false, r2: false });
    expect(body.errors).toEqual(["kv: KV is not bound", "r2: R2_BUCKET is not bound"]);
  });
});
