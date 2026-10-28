import { beforeEach, describe, expect, it } from "vitest";
import { authSecret, resetAuthSecret } from "@/auth/secret";
import { d1, sqlite } from "./support/bindings";

// The secret better-auth signs with comes from the database the migrations
// set up — generated there, never typed — unless the owner stores one.
describe("the auth secret", () => {
  beforeEach(() => resetAuthSecret());

  it("is the one 020_app_secrets generated: 32 random bytes as hex, the same on every read", async () => {
    const db = sqlite();
    const env = { DATABASE: d1(db) as unknown as D1Database };
    const secret = await authSecret(env);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(secret).toBe(String(db.prepare("SELECT value FROM app_secrets WHERE name = 'auth'").all()[0]?.value));
    resetAuthSecret();
    expect(await authSecret(env)).toBe(secret);
  });

  it("differs between two databases, as stage's and prod's do", async () => {
    const a = await authSecret({ DATABASE: d1(sqlite()) as unknown as D1Database });
    resetAuthSecret();
    const b = await authSecret({ DATABASE: d1(sqlite()) as unknown as D1Database });
    expect(a).not.toBe(b);
  });

  it("is a BETTER_AUTH_SECRET Worker secret when one is stored, without reading D1", async () => {
    const env = { DATABASE: {} as D1Database, BETTER_AUTH_SECRET: "owner-chosen-secret-0123456789abcdef" };
    expect(await authSecret(env)).toBe("owner-chosen-secret-0123456789abcdef");
  });

  it("says to apply the migrations when the database has none", async () => {
    await expect(authSecret({ DATABASE: d1(sqlite(["010_auth"])) as unknown as D1Database })).rejects.toThrow(/apply the migrations/);
    resetAuthSecret();
    await expect(authSecret({ DATABASE: d1(sqlite([])) as unknown as D1Database })).rejects.toThrow(/no such table: app_secrets.*apply the migrations/);
  });
});
