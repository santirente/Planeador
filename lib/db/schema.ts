import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Ver docs/schema/0001-modelo-datos-borrador.md para el origen y las decisiones
// detrás de cada tabla. Solo se modelan las hojas del Excel que son fuente
// cruda del ERP Novasoft; las hojas ya calculadas (Materiales, Inyeccion,
// etc.) no tienen tabla — el motor de balance las recalcula en /lib/balance.

export const categoriaProductoEnum = pgEnum("categoria_producto", [
  "materia_prima", // bodega 10
  "en_proceso", // bodega 20
  "producto_terminado", // bodega 30
  "empaque_complementario", // bodega 15 y B0 (no 50 como se asumió inicialmente)
  "tiempo", // bodega 99 — pseudo-material de minutos estándar dentro del BOM (no 90)
]);

export const estadoCargaEnum = pgEnum("estado_carga", [
  "success",
  "warning",
  "error",
]);

export const tipoReporteEnum = pgEnum("tipo_reporte", [
  "productos",
  "bom",
  "kardex",
  "pedidos",
  "stock_seguridad",
  "en_proceso_inyeccion",
  "mallas",
]);

/** Log de cada ingesta de archivo — soporta la pantalla "Carga de Datos". */
export const cargas = pgTable("cargas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tipoReporte: tipoReporteEnum("tipo_reporte").notNull(),
  archivoNombre: text("archivo_nombre").notNull(),
  archivoStoragePath: text("archivo_storage_path"),
  usuarioId: uuid("usuario_id"), // referencia lógica a auth.users (Supabase Auth)
  filasTotales: integer("filas_totales").notNull().default(0),
  filasExitosas: integer("filas_exitosas").notNull().default(0),
  filasError: integer("filas_error").notNull().default(0),
  estado: estadoCargaEnum("estado").notNull(),
  detalleErrores: jsonb("detalle_errores").$type<
    { fila: number; motivo: string }[]
  >(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Catálogo maestro de ítems (de "1. Listado de productos"). */
export const productos = pgTable("productos", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  codAlt: text("cod_alt"),
  nombre: text("nombre").notNull(),
  upc: text("upc"),
  bodegaBase: text("bodega_base").notNull(), // '10' | '20' | '30' | '50' | '90'
  categoria: categoriaProductoEnum("categoria").notNull(),
  estado: integer("estado"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Maestro de fichas/piezas producidas (código formato NNNN-NNN-NN).
 * Espacio de numeración propio, independiente de `productos` — confirmado
 * con el usuario, ver docs/schema/0001-modelo-datos-borrador.md.
 */
export const fichas = pgTable("fichas", {
  id: uuid("id").defaultRandom().primaryKey(),
  fichaCode: text("ficha_code").notNull().unique(),
  nombre: text("nombre"),
  alterno: text("alterno"),
  estado: integer("estado"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** BOM/receta (de "3.Boom_Materiales", solo columnas A:L). */
export const bomItems = pgTable("bom_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  fichaCode: text("ficha_code")
    .notNull()
    .references(() => fichas.fichaCode, { onDelete: "cascade" }),
  matpriCode: text("matpri_code")
    .notNull()
    .references(() => productos.itemCode, { onDelete: "restrict" }),
  cantidad: numeric("cantidad", { precision: 18, scale: 6 }).notNull(),
  etapa: text("etapa"), // INY, EMPAQUE, etc.
  unidadMedida: text("unidad_medida"),
  esTiempo: boolean("es_tiempo").notNull().default(false), // true si matpriCode es bodega 90
  fechaActualizacion: date("fecha_actualizacion"),
  cargaId: uuid("carga_id").references(() => cargas.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Existencias por bodega (de "4. Kardex NS diario"). Solo se conserva el
 * snapshot más reciente por item+bodega (upsert en cada carga) — sin
 * histórico día a día, según lo confirmado con el usuario.
 */
export const kardexExistencias = pgTable(
  "kardex_existencias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemCode: text("item_code")
      .notNull()
      .references(() => productos.itemCode, { onDelete: "cascade" }),
    codBodega: text("cod_bodega").notNull(),
    anio: integer("anio"),
    existencia: numeric("existencia", { precision: 18, scale: 4 }).notNull(),
    valorTotal: numeric("valor_total", { precision: 18, scale: 2 }),
    cargaId: uuid("carga_id").references(() => cargas.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("kardex_item_bodega_uq").on(t.itemCode, t.codBodega)],
);

/** Pedidos reales de clientes (de "5. Pedidos_Novasoft"). */
export const pedidos = pgTable("pedidos", {
  id: uuid("id").defaultRandom().primaryKey(),
  numeroPedido: text("numero_pedido").notNull(),
  fecha: date("fecha"),
  fechaEntrega: date("fecha_entrega"),
  clienteNit: text("cliente_nit"),
  clienteNombre: text("cliente_nombre"),
  // Sin FK estricta: algunas filas del export traen códigos que no son
  // producto (ej. servicios de flete/exportación) — se valida en la
  // ingesta, no a nivel de esquema, para permitir cargas parciales.
  itemCode: text("item_code").notNull(),
  bodega: text("bodega"),
  cantidad: numeric("cantidad", { precision: 18, scale: 4 }),
  sem1: numeric("sem1", { precision: 18, scale: 4 }),
  sem2: numeric("sem2", { precision: 18, scale: 4 }),
  sem3: numeric("sem3", { precision: 18, scale: 4 }),
  sem4: numeric("sem4", { precision: 18, scale: 4 }),
  diaMalla: text("dia_malla"),
  fechaCorte: date("fecha_corte"),
  estadoPedido: text("estado_pedido"),
  cargaId: uuid("carga_id").references(() => cargas.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Objetivo de stock de seguridad (de "6. Stock Semanal", ~2 semanas de
 * cobertura). No es inventario: es demanda adicional que se cruza junto
 * con `pedidos` para calcular la necesidad total.
 */
export const demandaStockSeguridad = pgTable("demanda_stock_seguridad", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemCode: text("item_code").notNull(),
  bodega: text("bodega"),
  cantidadObjetivo: numeric("cantidad_objetivo", {
    precision: 18,
    scale: 4,
  }).notNull(),
  cargaId: uuid("carga_id").references(() => cargas.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Órdenes de inyección en curso (de "En proceso Inyeccion"). */
export const ordenesProduccionInyeccion = pgTable(
  "ordenes_produccion_inyeccion",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    numeroOrden: text("numero_orden").notNull(),
    numProceso: text("num_proceso"),
    fichaCode: text("ficha_code")
      .notNull()
      .references(() => fichas.fichaCode, { onDelete: "cascade" }),
    cantidadProgramada: numeric("cantidad_programada", {
      precision: 18,
      scale: 4,
    }),
    cantidadEntregada: numeric("cantidad_entregada", {
      precision: 18,
      scale: 4,
    }),
    maquinaInyectora: text("maquina_inyectora"),
    estado: text("estado"),
    tiempoUnitario: numeric("tiempo_unitario", { precision: 18, scale: 6 }),
    totalTiempo: numeric("total_tiempo", { precision: 18, scale: 4 }),
    totalHoras: numeric("total_horas", { precision: 18, scale: 4 }),
    cargaId: uuid("carga_id").references(() => cargas.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** Referencia de rutas/zonas de despacho por cliente (de "2. Listado de mallas"). */
export const mallasClientes = pgTable("mallas_clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nitCliente: text("nit_cliente").notNull(),
  nombreClientePrincipal: text("nombre_cliente_principal"),
  nombrePunto: text("nombre_punto"),
  zona: text("zona"),
  nombreZona: text("nombre_zona"),
  ciudad: text("ciudad"),
  diaDespacho: text("dia_despacho"),
  diaMalla: text("dia_malla"),
  cargaId: uuid("carga_id").references(() => cargas.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
