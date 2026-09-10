import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// En Next.js 15 este archivo se llamaba middleware.ts y exportaba
// `middleware`. En Next.js 16 el convenio es proxy.ts / `proxy`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
