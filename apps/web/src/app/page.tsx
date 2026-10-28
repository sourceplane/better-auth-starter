import { getCloudflareContext } from "@opennextjs/cloudflare";
import { configuredProviders } from "@/auth/providers";
import SignInCard from "./SignInCard";

// Per request: which OAuth providers are offered depends on the Worker's
// secrets, which a redeploy can change without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
    const { env } = await getCloudflareContext({ async: true });
    return <SignInCard providers={configuredProviders(env)} />;
}
