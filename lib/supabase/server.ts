import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Debe crearse una instancia nueva por request (no exportar un
 * singleton) porque lee/escribe las cookies de la request actual.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se puede ignorar si setAll se llama desde un Server Component:
            // el proxy ya se encarga de refrescar la sesión en cada request.
          }
        },
      },
    },
  );
}
