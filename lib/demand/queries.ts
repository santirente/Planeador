import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pedidos, demandaHistoricaMensual } from "@/lib/db/schema";

export type PuntoDemanda = {
  anioMes: string;
  real: number | null;
  proyectado: number | null;
};

/**
 * `pedidos` se reemplaza por completo en cada carga (es un snapshot, no
 * histórico) — por eso cada carga de Pedidos recalcula el total real de cada
 * mes presente en el archivo y lo guarda/actualiza aquí. Así el histórico se
 * va acumulando con el tiempo sin depender de que `pedidos` conserve datos
 * viejos. Se usa `fecha` (fecha real del pedido), no `fechaEntrega`.
 */
export async function capturarSnapshotMensual(): Promise<number> {
  const filas = await db
    .select({
      anioMes: sql<string>`to_char(${pedidos.fecha}, 'YYYY-MM')`,
      total: sql<string>`sum(${pedidos.cantidad})`,
    })
    .from(pedidos)
    .where(sql`${pedidos.fecha} is not null`)
    .groupBy(sql`to_char(${pedidos.fecha}, 'YYYY-MM')`);

  for (const fila of filas) {
    await db
      .insert(demandaHistoricaMensual)
      .values({ anioMes: fila.anioMes, cantidadTotal: fila.total })
      .onConflictDoUpdate({
        target: demandaHistoricaMensual.anioMes,
        set: { cantidadTotal: fila.total, updatedAt: new Date() },
      });
  }

  return filas.length;
}

const MESES_A_PROYECTAR = 3;
// Con menos meses una recta de mínimos cuadrados no dice nada confiable —
// se prefiere no mostrar proyección a mostrar una inventada.
const MIN_MESES_PARA_PROYECTAR = 3;

function sumarMeses(anioMes: string, n: number): string {
  const [anio, mes] = anioMes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Meses transcurridos desde una época fija — permite tratar el tiempo real
 * entre meses (los datos son ralos: puede haber huecos de varios meses o
 * años entre una carga de Pedidos y la siguiente), en vez de asumir que los
 * meses con datos están espaciados uniformemente. */
function mesesDesdeEpoca(anioMes: string): number {
  const [anio, mes] = anioMes.split("-").map(Number);
  return anio * 12 + (mes - 1);
}

/** Regresión lineal simple (mínimos cuadrados) sobre meses reales transcurridos. */
function proyectarLineal(xs: number[], valores: number[], xsFuturos: number[]): number[] {
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = valores.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (valores[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const pendiente = den === 0 ? 0 : num / den;
  const intercepto = yMean - pendiente * xMean;

  return xsFuturos.map((x) => Math.max(0, intercepto + pendiente * x));
}

export async function getSerieDemandaMensual(): Promise<{
  puntos: PuntoDemanda[];
  suficienteHistorico: boolean;
  mesesHistoricos: number;
}> {
  const historico = await db
    .select()
    .from(demandaHistoricaMensual)
    .orderBy(demandaHistoricaMensual.anioMes);

  const suficienteHistorico = historico.length >= MIN_MESES_PARA_PROYECTAR;
  const puntos: PuntoDemanda[] = historico.map((h) => ({
    anioMes: h.anioMes,
    real: Number(h.cantidadTotal),
    proyectado: null,
  }));

  if (suficienteHistorico && puntos.length > 0) {
    const xs = historico.map((h) => mesesDesdeEpoca(h.anioMes));
    const valores = historico.map((h) => Number(h.cantidadTotal));
    const ultimoMes = historico[historico.length - 1].anioMes;
    const mesesFuturos = Array.from({ length: MESES_A_PROYECTAR }, (_, i) => sumarMeses(ultimoMes, i + 1));
    const proyeccion = proyectarLineal(xs, valores, mesesFuturos.map(mesesDesdeEpoca));

    // El último punto real también lleva valor proyectado, para que la
    // línea punteada arranque conectada a la línea real en el gráfico.
    puntos[puntos.length - 1].proyectado = puntos[puntos.length - 1].real;

    proyeccion.forEach((valor, i) => {
      puntos.push({
        anioMes: mesesFuturos[i],
        real: null,
        proyectado: Math.round(valor * 100) / 100,
      });
    });
  }

  return { puntos, suficienteHistorico, mesesHistoricos: historico.length };
}
