// The OAuth providers this deployment offers. A provider appears only when
// both its client id and its client secret are set (Orun secrets the deploy
// hands to the Worker as Worker secrets; .dev.vars locally) — so a fresh
// deploy, with neither, offers anonymous and email sign-in and says how to add
// one. Nothing about a provider is committed.
type Env = Pick<CloudflareEnv, "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">;

export const PROVIDERS = ["github", "google"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<Provider, string> = { github: "GitHub", google: "Google" };

function credentials(env: Env, provider: Provider): { clientId: string; clientSecret: string } | null {
  const id = provider === "github" ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const secret = provider === "github" ? env.GITHUB_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

/** The providers whose client id and secret are both set, in a fixed order. */
export function configuredProviders(env: Env): Provider[] {
  return PROVIDERS.filter((p) => credentials(env, p) !== null);
}

/** better-auth's `socialProviders` option for exactly those providers. */
export function socialProviders(env: Env): Partial<Record<Provider, { clientId: string; clientSecret: string }>> {
  const out: Partial<Record<Provider, { clientId: string; clientSecret: string }>> = {};
  for (const p of PROVIDERS) {
    const c = credentials(env, p);
    if (c) out[p] = c;
  }
  return out;
}
