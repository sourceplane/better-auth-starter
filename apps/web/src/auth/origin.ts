// The origin a server component's request came to, from its headers — what
// the auth instance for that request is keyed on (src/auth/index.ts). A route
// handler has the request itself and uses its URL's origin.
export function originOf(headers: Headers): string | undefined {
    const host = headers.get("x-forwarded-host") ?? headers.get("host");
    if (!host) return undefined;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    const proto = headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
    return `${proto}://${host}`;
}

/**
 * The origin a route handler's request came to: its URL's scheme with its Host
 * header — the origin the browser used, and so the one its Origin header
 * carries. (Under `wrangler dev` the URL's host is rewritten to localhost
 * while Host keeps what the browser asked for; on Cloudflare the two agree.)
 */
export function requestOrigin(req: Request): string {
    const url = new URL(req.url);
    return `${url.protocol}//${req.headers.get("host") ?? url.host}`;
}
