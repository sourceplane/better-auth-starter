import { initAuth } from "@/auth";
import { requestOrigin } from "@/auth/origin";

export async function POST(req: Request) {
    const auth = await initAuth(requestOrigin(req));
    return auth.handler(req);
}

export async function GET(req: Request) {
    const auth = await initAuth(requestOrigin(req));
    return auth.handler(req);
}
