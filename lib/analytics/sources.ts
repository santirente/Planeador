import "server-only";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { bomItems, kardexExistencias, mallasClientes, pedidos, productos } from "@/lib/db/schema";

export type FuenteId = "kardex" | "bom" | "pedidos";

export type CampoDef = {
  label: string;
  // Columna o expresión SQL de drizzle. Nunca se construye con texto libre
  // del usuario — el usuario solo elige una clave de este mapa (whitelist),
  // así que no hay riesgo de inyección SQL aunque el reporte sea "dinámico".
  expr: unknown;
};

export type FuenteDef = {
  label: string;
  dimensiones: Record<string, CampoDef>;
  medidas: Record<string, CampoDef>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (shape: Record<string, unknown>) => any;
};

const productosMatpri = alias(productos, "productos_matpri");

export const FUENTES: Record<FuenteId, FuenteDef> = {
  kardex: {
    label: "Kardex de Inventario",
    dimensiones: {
      producto: { label: "Producto", expr: productos.nombre },
      item_code: { label: "Código de Item", expr: kardexExistencias.itemCode },
      bodega: { label: "Bodega", expr: kardexExistencias.codBodega },
      categoria: { label: "Categoría", expr: productos.categoria },
    },
    medidas: {
      existencia: { label: "Existencia (suma)", expr: sql`sum(${kardexExistencias.existencia})` },
      valor_total: { label: "Valor Total (suma)", expr: sql`sum(coalesce(${kardexExistencias.valorTotal}, 0))` },
      conteo: { label: "Conteo de registros", expr: sql`count(*)` },
    },
    from: (shape) =>
      db
        .select(shape as Parameters<typeof db.select>[0])
        .from(kardexExistencias)
        .leftJoin(productos, eq(kardexExistencias.itemCode, productos.itemCode)),
  },
  bom: {
    label: "Lista de Materiales (BOM)",
    dimensiones: {
      ficha: { label: "Producto (Ficha)", expr: productos.nombre },
      insumo: { label: "Insumo", expr: productosMatpri.nombre },
      unidad_medida: { label: "Unidad de Medida", expr: bomItems.unidadMedida },
      es_tiempo: { label: "Es Tiempo", expr: bomItems.esTiempo },
    },
    medidas: {
      cantidad: { label: "Cantidad (suma)", expr: sql`sum(${bomItems.cantidad})` },
      conteo: { label: "Conteo de recetas", expr: sql`count(*)` },
    },
    from: (shape) =>
      db
        .select(shape as Parameters<typeof db.select>[0])
        .from(bomItems)
        .leftJoin(productos, eq(bomItems.fichaCode, productos.itemCode))
        .leftJoin(productosMatpri, eq(bomItems.matpriCode, productosMatpri.itemCode)),
  },
  pedidos: {
    label: "Pedidos de Clientes",
    dimensiones: {
      cliente: { label: "Cliente", expr: pedidos.clienteNombre },
      zona: { label: "Zona", expr: mallasClientes.nombreZona },
      dia_malla: { label: "Día de Malla", expr: pedidos.diaMalla },
      item_code: { label: "Código de Item", expr: pedidos.itemCode },
      mes: { label: "Mes del Pedido", expr: sql`to_char(${pedidos.fecha}, 'YYYY-MM')` },
    },
    medidas: {
      cantidad: { label: "Cantidad (suma)", expr: sql`sum(coalesce(${pedidos.cantidad}, 0))` },
      conteo_pedidos: { label: "Conteo de pedidos", expr: sql`count(distinct ${pedidos.numeroPedido})` },
    },
    from: (shape) =>
      db
        .select(shape as Parameters<typeof db.select>[0])
        .from(pedidos)
        .leftJoin(mallasClientes, eq(pedidos.clienteNit, mallasClientes.nitCliente)),
  },
};

export const FUENTES_LISTA = (Object.keys(FUENTES) as FuenteId[]).map((id) => ({
  id,
  label: FUENTES[id].label,
  dimensiones: Object.entries(FUENTES[id].dimensiones).map(([id2, d]) => ({ id: id2, label: d.label })),
  medidas: Object.entries(FUENTES[id].medidas).map(([id2, m]) => ({ id: id2, label: m.label })),
}));
