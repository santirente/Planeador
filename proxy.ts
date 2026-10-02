import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// En Next.js 15 este archivo se llamaba middleware.ts y exportaba
// `middleware`. En Next.js 16 el convenio es proxy.ts / `proxy`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // "api" queda excluido a propósito: el proxy tocando el request de rutas
  // de API puede corromper cuerpos binarios/multipart (subida de Excel en
  // /api/ingest) — es el mismo patrón que recomienda la documentación de
  // Next.js. Las rutas de API verifican la sesión ellas mismas.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
