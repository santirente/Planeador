import "server-only";
import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reportesGuardados } from "@/lib/db/schema";
import { FUENTES, type FuenteId } from "./sources";

export type ReporteConfig = {
  fuente: FuenteId;
  dimensiones: string[];
  medida: string;
  tipoGrafico: "bar" | "line";
};

export type ReporteResultado = {
  filas: (Record<string, unknown> & { valor: number })[];
  dimensionesUsadas: string[];
};

// Tope duro aunque se pida "Todos" — los volúmenes reales de hoy son de
// cientos a pocos miles de filas por tabla (ver riesgo #4 en BLUEPRINT.md),
// así que esto solo protege de una combinación de dimensiones patológica
// (muchísimas categorías únicas), no limita ningún caso de uso real.
export const LIMITE_MAXIMO = 500;
export const LIMITE_DEFECTO = 15;

/**
 * Ejecuta un reporte "dinámico" contra una fuente real, validando
 * dimensión/medida contra el whitelist de `lib/analytics/sources.ts` — el
 * usuario nunca controla SQL crudo, solo elige claves de ese mapa.
 */
export async function runReporte(config: {
  fuente: FuenteId;
  dimensiones: string[];
  medida: string;
  limite?: number | null;
}): Promise<ReporteResultado> {
  const fuenteDef = FUENTES[config.fuente];
  if (!fuenteDef) throw new Error("Fuente no reconocida.");

  const dims = config.dimensiones.filter((d) => fuenteDef.dimensiones[d]);
  if (dims.length === 0) throw new Error("Selecciona al menos una dimensión.");

  const medidaDef = fuenteDef.medidas[config.medida];
  if (!medidaDef) throw new Error("Medida no reconocida.");

  const shape: Record<string, unknown> = {};
  for (const dim of dims) shape[dim] = fuenteDef.dimensiones[dim].expr;
  shape.valor = medidaDef.expr;

  const groupByExprs = dims.map((dim) => fuenteDef.dimensiones[dim].expr);

  // Como ya viene ordenado por la medida descendente, el límite recorta los
  // valores más bajos, no los más relevantes.
  const limite = Math.min(config.limite ?? LIMITE_DEFECTO, LIMITE_MAXIMO);

  const rows = await fuenteDef
    .from(shape)
    .groupBy(...groupByExprs)
    .orderBy(sql`${medidaDef.expr} desc`)
    .limit(limite);

  return {
    filas: rows.map((r: Record<string, unknown>) => ({ ...r, valor: Number(r.valor) })),
    dimensionesUsadas: dims,
  };
}

export async function listarReportes() {
  return db.select().from(reportesGuardados).orderBy(desc(reportesGuardados.updatedAt));
}

export async function guardarReporte(config: ReporteConfig & { nombre: string }) {
  const [reporte] = await db
    .insert(reportesGuardados)
    .values({
      nombre: config.nombre,
      fuente: config.fuente,
      dimensiones: config.dimensiones,
      medida: config.medida,
      tipoGrafico: config.tipoGrafico,
    })
    .returning();
  return reporte;
}

export async function eliminarReporte(id: string) {
  await db.delete(reportesGuardados).where(eq(reportesGuardados.id, id));
}
