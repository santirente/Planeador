import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example a .env.local y agrega la cadena de conexión de tu proyecto Supabase (Project Settings > Database > Connection string > Transaction pooler).",
  );
}

// prepare:false es requerido cuando se usa el connection pooler (pgbouncer)
// de Supabase, que no soporta prepared statements.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
