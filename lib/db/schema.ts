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

// "stock_seguridad" y "en_proceso_inyeccion" se dejan en el enum (aunque ya
// no se aceptan cargas nuevas de esos tipos, ver app/api/ingest/route.ts)
// para no invalidar los registros históricos de `cargas` que ya los usan —
// Postgres no permite quitar valores de un enum sin recrear el tipo.
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
 * BOM/receta (de "3.Boom_Materiales", solo columnas A:L).
 *
 * NO existe una tabla `fichas` separada: se comprobó contra los datos reales
 * que el 100% de los códigos de ficha ya existen como fila en `productos`
 * (mismo código, visto una vez como ítem de catálogo/inventario y otra vez
 * como encabezado de receta). Un producto es el resultado de otros
 * productos (`matpriCode`) más tiempo (`esTiempo`) — por eso `fichaCode`
 * también referencia `productos.itemCode`: es la misma tabla vista dos
 * veces (padre construido / insumo consumido). El BOM es multinivel: un
 * producto puede a la vez ser insumo de otro (ej. una pieza inyectada que
 * luego se ensambla en el producto final) — el motor de balance debe
 * explotar la receta recursivamente, no solo un nivel.
 */
export const bomItems = pgTable("bom_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  fichaCode: text("ficha_code")
    .notNull()
    .references(() => productos.itemCode, { onDelete: "cascade" }),
  matpriCode: text("matpri_code")
    .notNull()
    .references(() => productos.itemCode, { onDelete: "restrict" }),
  cantidad: numeric("cantidad", { precision: 18, scale: 6 }).notNull(),
  etapa: text("etapa"), // INY, EMPAQUE, y otros códigos de etapa/proceso
  unidadMedida: text("unidad_medida"),
  esTiempo: boolean("es_tiempo").notNull().default(false), // true si matpriCode es categoría "tiempo" (bodega 99)
  estado: integer("estado"),
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

/**
 * Configuración editable de la app (clave/valor) — hoy solo el umbral de
 * advertencia del motor de balance, pero deja espacio para más ajustes sin
 * otra migración. Editable desde Administración.
 */
export const configuracion = pgTable("configuracion", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const diaSemanaEnum = pgEnum("dia_semana", [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
]);

/**
 * Capacidad de mano de obra disponible por día (ver docs/BLUEPRINT.md,
 * Capacidad de Mano de Obra). Editable desde Administración — la hoja
 * "Resumen general Tiempo" del Excel tiene un layout irregular que no se
 * pudo mapear automáticamente (ver riesgo abierto en el blueprint), así que
 * por ahora la disponibilidad se configura a mano en vez de ingestarse.
 */
export const capacidadManoObra = pgTable("capacidad_mano_obra", {
  dia: diaSemanaEnum("dia").primaryKey(),
  minutosDisponibles: numeric("minutos_disponibles", { precision: 10, scale: 2 }).notNull().default("0"),
  headcount: integer("headcount"),
  horasExtra: numeric("horas_extra", { precision: 10, scale: 2 }),
  temporales: integer("temporales"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Histórico real de demanda mensual (Predicción de Demanda). `pedidos` se
 * reemplaza por completo en cada carga (es un snapshot, no histórico) — por
 * eso cada carga de Pedidos recalcula y guarda aquí el total del mes de cada
 * fila presente en ese archivo (`capturarSnapshotMensual`, lib/demand). Así
 * el histórico se va acumulando con el tiempo sin depender de que `pedidos`
 * conserve datos viejos.
 */
export const demandaHistoricaMensual = pgTable("demanda_historica_mensual", {
  anioMes: text("anio_mes").primaryKey(), // 'YYYY-MM'
  cantidadTotal: numeric("cantidad_total", { precision: 18, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fuenteReporteEnum = pgEnum("fuente_reporte", ["kardex", "bom", "pedidos"]);
export const tipoGraficoEnum = pgEnum("tipo_grafico", ["bar", "line"]);

/** Reportes guardados del constructor de Análisis Dinámico (BI). */
export const reportesGuardados = pgTable("reportes_guardados", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  fuente: fuenteReporteEnum("fuente").notNull(),
  dimensiones: jsonb("dimensiones").$type<string[]>().notNull(),
  medida: text("medida").notNull(),
  tipoGrafico: tipoGraficoEnum("tipo_grafico").notNull().default("bar"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
