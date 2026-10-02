import "server-only";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { productos, bomItems, kardexExistencias, pedidos } from "@/lib/db/schema";
import { getSemanasColchonStockSeguridad } from "@/lib/config/queries";

/**
 * Motor de Balance — explosión de BOM multinivel (MRP clásico).
 *
 * Un producto es el resultado de otros productos + tiempo (ver
 * docs/BLUEPRINT.md §6.3 y §8). Partiendo de la demanda real (pedidos +
 * stock de seguridad derivado) sobre productos terminados, se "explota" la
 * receta (`bom_items`) recursivamente: en cada nivel se resta lo que ya hay
 * en kardex (netting) ANTES de seguir explotando hacia abajo — así no se
 * piden materiales para piezas que ya están en stock.
 *
 * Se hace en memoria (no con una CTE recursiva en SQL): las tablas
 * involucradas son de a lo sumo unos pocos miles de filas, así que traerlas
 * completas una vez y explotar en JS es simple, rápido y fácil de probar.
 *
 * Solo 5 archivos vienen realmente de Novasoft (confirmado con el usuario,
 * 2026-09-12): Listado de productos, Listado de mallas, BOM materiales,
 * Kardex diario y Pedidos. Ya no existen archivos separados de "Stock de
 * Seguridad" ni "Órdenes en Proceso de Inyección" — esos dos ya no se
 * ingestan; se derivan cruzando los datos reales:
 * - Stock de seguridad: promedio de demanda semanal por ítem (de `pedidos`,
 *   sobre el rango de fechas real cubierto) × semanas de colchón
 *   configurables en Administración (`lib/config/queries.ts`).
 * - Producción en proceso: ya no se neta aparte — la existencia en Kardex
 *   de un ítem "en proceso" (bodega 20) siempre estuvo incluida en su
 *   `onHand`, así que no hace falta una fuente adicional para representarla.
 */

export type BalanceNode = {
  itemCode: string;
  nombre: string;
  categoria: string;
  /** Cuánto se necesita en total de este ítem (sumando todas las rutas de demanda que llegan a él). */
  grossRequirement: number;
  /** Existencia en kardex (todas las bodegas). */
  onHand: number;
  /** max(0, grossRequirement - onHand) — lo que falta por conseguir/producir. */
  net: number;
  /** Balance con signo para mostrar en UI: onHand - grossRequirement (negativo = déficit). */
  balance: number;
  /** true si este ítem no tiene receta propia en `bom_items` (no se explota más allá). */
  esHoja: boolean;
};

const MAX_DEPTH = 15;

/**
 * Memoizado por request con React `cache()`: el Dashboard llama a
 * getBalanceSummary(), getNecesidadCompra() y getNecesidadInyeccion() en el
 * mismo render, y las tres necesitan computeBalance(). Sin esto se
 * recalculaba 3 veces desde cero (18 consultas en paralelo en vez de 6),
 * lo que en producción tardaba 10-20s en vez de ~1s.
 */
export const computeBalance = cache(async (): Promise<Map<string, BalanceNode>> => {
  const [productosRows, bomRows, kardexRows, pedidosRows, semanasColchon] = await Promise.all([
    db.select({ itemCode: productos.itemCode, nombre: productos.nombre, categoria: productos.categoria }).from(
      productos,
    ),
    db
      .select({ fichaCode: bomItems.fichaCode, matpriCode: bomItems.matpriCode, cantidad: bomItems.cantidad })
      .from(bomItems),
    db.select({ itemCode: kardexExistencias.itemCode, existencia: kardexExistencias.existencia }).from(
      kardexExistencias,
    ),
    db
      .select({
        itemCode: pedidos.itemCode,
        cantidad: pedidos.cantidad,
        fecha: pedidos.fecha,
        fechaEntrega: pedidos.fechaEntrega,
      })
      .from(pedidos),
    getSemanasColchonStockSeguridad(),
  ]);

  const productoInfo = new Map(productosRows.map((p) => [p.itemCode, { nombre: p.nombre, categoria: p.categoria }]));

  const bomByFicha = new Map<string, { matpriCode: string; cantidad: number }[]>();
  for (const row of bomRows) {
    const list = bomByFicha.get(row.fichaCode) ?? [];
    list.push({ matpriCode: row.matpriCode, cantidad: Number(row.cantidad) });
    bomByFicha.set(row.fichaCode, list);
  }

  const onHandByItem = new Map<string, number>();
  for (const row of kardexRows) {
    onHandByItem.set(row.itemCode, (onHandByItem.get(row.itemCode) ?? 0) + Number(row.existencia));
  }

  // Rango de fechas real cubierto por los pedidos actualmente cargados —
  // convierte demanda total por ítem en promedio semanal. Es global (no por
  // ítem) para que un ítem con pocos pedidos no quede con un promedio
  // inflado por una ventana de tiempo artificialmente corta.
  let fechaMinMs: number | null = null;
  let fechaMaxMs: number | null = null;
  // El reporte plano FAC0015 (pedidos pendientes por semanas) no trae la
  // fecha del pedido, solo la de entrega — se usa esa como respaldo para que
  // el rango no quede vacío (semanasCubiertas=1 multiplicaría la demanda).
  for (const row of pedidosRows) {
    const fechaRef = row.fecha ?? row.fechaEntrega;
    if (!fechaRef) continue;
    const t = new Date(fechaRef).getTime();
    if (fechaMinMs === null || t < fechaMinMs) fechaMinMs = t;
    if (fechaMaxMs === null || t > fechaMaxMs) fechaMaxMs = t;
  }
  const MS_POR_SEMANA = 1000 * 60 * 60 * 24 * 7;
  const semanasCubiertas =
    fechaMinMs !== null && fechaMaxMs !== null ? Math.max(1, (fechaMaxMs - fechaMinMs) / MS_POR_SEMANA) : 1;

  const demandaPedidosPorItem = new Map<string, number>();
  for (const row of pedidosRows) {
    if (!row.cantidad) continue;
    demandaPedidosPorItem.set(row.itemCode, (demandaPedidosPorItem.get(row.itemCode) ?? 0) + Number(row.cantidad));
  }

  // Demanda inicial (nivel 0): pedidos reales + stock de seguridad derivado
  // (promedio semanal de pedidos de ese ítem × semanas de colchón).
  const demandaInicial = new Map<string, number>();
  for (const [itemCode, totalPedidos] of demandaPedidosPorItem) {
    const promedioSemanal = totalPedidos / semanasCubiertas;
    const stockSeguridad = promedioSemanal * semanasColchon;
    demandaInicial.set(itemCode, totalPedidos + stockSeguridad);
  }

  const nodes = new Map<string, BalanceNode>();

  function toNode(itemCode: string, grossRequirement: number): BalanceNode {
    const info = productoInfo.get(itemCode);
    const onHand = onHandByItem.get(itemCode) ?? 0;
    const net = Math.max(0, grossRequirement - onHand);
    return {
      itemCode,
      nombre: info?.nombre ?? itemCode,
      categoria: info?.categoria ?? "desconocida",
      grossRequirement,
      onHand,
      net,
      balance: onHand - grossRequirement,
      esHoja: !bomByFicha.has(itemCode),
    };
  }

  function explode(itemCode: string, grossQty: number, depth: number) {
    if (depth > MAX_DEPTH || grossQty <= 0) return;

    const existing = nodes.get(itemCode);
    const bomChildren = bomByFicha.get(itemCode);

    if (existing) {
      // Ya se tocó este ítem desde otra rama de demanda (es un grafo, no un
      // árbol) — se acumula y solo se vuelve a explotar el incremento neto.
      const prevNet = existing.net;
      const nuevo = toNode(itemCode, existing.grossRequirement + grossQty);
      nodes.set(itemCode, nuevo);
      const deltaNet = nuevo.net - prevNet;
      if (deltaNet > 0 && bomChildren) {
        for (const child of bomChildren) {
          explode(child.matpriCode, deltaNet * child.cantidad, depth + 1);
        }
      }
      return;
    }

    const nodo = toNode(itemCode, grossQty);
    nodes.set(itemCode, nodo);

    if (nodo.net > 0 && bomChildren) {
      for (const child of bomChildren) {
        explode(child.matpriCode, nodo.net * child.cantidad, depth + 1);
      }
    }
  }

  for (const [itemCode, qty] of demandaInicial) {
    explode(itemCode, qty, 0);
  }

  return nodes;
});
