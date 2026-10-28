import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { anonymous, openAPI } from "better-auth/plugins";
import { getDb } from "../db";
import { socialProviders } from "./providers";
import { authSecret } from "./secret";

async function authBuilder(origin: string | undefined) {
    const dbInstance = await getDb();
    const cfCtx = getCloudflareContext();
    const env = cfCtx.env;
    return betterAuth({
        ...withCloudflare(
            {
                autoDetectIpAddress: true,
                geolocationTracking: true,
                cf: () => getCloudflareContext().cf,
                d1: {
                    db: dbInstance,
                    options: {
                        usePlural: true, // Plural table names (e.g., "users" instead of "user")
                        debugLogs: false,
                    },
                },
                // The "KV" binding (wrangler.jsonc): better-auth's secondary storage
                kv: env.KV,
                // R2 configuration for file storage (the R2_BUCKET binding)
                r2: {
                    bucket: env.R2_BUCKET,
                    maxFileSize: 2 * 1024 * 1024, // 2MB
                    allowedTypes: [".jpg", ".jpeg", ".png", ".gif"],
                    additionalFields: {
                        category: { type: "string", required: false },
                        isPublic: { type: "boolean", required: false },
                        description: { type: "string", required: false },
                    },
                    hooks: {
                        upload: {
                            before: async (file, ctx) => {
                                // Only allow authenticated users to upload files
                                if (ctx.session === null) {
                                    return null; // Blocks upload
                                }

                                // Only allow paid users to upload files (for example)
                                const isPaidUser = (userId: string) => userId.length > 0; // example
                                if (isPaidUser(ctx.session.user.id) === false) {
                                    return null; // Blocks upload
                                }

                                // Allow upload
                            },
                            after: async (file) => {
                                // Track your analytics (for example)
                                console.log("File uploaded:", file.id);
                            },
                        },
                        download: {
                            before: async (file, ctx) => {
                                // Only allow user to access their own files (by default all files are public)
                                if (file.isPublic === false && file.userId !== ctx.session?.user.id) {
                                    return null; // Blocks download
                                }
                                // Allow download
                            },
                        },
                    },
                },
            },
            // The core better-auth configuration (see the better-auth docs for all options)
            {
                // Generated in D1 by the 020_app_secrets migration; a
                // BETTER_AUTH_SECRET Worker secret wins (src/auth/secret.ts).
                secret: await authSecret(env),
                // The app's public origin: BETTER_AUTH_URL when the owner sets one
                // (a custom domain), else the origin the request came to — so
                // stage, prod and a local `wrangler dev` each sign users in on
                // their own URL with nothing configured. better-auth trusts it
                // (and only it, plus BETTER_AUTH_TRUSTED_ORIGINS) as an Origin.
                baseURL: env.BETTER_AUTH_URL || origin,
                trustedOrigins: [
                    ...(origin ? [origin] : []),
                    ...(env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map(o => o.trim()).filter(Boolean),
                ],
                // Email and password beside the example's anonymous sign-in. No
                // mail sender is configured, so addresses are not verified.
                emailAndPassword: { enabled: true },
                // GitHub and Google, each only when its client id and secret are set.
                socialProviders: socialProviders(env),
                verification: {
                    storeInDatabase: true,
                },
                rateLimit: {
                    enabled: true,
                    storage: "database",
                },
                plugins: [openAPI(), anonymous()],
            }
        ),
    });
}

// Singleton pattern to ensure a single auth instance — per origin: its base
// URL and trusted origin are the origin the Worker is reached on, which is one
// origin in practice, so this is the example's singleton.
let authInstance: Awaited<ReturnType<typeof authBuilder>> | null = null;
let authOrigin: string | undefined;

// Asynchronously initializes and retrieves the shared auth instance
export async function initAuth(origin?: string) {
    if (!authInstance || authOrigin !== origin) {
        authInstance = await authBuilder(origin);
        authOrigin = origin;
    }
    return authInstance;
}
