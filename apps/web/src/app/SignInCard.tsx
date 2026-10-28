"use client";

import authClient from "@/auth/authClient";
import { PROVIDER_LABEL, type Provider } from "@/auth/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";
import { Github, Package } from "lucide-react";
import { useState } from "react";

// The example's sign-in card — anonymous sign-in, "no personal information
// required" — with email and password beside it, and a button per OAuth
// provider this deployment has keys for.
export default function SignInCard({ providers }: { providers: Provider[] }) {
    const { error: sessionError } = authClient.useSession();
    const [isAuthActionInProgress, setIsAuthActionInProgress] = useState(false);
    const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    // Signed in: the proxy sends the visitor on to the dashboard.
    const done = () => window.location.reload();

    const handleAnonymousLogin = async () => {
        setIsAuthActionInProgress(true);
        setMessage(null);
        try {
            const result = await authClient.signIn.anonymous();
            if (result.error) {
                setIsAuthActionInProgress(false);
                setMessage(`Anonymous login failed: ${result.error.message}`);
            } else {
                done();
            }
        } catch (e) {
            setIsAuthActionInProgress(false);
            setMessage(`An unexpected error occurred during login: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleEmail = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsAuthActionInProgress(true);
        setMessage(null);
        try {
            const result =
                mode === "sign-up"
                    ? await authClient.signUp.email({ name: name.trim() || email, email, password })
                    : await authClient.signIn.email({ email, password });
            if (result.error) {
                setIsAuthActionInProgress(false);
                setMessage(result.error.message ?? "Sign-in failed.");
            } else {
                done();
            }
        } catch (e) {
            setIsAuthActionInProgress(false);
            setMessage(`An unexpected error occurred: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleSocial = async (provider: Provider) => {
        setIsAuthActionInProgress(true);
        setMessage(null);
        const result = await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
        if (result.error) {
            setIsAuthActionInProgress(false);
            setMessage(result.error.message ?? `${PROVIDER_LABEL[provider]} sign-in failed.`);
        }
    };

    if (sessionError) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p>Error loading session: {sessionError.message}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-6 font-[family-name:var(--font-geist-sans)]">
            <h1 className="text-3xl font-bold">{SITE_NAME}</h1>
            <Card className="w-full max-w-sm" data-providers={providers.join(",")}>
                <CardHeader>
                    <CardTitle className="text-2xl">Login</CardTitle>
                    <CardDescription>Powered by better-auth-cloudflare.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <Tabs defaultValue="email" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="email">Email</TabsTrigger>
                            <TabsTrigger value="anonymous">Anonymous</TabsTrigger>
                        </TabsList>
                        <TabsContent value="email">
                            <form className="grid gap-3" onSubmit={handleEmail}>
                                {mode === "sign-up" && (
                                    <div className="grid gap-1">
                                        <Label htmlFor="name">Name</Label>
                                        <Input id="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                                    </div>
                                )}
                                <div className="grid gap-1">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isAuthActionInProgress}>
                                    {isAuthActionInProgress ? "Working..." : mode === "sign-up" ? "Create account" : "Sign in"}
                                </Button>
                                <button
                                    type="button"
                                    className="text-sm text-gray-600 hover:text-gray-900"
                                    onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
                                >
                                    {mode === "sign-up" ? "Have an account? Sign in" : "New here? Create an account"}
                                </button>
                            </form>
                        </TabsContent>
                        <TabsContent value="anonymous" className="grid gap-4">
                            <p className="text-sm text-gray-600 text-center">No personal information required.</p>
                            <Button onClick={handleAnonymousLogin} className="w-full" disabled={isAuthActionInProgress}>
                                {isAuthActionInProgress ? "Logging In..." : "Login Anonymously"}
                            </Button>
                        </TabsContent>
                    </Tabs>
                    {message && (
                        <p role="alert" className="text-red-600 text-sm text-center">
                            {message}
                        </p>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    {providers.map(p => (
                        <Button key={p} variant="outline" className="w-full" disabled={isAuthActionInProgress} onClick={() => handleSocial(p)}>
                            Continue with {PROVIDER_LABEL[p]}
                        </Button>
                    ))}
                    {providers.length === 0 && (
                        <p className="text-xs text-gray-500 text-center" data-connect="oauth">
                            GitHub or Google sign-in: store the provider&apos;s client id and secret as secrets
                            (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) and
                            redeploy.
                        </p>
                    )}
                </CardFooter>
            </Card>
            <footer className="w-full text-center text-sm text-gray-500 py-4">
                <div className="space-y-3">
                    <div>Powered by better-auth-cloudflare</div>
                    <div className="flex items-center justify-center gap-4">
                        <a
                            href="https://github.com/zpg6/better-auth-cloudflare"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <Github size={16} />
                            <span>GitHub</span>
                        </a>
                        <a
                            href="https://www.npmjs.com/package/better-auth-cloudflare"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <Package size={16} />
                            <span>npm</span>
                        </a>
                        <a href={SOURCE_URL} className="hover:text-gray-700 transition-colors" data-source="site">
                            Source
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
