import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `next dev` reaches the D1, KV and R2 bindings through wrangler's local
// platform proxy (render apps/web/wrangler.jsonc first: `pnpm run
// wire:fixture`; apply the migrations: `pnpm db:migrate:local`). Only for
// `next dev`, as the example does: during `next build` it would start a second
// workerd over the same local D1. The build is webpack's (package.json:
// `next build --webpack`).
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
  // into the Worker; traced from the monorepo root.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
