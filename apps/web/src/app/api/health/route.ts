import { getCloudflareContext } from "@opennextjs/cloudflare";

// The deploy's smoke reads this: an answer only the Worker can give, by
// reading each binding — D1 (the generated auth secret, so the migrations
// applied), KV and R2 — and writing nothing. It says whether each is there and
// never what it holds.
export const dynamic = "force-dynamic";

export async function GET() {
    const { env } = await getCloudflareContext({ async: true });
    const checks: Record<string, boolean> = { d1: false, kv: false, r2: false };
    const errors: string[] = [];
    try {
        const row = await env.DATABASE.prepare("SELECT count(*) AS n FROM app_secrets WHERE name = ?").bind("auth").first<{ n: number }>();
        checks.d1 = Number(row?.n) === 1;
        if (!checks.d1) errors.push("d1: no auth secret — apply the migrations");
    } catch (err) {
        errors.push(`d1: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
        await env.KV.get("health:probe");
        checks.kv = true;
    } catch (err) {
        errors.push(`kv: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
        await env.R2_BUCKET.head("health/probe");
        checks.r2 = true;
    } catch (err) {
        errors.push(`r2: ${err instanceof Error ? err.message : String(err)}`);
    }
    const ok = checks.d1 && checks.kv && checks.r2;
    return Response.json({ ok, ...checks, ...(errors.length ? { errors } : {}) }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
