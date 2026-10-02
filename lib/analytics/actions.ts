"use server";

import { revalidatePath } from "next/cache";
import { eliminarReporte, guardarReporte, runReporte, type ReporteConfig, type ReporteResultado } from "./queries";
import type { reportesGuardados } from "@/lib/db/schema";
import type { FuenteId } from "./sources";

type ReporteGuardadoRow = typeof reportesGuardados.$inferSelect;

export async function ejecutarReporteAction(config: {
  fuente: FuenteId;
  dimensiones: string[];
  medida: string;
  limite?: number | null;
}): Promise<ReporteResultado | { error: string }> {
  try {
    return await runReporte(config);
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function guardarReporteAction(
  config: ReporteConfig & { nombre: string },
): Promise<{ reporte: ReporteGuardadoRow } | { error: string }> {
  if (!config.nombre.trim()) return { error: "Ponle un nombre al reporte." };
  const reporte = await guardarReporte(config);
  revalidatePath("/dynamic-analysis");
  return { reporte };
}

export async function eliminarReporteAction(id: string) {
  await eliminarReporte(id);
  revalidatePath("/dynamic-analysis");
}
