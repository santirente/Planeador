import "server-only";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { configuracion } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const DEFAULT_UMBRAL_ADVERTENCIA_PCT = 15;

/**
 * % de colchón sobre la necesidad por debajo del cual un balance positivo
 * se marca "advertencia" en vez de "ok" (ver lib/balance/queries.ts). Un
 * balance negativo siempre es "crítico", sin importar este umbral.
 *
 * Memoizado por request — se llama una vez por cada vista de necesidad
 * (Compra e Inyección) dentro del mismo render del Dashboard.
 */
export const getUmbralAdvertenciaPct = cache(async (): Promise<number> => {
  const [row] = await db
    .select({ valor: configuracion.valor })
    .from(configuracion)
    .where(eq(configuracion.clave, "umbral_advertencia_pct"));
  const n = row ? Number(row.valor) : NaN;
  return Number.isFinite(n) ? n : DEFAULT_UMBRAL_ADVERTENCIA_PCT;
});

export async function setUmbralAdvertenciaPct(pct: number): Promise<void> {
  await db
    .insert(configuracion)
    .values({ clave: "umbral_advertencia_pct", valor: String(pct) })
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: { valor: sql`excluded.valor`, updatedAt: new Date() },
    });
}

const DEFAULT_SEMANAS_COLCHON_STOCK_SEGURIDAD = 2;

/**
 * Semanas de colchón para el stock de seguridad derivado (ver
 * lib/balance/engine.ts). No existe un archivo aparte de Novasoft para el
 * objetivo de stock de seguridad (confirmado con el usuario, 2026-09-12) —
 * se calcula cruzando el histórico de `pedidos`: promedio de demanda
 * semanal por ítem × estas semanas de colchón.
 */
export const getSemanasColchonStockSeguridad = cache(async (): Promise<number> => {
  const [row] = await db
    .select({ valor: configuracion.valor })
    .from(configuracion)
    .where(eq(configuracion.clave, "semanas_colchon_stock_seguridad"));
  const n = row ? Number(row.valor) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SEMANAS_COLCHON_STOCK_SEGURIDAD;
});

export async function setSemanasColchonStockSeguridad(semanas: number): Promise<void> {
  await db
    .insert(configuracion)
    .values({ clave: "semanas_colchon_stock_seguridad", valor: String(semanas) })
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: { valor: sql`excluded.valor`, updatedAt: new Date() },
    });
}
