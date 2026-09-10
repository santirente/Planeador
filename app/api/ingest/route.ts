import { parseProductosSheet } from "@/lib/ingestion/productos";
import { isDatabaseConfigured } from "@/lib/db/queries";

export const runtime = "nodejs";

// Tipos de reporte soportados hoy. El resto (bom, kardex, pedidos,
// stock_seguridad, en_proceso_inyeccion, mallas) se suma en el roadmap
// paso 2+ (ver docs/BLUEPRINT.md) — cada uno es un parser independiente en
// /lib/ingestion siguiendo el mismo patrón que productos.ts.
const IMPLEMENTED = new Set(["productos"]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const tipoReporte = String(formData.get("tipoReporte") ?? "");

  if (!(file instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  if (!IMPLEMENTED.has(tipoReporte)) {
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
  const { rows, errores } = await parseProductosSheet(buffer);

  const { db } = await import("@/lib/db/client");
  const { productos, cargas } = await import("@/lib/db/schema");

  const dbErrores = [...errores];
  let insertados = 0;

  for (const row of rows) {
    try {
      await db
        .insert(productos)
        .values(row)
        .onConflictDoUpdate({
          target: productos.itemCode,
          set: {
            codAlt: row.codAlt,
            nombre: row.nombre,
            upc: row.upc,
            bodegaBase: row.bodegaBase,
            categoria: row.categoria,
            estado: row.estado,
            updatedAt: new Date(),
          },
        });
      insertados++;
    } catch (err) {
      dbErrores.push({
        fila: 0,
        motivo: `Item ${row.itemCode}: error al guardar en base de datos (${(err as Error).message}).`,
      });
    }
  }

  const filasTotales = insertados + dbErrores.length;
  const estado = dbErrores.length === 0 ? "success" : insertados === 0 ? "error" : "warning";

  const [carga] = await db
    .insert(cargas)
    .values({
      tipoReporte: "productos",
      archivoNombre: file.name,
      filasTotales,
      filasExitosas: insertados,
      filasError: dbErrores.length,
      estado,
      detalleErrores: dbErrores,
    })
    .returning();

  return Response.json({ carga, filasExitosas: insertados, filasError: dbErrores.length, errores: dbErrores });
}
