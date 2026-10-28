import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";

const app = path.resolve(__dirname, "../../../apps/web");

// The two branding seams the rename rewrites, and the committed config the
// deploy lane checks for before it builds.
describe("the site's identity and config", () => {
  it("names itself and links its own repository", () => {
    expect(SITE_NAME).toBe("Auth Starter");
    expect(SOURCE_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });

  it("commits wrangler.jsonc binding DATABASE, KV and R2_BUCKET, with no token left unrendered", () => {
    const jsonc = readFileSync(path.join(app, "wrangler.jsonc"), "utf8");
    expect(jsonc).not.toMatch(/@@wiring/);
    const config = JSON.parse(jsonc.replace(/^\s*\/\/.*$/gm, "")) as {
      d1_databases: { binding: string }[];
      kv_namespaces: { binding: string }[];
      r2_buckets: { binding: string }[];
    };
    expect(config.d1_databases.map((b) => b.binding)).toEqual(["DATABASE"]);
    expect(config.kv_namespaces.map((b) => b.binding)).toEqual(["KV"]);
    expect(config.r2_buckets.map((b) => b.binding)).toEqual(["R2_BUCKET"]);
  });

  it("pins better-auth, its Drizzle adapter and the Cloudflare wrapper to exact versions", () => {
    const deps = (JSON.parse(readFileSync(path.join(app, "package.json"), "utf8")) as { dependencies: Record<string, string> }).dependencies;
    expect(deps["better-auth"]).toBe("1.7.3");
    expect(deps["@better-auth/drizzle-adapter"]).toBe("1.7.3");
    expect(deps["better-auth-cloudflare"]).toBe("0.4.1");
  });
});
