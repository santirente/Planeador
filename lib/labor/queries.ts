import "server-only";
import { db } from "@/lib/db/client";
import { capacidadManoObra } from "@/lib/db/schema";
import { computeBalance } from "@/lib/balance/engine";

export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export const DIAS_SEMANA: DiaSemana[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export type CapacidadDia = {
  dia: DiaSemana;
  minutosDisponibles: number;
  headcount: number | null;
  horasExtra: number | null;
  temporales: number | null;
  // Se usa como `key` del formulario en /labor: fuerza a React a remontar
  // los <Input defaultValue> (no controlados) cuando el dato realmente
  // cambió (después de Guardar), en vez de dejar el warning de Base UI
  // "changing the default value state of an uncontrolled FieldControl".
  actualizadoEn: number;
};

export async function getCapacidadSemana(): Promise<CapacidadDia[]> {
  const rows = await db.select().from(capacidadManoObra);
  const byDia = new Map(rows.map((r) => [r.dia, r]));
  return DIAS_SEMANA.map((dia) => {
    const r = byDia.get(dia);
    return {
      dia,
      minutosDisponibles: r ? Number(r.minutosDisponibles) : 0,
      headcount: r?.headcount ?? null,
      horasExtra: r?.horasExtra ? Number(r.horasExtra) : null,
      temporales: r?.temporales ?? null,
      actualizadoEn: r?.updatedAt ? r.updatedAt.getTime() : 0,
    };
  });
}

export async function setCapacidadDia(
  dia: DiaSemana,
  valores: { minutosDisponibles: number; headcount: number | null; horasExtra: number | null; temporales: number | null },
): Promise<void> {
  const row = {
    dia,
    minutosDisponibles: String(valores.minutosDisponibles),
    headcount: valores.headcount,
    horasExtra: valores.horasExtra !== null ? String(valores.horasExtra) : null,
    temporales: valores.temporales,
    updatedAt: new Date(),
  };
  await db
    .insert(capacidadManoObra)
    .values(row)
    .onConflictDoUpdate({ target: capacidadManoObra.dia, set: row });
}

/**
 * Necesidad total de minutos de mano de obra (semanal, agregada): suma de
 * todos los nodos categoría "tiempo" que el motor de balance tocó al
 * explotar la demanda real. No está distribuida por día — eso requeriría
 * programación hacia atrás desde fecha_entrega, que no está implementada
 * todavía (ver docs/BLUEPRINT.md, riesgo de "Resumen general Tiempo").
 */
export async function getNecesidadMinutosTotal(): Promise<number> {
  const nodes = await computeBalance();
  let total = 0;
  for (const n of nodes.values()) {
    if (n.categoria === "tiempo") total += n.grossRequirement;
  }
  return total;
}
