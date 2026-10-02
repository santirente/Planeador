import { sql } from "drizzle-orm";
import { parseProductosSheet, type ProductoRow } from "@/lib/ingestion/productos";
import { parseKardexSheet } from "@/lib/ingestion/kardex";
import { parseBomSheet } from "@/lib/ingestion/bom";
import { parsePedidosSheet } from "@/lib/ingestion/pedidos";
import { parseMallasSheet } from "@/lib/ingestion/mallas";
import { isDatabaseConfigured } from "@/lib/db/queries";
import { replaceIngest } from "@/lib/db/replace-ingest";
import { createClient } from "@/lib/supabase/server";
import type { DbClient } from "@/lib/db/client";
import type { FilaError } from "@/lib/ingestion/types";

export const runtime = "nodejs";

type IngestOutcome = { inserted: number; errores: FilaError[]; aborted?: boolean };

// Solo 5 tipos de reporte vienen realmente de Novasoft (confirmado con el
// usuario, 2026-09-12): productos, kardex, bom, pedidos, mallas. "Stock de
// Seguridad" y "Órdenes en Proceso de Inyección" ya no se ingestan como
// archivo — se derivan cruzando estos datos (ver lib/balance/engine.ts).
//
// Estrategia por tipo (ver docs/schema/0001-modelo-datos-borrador.md,
// "Estrategia de actualización por carga"):
// - productos: acumulativo, upsert por item_code.
// - kardex: "foto del momento", reemplaza toda la tabla en cada carga.
async function ingestProductos(
  db: DbClient,
  buffer: Buffer,
): Promise<{ parseErrores: FilaError[] } & IngestOutcome> {
  const { productos } = await import("@/lib/db/schema");
  const { rows, errores: parseErrores } = await parseProductosSheet(buffer);

  const describeRow = (row: ProductoRow) => `Item ${row.itemCode}`;
  const CHUNK_SIZE = 250;
  let inserted = 0;
  const dbErrores: FilaError[] = [];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    try {
      await db
        .insert(productos)
        .values(chunk)
        .onConflictDoUpdate({
          target: productos.itemCode,
          set: {
            codAlt: sql`excluded.cod_alt`,
            nombre: sql`excluded.nombre`,
            upc: sql`excluded.upc`,
            bodegaBase: sql`excluded.bodega_base`,
            categoria: sql`excluded.categoria`,
            estado: sql`excluded.estado`,
            updatedAt: new Date(),
          },
        });
      inserted += chunk.length;
    } catch {
      for (const row of chunk) {
        try {
          await db
            .insert(productos)
            .values(row)
            .onConflictDoUpdate({
              target: productos.itemCode,
              set: { ...row, updatedAt: new Date() },
            });
          inserted++;
        } catch (err) {
          dbErrores.push({
            fila: 0,
            motivo: `${describeRow(row)}: error al guardar en base de datos (${(err as Error).message}).`,
          });
        }
      }
    }
  }

  return { parseErrores, inserted, errores: dbErrores };
}

async function ingestKardex(
  db: DbClient,
  buffer: Buffer,
): Promise<{ parseErrores: FilaError[] } & IngestOutcome> {
  const { kardexExistencias } = await import("@/lib/db/schema");
  const { rows, errores: parseErrores } = await parseKardexSheet(buffer);

  const { inserted, errores, aborted } = await replaceIngest(
    db,
    kardexExistencias,
    rows,
    (row) => `Item ${row.itemCode} (bodega ${row.codBodega})`,
  );

  return { parseErrores, inserted, errores, aborted };
}

async function ingestBom(
  db: DbClient,
  buffer: Buffer,
): Promise<{ parseErrores: FilaError[] } & IngestOutcome> {
  const { bomItems, productos } = await import("@/lib/db/schema");
  const { rows, errores: parseErrores } = await parseBomSheet(buffer);

  // No existe tabla `fichas` separada: fichaCode y matpriCode referencian
  // productos.item_code (ver comentario en lib/db/schema.ts). "es_tiempo"
  // se deriva de la categoría real del insumo en `productos` (bodega 99),
  // no del código en sí — ver docs/BLUEPRINT.md §6.2.
  const categoriaPorItem = new Map(
    (await db.select({ itemCode: productos.itemCode, categoria: productos.categoria }).from(productos)).map(
      (p) => [p.itemCode, p.categoria],
    ),
  );

  const bomRows = rows.map((row) => ({
    ...row,
    esTiempo: categoriaPorItem.get(row.matpriCode) === "tiempo",
  }));

  const { inserted, errores, aborted } = await replaceIngest(
    db,
    bomItems,
    bomRows,
    (row) => `Ficha ${row.fichaCode} / insumo ${row.matpriCode}`,
  );

  return { parseErrores, inserted, errores, aborted };
}

async function ingestPedidos(
  db: DbClient,
  buffer: Buffer,
): Promise<{ parseErrores: FilaError[] } & IngestOutcome> {
  const { pedidos } = await import("@/lib/db/schema");
  const { rows, errores: parseErrores } = await parsePedidosSheet(buffer);
  const { inserted, errores, aborted } = await replaceIngest(
    db,
    pedidos,
    rows,
    (row) => `Pedido ${row.numeroPedido} / item ${row.itemCode}`,
  );

  // `pedidos` se reemplaza en cada carga (no guarda histórico) — por eso acá
  // se recalcula y persiste el total mensual real (Predicción de Demanda,
  // ver lib/demand/queries.ts) antes de perder los datos de este archivo.
  if (!aborted) {
    const { capturarSnapshotMensual } = await import("@/lib/demand/queries");
    await capturarSnapshotMensual();
  }

  return { parseErrores, inserted, errores, aborted };
}

async function ingestMallas(
  db: DbClient,
  buffer: Buffer,
): Promise<{ parseErrores: FilaError[] } & IngestOutcome> {
  const { mallasClientes } = await import("@/lib/db/schema");
  const { rows, errores: parseErrores } = await parseMallasSheet(buffer);
  const { inserted, errores, aborted } = await replaceIngest(
    db,
    mallasClientes,
    rows,
    (row) => `Cliente NIT ${row.nitCliente}`,
  );
  return { parseErrores, inserted, errores, aborted };
}

const HANDLERS: Record<
  string,
  (
    db: DbClient,
    buffer: Buffer,
  ) => Promise<{ parseErrores: FilaError[] } & IngestOutcome>
> = {
  productos: ingestProductos,
  kardex: ingestKardex,
  bom: ingestBom,
  pedidos: ingestPedidos,
  mallas: ingestMallas,
};

export async function POST(request: Request) {
  // El proxy global (proxy.ts) excluye "/api" a propósito (ver comentario
  // ahí) para no arriesgar corromper el cuerpo multipart de la subida —
  // así que la sesión se verifica aquí, no en el proxy.
  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "No autenticado." }, { status: 401 });
    }
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const tipoReporte = String(formData.get("tipoReporte") ?? "");

  if (!(file instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const handler = HANDLERS[tipoReporte];
  if (!handler) {
    return Response.json(
      { error: `La carga de "${tipoReporte}" todavía no está implementada.` },
      { status: 501 },
    );
  }

  if (!isDatabaseConfigured()) {
    return Response.json(
      {
        error:
          "DATABASE_URL no está configurado todavía. Crea el proyecto en Supabase y completa .env.local (ver .env.example).",
      },
      { status: 503 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { db } = await import("@/lib/db/client");
  const { cargas } = await import("@/lib/db/schema");

  const { parseErrores, inserted, errores: dbErrores, aborted } = await handler(db, buffer);

  if (aborted) {
    return Response.json(
      {
        error:
          "El archivo no produjo ninguna fila válida — no se modificó la información existente. Verifica que sea la hoja correcta.",
        errores: parseErrores,
      },
      { status: 422 },
    );
  }

  const todosLosErrores = [...parseErrores, ...dbErrores];
  const filasTotales = inserted + todosLosErrores.length;
  const estado = todosLosErrores.length === 0 ? "success" : inserted === 0 ? "error" : "warning";

  const [carga] = await db
    .insert(cargas)
    .values({
      tipoReporte: tipoReporte as (typeof cargas.$inferInsert)["tipoReporte"],
      archivoNombre: file.name,
      filasTotales,
      filasExitosas: inserted,
      filasError: todosLosErrores.length,
      estado,
      detalleErrores: todosLosErrores,
    })
    .returning();

  return Response.json({
    carga,
    filasExitosas: inserted,
    filasError: todosLosErrores.length,
    errores: todosLosErrores,
  });
}
