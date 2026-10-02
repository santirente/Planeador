import type { categoriaProductoEnum } from "@/lib/db/schema";
import {
  findSheetByName,
  loadFirstSheetRows,
  rawNumber,
  rawText,
} from "./raw-cell-utils";
import type { FilaError, ParseResult } from "./types";

type CategoriaProducto = (typeof categoriaProductoEnum.enumValues)[number];

// Confirmado con el usuario contra los códigos reales del Excel (2026-09-09,
// ver docs/schema/0001-modelo-datos-borrador.md): la columna `bod` de
// "Listado de productos" usa 10/20/30/15/99, no 10/20/30/50/90. Se dejan
// también 50 y 90 por si algún archivo futuro los trae así.
const CATEGORIA_POR_BODEGA: Record<string, CategoriaProducto> = {
  "10": "materia_prima",
  "20": "en_proceso",
  "30": "producto_terminado",
  "15": "empaque_complementario",
  "50": "empaque_complementario",
  "B0": "empaque_complementario",
  "99": "tiempo",
  "90": "tiempo",
};

// Códigos que existen en el Excel pero no son inventario (servicios,
// documentos anulados, etc.) — se omiten sin reportarlos como error de carga.
const BODEGAS_EXCLUIDAS = new Set(["A0", "Z"]);

export type ProductoRow = {
  itemCode: string;
  codAlt: string | null;
  nombre: string;
  upc: string | null;
  bodegaBase: string;
  categoria: CategoriaProducto;
  estado: number | null;
};

const SHEET_NAME = "1. Listado de productos";

function buildRow(
  fila: number,
  bod: string | null,
  itemCode: string | null,
  nombre: string | null,
  codAlt: string | null,
  upc: string | null,
  estado: number | null,
  seen: Set<string>,
  errores: FilaError[],
): ProductoRow | null {
  if (!itemCode) {
    errores.push({ fila, motivo: "Falta el código de item (columna 'item')." });
    return null;
  }
  if (!nombre) {
    errores.push({ fila, motivo: `Item ${itemCode}: falta el nombre.` });
    return null;
  }
  if (bod && BODEGAS_EXCLUIDAS.has(bod)) {
    return null; // servicio/gasto o documento anulado: se omite intencionalmente, no es un error
  }
  if (!bod || !CATEGORIA_POR_BODEGA[bod]) {
    errores.push({
      fila,
      motivo: `Item ${itemCode}: código de bodega "${bod ?? ""}" no reconocido (se esperaba 10, 20, 30, 15 o 99).`,
    });
    return null;
  }
  if (seen.has(itemCode)) {
    errores.push({
      fila,
      motivo: `Item ${itemCode}: código duplicado en el archivo, se conserva la primera aparición.`,
    });
    return null;
  }
  seen.add(itemCode);

  return {
    itemCode,
    codAlt,
    nombre,
    upc,
    bodegaBase: bod,
    categoria: CATEGORIA_POR_BODEGA[bod],
    estado,
  };
}

// Formato "pivot" (tabla ya consolidada con encabezados reales): usado en el
// archivo de referencia inicial del proyecto. Columnas confirmadas en
// docs/schema/0001-modelo-datos-borrador.md: A=bod, B=item, C=cod_alt,
// D=nombre, E=upc, F=estado.
function parsePivot(data: unknown[][]): ParseResult<ProductoRow> {
  const rows: ProductoRow[] = [];
  const errores: FilaError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const bod = rawText(r[0]);
    const itemCode = rawText(r[1]);
    const nombre = rawText(r[3]);
    if (!itemCode && !nombre) continue; // fila en blanco

    const row = buildRow(
      i + 1,
      bod,
      itemCode,
      nombre,
      rawText(r[2]),
      rawText(r[4]),
      rawNumber(r[5]),
      seen,
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

// Formato "plano" (exportado directo de Novasoft, sin procesar): una sola
// hoja sin encabezados, con la jerarquía de categoría repetida por fila.
// Layout confirmado contra EXC0015_JOSE.XLS (2026-09-11): col0=bod,
// col15=estado, col17=item, col19=cod_alt, col21=nombre. No trae UPC.
function parseRaw(data: unknown[][]): ParseResult<ProductoRow> {
  const rows: ProductoRow[] = [];
  const errores: FilaError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const bod = rawText(r[0]);
    const itemCode = rawText(r[17]);
    const nombre = rawText(r[21]);
    if (!itemCode && !nombre) continue; // fila marcadora o en blanco

    const row = buildRow(
      i + 1,
      bod,
      itemCode,
      nombre,
      rawText(r[19]),
      null,
      rawNumber(r[15]),
      seen,
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

export async function parseProductosSheet(
  buffer: Buffer,
): Promise<ParseResult<ProductoRow>> {
  const pivot = findSheetByName(buffer, SHEET_NAME);
  if (pivot) return parsePivot(pivot);

  const data = loadFirstSheetRows(buffer);
  if (data.length === 0) {
    return {
      rows: [],
      errores: [{ fila: 0, motivo: "El archivo está vacío o no se pudo leer." }],
    };
  }
  return parseRaw(data);
}
