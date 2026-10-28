import { describe, expect, it } from "vitest";
import { configuredProviders, socialProviders, PROVIDER_LABEL } from "@/auth/providers";

// A provider is offered only when both halves of its OAuth app are stored:
// a client id alone (or a secret alone) is a half-configured app that would
// fail at the provider's consent screen, so it is not offered at all.
describe("the OAuth providers a deployment offers", () => {
  it("offers none with nothing stored — anonymous and email sign-in only", () => {
    expect(configuredProviders({})).toEqual([]);
    expect(socialProviders({})).toEqual({});
  });

  it("offers a provider only when its client id and secret are both set", () => {
    expect(configuredProviders({ GITHUB_CLIENT_ID: "gh-id" })).toEqual([]);
    expect(configuredProviders({ GITHUB_CLIENT_SECRET: "gh-secret" })).toEqual([]);
    expect(configuredProviders({ GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" })).toEqual(["github"]);
    expect(socialProviders({ GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret", GOOGLE_CLIENT_ID: "g-id" })).toEqual({
      github: { clientId: "gh-id", clientSecret: "gh-secret" },
    });
  });

  it("offers both, in a fixed order, with their labels", () => {
    const env = { GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "gs", GITHUB_CLIENT_ID: "h", GITHUB_CLIENT_SECRET: "hs" };
    expect(configuredProviders(env)).toEqual(["github", "google"]);
    expect(configuredProviders(env).map((p) => PROVIDER_LABEL[p])).toEqual(["GitHub", "Google"]);
  });
});
