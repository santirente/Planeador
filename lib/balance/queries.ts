import "server-only";
import { computeBalance, type BalanceNode } from "./engine";
import { getUmbralAdvertenciaPct } from "@/lib/config/queries";

export type EstadoBalance = "critical" | "warning" | "ok";

/**
 * Un balance negativo siempre es déficit real → crítico. Un balance
 * positivo pero angosto (menos del `umbralPct`% de la necesidad como
 * colchón) se marca advertencia — configurable desde Administración
 * ("Umbral de Déficit Crítico", ver lib/config/queries.ts).
 */
function estadoDe(balance: number, necesidad: number, umbralPct: number): EstadoBalance {
  if (balance < 0) return "critical";
  if (necesidad <= 0) return "ok";
  const colchonPct = (balance / necesidad) * 100;
  return colchonPct <= umbralPct ? "warning" : "ok";
}

export type NecesidadRow = {
  itemCode: string;
  nombre: string;
  stock: number;
  necesidad: number;
  balance: number;
  estado: EstadoBalance;
};

function toNecesidadRow(n: BalanceNode, umbralPct: number): NecesidadRow {
  return {
    itemCode: n.itemCode,
    nombre: n.nombre,
    stock: n.onHand,
    necesidad: n.grossRequirement,
    balance: n.balance,
    estado: estadoDe(n.balance, n.grossRequirement, umbralPct),
  };
}

const CATEGORIAS_INSUMO = new Set(["materia_prima", "empaque_complementario"]);

/**
 * Necesidad de Compra (Insumos): ítems hoja (sin receta propia) de
 * categoría materia prima o empaque, con demanda real explotada desde el
 * BOM. Se excluye "tiempo" — no es comprable, eso es capacidad de mano de
 * obra (fuera de alcance por ahora, ver docs/BLUEPRINT.md).
 */
export async function getNecesidadCompra(): Promise<NecesidadRow[]> {
  const [nodes, umbralPct] = await Promise.all([computeBalance(), getUmbralAdvertenciaPct()]);
  return [...nodes.values()]
    .filter((n) => n.esHoja && CATEGORIAS_INSUMO.has(n.categoria) && n.grossRequirement > 0)
    .map((n) => toNecesidadRow(n, umbralPct))
    .sort((a, b) => a.balance - b.balance);
}

/**
 * Necesidad de Inyección (Piezas): ítems en proceso (con o sin receta
 * propia — pueden ser un nivel intermedio de un BOM multinivel) con
 * demanda real.
 */
export async function getNecesidadInyeccion(): Promise<NecesidadRow[]> {
  const [nodes, umbralPct] = await Promise.all([computeBalance(), getUmbralAdvertenciaPct()]);
  return [...nodes.values()]
    .filter((n) => n.categoria === "en_proceso" && n.grossRequirement > 0)
    .map((n) => toNecesidadRow(n, umbralPct))
    .sort((a, b) => a.balance - b.balance);
}

export type BalanceSummary = {
  insumosEnDeficit: number;
  piezasEnDeficit: number;
};

export async function getBalanceSummary(): Promise<BalanceSummary> {
  const nodes = await computeBalance();
  let insumosEnDeficit = 0;
  let piezasEnDeficit = 0;
  for (const n of nodes.values()) {
    if (n.balance >= 0) continue;
    if (n.esHoja && CATEGORIAS_INSUMO.has(n.categoria)) insumosEnDeficit++;
    if (n.categoria === "en_proceso") piezasEnDeficit++;
  }
  return { insumosEnDeficit, piezasEnDeficit };
}
