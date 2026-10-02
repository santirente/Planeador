import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DbClient } from "./client";
import type { FilaError } from "@/lib/ingestion/types";

const CHUNK_SIZE = 250;
// Por debajo de este tamaño, dejamos de partir a la mitad y probamos fila
// por fila directamente — partir más no compensa el viaje de red extra.
const MIN_SPLIT_SIZE = 20;

async function insertBatch<TTable extends PgTable>(
  db: DbClient,
  table: TTable,
  batch: TTable["$inferInsert"][],
  describeRow: (row: TTable["$inferInsert"]) => string,
  errores: FilaError[],
): Promise<number> {
  if (batch.length === 0) return 0;

  try {
    await db.insert(table).values(batch);
    return batch.length;
  } catch {
    if (batch.length <= MIN_SPLIT_SIZE) {
      let inserted = 0;
      for (const row of batch) {
        try {
          await db.insert(table).values(row);
          inserted++;
        } catch (err) {
          errores.push({
            fila: 0,
            motivo: `${describeRow(row)}: error al guardar en base de datos (${(err as Error).message}).`,
          });
        }
      }
      return inserted;
    }

    // Una o más filas del lote fallan (FK, unique, etc.) — en vez de
    // reintentar las 250 una por una, se parte a la mitad recursivamente
    // hasta aislar solo las filas realmente problemáticas.
    const mid = Math.floor(batch.length / 2);
    const left = await insertBatch(db, table, batch.slice(0, mid), describeRow, errores);
    const right = await insertBatch(db, table, batch.slice(mid), describeRow, errores);
    return left + right;
  }
}

/**
 * Inserta filas en lotes (rápido, pocas idas y vueltas a la red). Si un lote
 * falla (ej. una fila viola una FK o un unique), lo parte a la mitad
 * recursivamente para aislar solo las filas problemáticas — mismo principio
 * de "cargas parciales" que el resto de la ingesta, sin pagar el costo de
 * reintentar cientos de filas buenas una por una por culpa de una sola mala.
 */
export async function insertChunked<TTable extends PgTable>(
  db: DbClient,
  table: TTable,
  rows: TTable["$inferInsert"][],
  describeRow: (row: TTable["$inferInsert"]) => string,
): Promise<{ inserted: number; errores: FilaError[] }> {
  const errores: FilaError[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    inserted += await insertBatch(db, table, rows.slice(i, i + CHUNK_SIZE), describeRow, errores);
  }

  return { inserted, errores };
}
