import ExcelJS from "exceljs";
import type { categoriaProductoEnum } from "@/lib/db/schema";
import { cellText, cellNumber } from "./cell-utils";
import type { ParseResult } from "./types";

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
// Columnas confirmadas en docs/schema/0001-modelo-datos-borrador.md:
// A=bod, B=item, C=cod_alt, D=nombre, E=upc, F=estado
const COL = { bod: 1, item: 2, codAlt: 3, nombre: 4, upc: 5, estado: 6 };

export async function parseProductosSheet(
  buffer: Buffer,
): Promise<ParseResult<ProductoRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) {
    return {
      rows: [],
      errores: [{ fila: 0, motivo: `No se encontró la hoja "${SHEET_NAME}" en el archivo.` }],
    };
  }

  const rows: ProductoRow[] = [];
  const errores: { fila: number; motivo: string }[] = [];
  const seen = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado

    const itemCode = cellText(row.getCell(COL.item));
    const nombre = cellText(row.getCell(COL.nombre));
    const bod = cellText(row.getCell(COL.bod));

    if (!itemCode) {
      errores.push({ fila: rowNumber, motivo: "Falta el código de item (columna 'item')." });
      return;
    }
    if (!nombre) {
      errores.push({ fila: rowNumber, motivo: `Item ${itemCode}: falta el nombre.` });
      return;
    }
    if (bod && BODEGAS_EXCLUIDAS.has(bod)) {
      return; // servicio/gasto o documento anulado: se omite intencionalmente, no es un error
    }
    if (!bod || !CATEGORIA_POR_BODEGA[bod]) {
      errores.push({
        fila: rowNumber,
        motivo: `Item ${itemCode}: código de bodega "${bod ?? ""}" no reconocido (se esperaba 10, 20, 30, 15 o 99).`,
      });
      return;
    }
    if (seen.has(itemCode)) {
      errores.push({ fila: rowNumber, motivo: `Item ${itemCode}: código duplicado en el archivo, se conserva la primera aparición.` });
      return;
    }
    seen.add(itemCode);

    rows.push({
      itemCode,
      codAlt: cellText(row.getCell(COL.codAlt)),
      nombre,
      upc: cellText(row.getCell(COL.upc)),
      bodegaBase: bod,
      categoria: CATEGORIA_POR_BODEGA[bod],
      estado: cellNumber(row.getCell(COL.estado)),
    });
  });

  return { rows, errores };
}
