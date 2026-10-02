import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DbClient } from "./client";
import { insertChunked } from "./bulk-insert";
import type { FilaError } from "@/lib/ingestion/types";

/**
 * Estrategia de carga para tablas "foto del momento" (Kardex, BOM, Pedidos,
 * Stock de Seguridad, Órdenes en Proceso, Mallas — ver docs/schema/0001-
 * modelo-datos-borrador.md, "Estrategia de actualización por carga"):
 * cada Excel nuevo reemplaza por completo lo que había antes en esa tabla.
 *
 * Si el archivo no produjo ninguna fila válida, no se toca la base de datos
 * — se aborta para no perder los datos anteriores por un archivo corrupto
 * o mal seleccionado.
 */
export async function replaceIngest<TTable extends PgTable>(
  db: DbClient,
  table: TTable,
  rows: TTable["$inferInsert"][],
  describeRow: (row: TTable["$inferInsert"]) => string,
): Promise<{ inserted: number; errores: FilaError[]; aborted: boolean }> {
  if (rows.length === 0) {
    return { inserted: 0, errores: [], aborted: true };
  }

  await db.delete(table);
  const { inserted, errores } = await insertChunked(db, table, rows, describeRow);
  return { inserted, errores, aborted: false };
}
