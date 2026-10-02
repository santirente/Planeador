import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Se crea perezosamente: importar este módulo nunca debe fallar (varias
// páginas hacen `import { db } from "@/lib/db/client"` a nivel de archivo y
// luego chequean isDatabaseConfigured() en runtime — si esto conectara al
// importarse, ese chequeo llegaría demasiado tarde). Solo se intenta
// conectar la primera vez que de verdad se usa `db` (ej. db.select(...)).
//
// El singleton se guarda en `globalThis` (no en una variable de módulo)
// porque en `next dev`, cada Fast Refresh puede volver a evaluar este
// módulo — con una variable de módulo normal, cada recarga crearía una
// conexión nueva a Supabase sin cerrar la anterior (fuga de conexiones
// contra el pooler, que tiene un límite fijo). `globalThis` sobrevive esas
// recargas dentro del mismo proceso de Node.
const globalForDb = globalThis as unknown as { __proplanDb?: Db };

function getInstance(): Db {
  if (globalForDb.__proplanDb) return globalForDb.__proplanDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y agrega la cadena de conexión de tu proyecto Supabase (Project Settings > Database > Connection string > Transaction pooler).",
    );
  }

  // prepare:false es requerido cuando se usa el connection pooler (pgbouncer)
  // de Supabase, que no soporta prepared statements.
  const client = postgres(connectionString, { prepare: false });
  const instance = drizzle(client, { schema });
  globalForDb.__proplanDb = instance;
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver);
  },
});

export type DbClient = Db;
