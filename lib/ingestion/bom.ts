import {
  findSheetByName,
  loadFirstSheetRows,
  rawNumber,
  rawText,
} from "./raw-cell-utils";
import type { FilaError, ParseResult } from "./types";

export type BomRow = {
  fichaCode: string; // producto resultante — referencia productos.item_code
  matpriCode: string; // producto consumido (material o tiempo) — referencia productos.item_code
  cantidad: string; // numeric como string para el driver de Postgres
  etapa: string | null;
  unidadMedida: string | null;
  estado: number | null;
  fechaActualizacion: string | null; // YYYY-MM-DD
};

const SHEET_NAME = "3.Boom_Materiales";

function buildRow(
  fila: number,
  fichaCode: string | null,
  matpriCode: string | null,
  cantidadRaw: unknown,
  etapa: string | null,
  unidadMedida: string | null,
  estado: number | null,
  fechaActualizacion: string | null,
  errores: FilaError[],
): BomRow | null {
  if (!fichaCode) {
    errores.push({ fila, motivo: `Falta el código de producto resultante (insumo ${matpriCode ?? ""}).` });
    return null;
  }
  if (!matpriCode) {
    errores.push({ fila, motivo: `Producto ${fichaCode}: falta el código de insumo (matpri).` });
    return null;
  }
  const cantidad = rawNumber(cantidadRaw);
  if (cantidad === null) {
    errores.push({ fila, motivo: `Producto ${fichaCode} / insumo ${matpriCode}: cantidad no es un número válido.` });
    return null;
  }

  return {
    fichaCode,
    matpriCode,
    cantidad: String(cantidad),
    etapa,
    unidadMedida,
    estado,
    fechaActualizacion,
  };
}

// Formato "pivot" (tabla ya consolidada con encabezados reales): solo
// columnas A:L son datos crudos del BOM — el resto de la hoja (N en
// adelante) es un bloque de tabla dinámica pegado al lado, se ignora.
// Columnas confirmadas en docs/schema/0001-modelo-datos-borrador.md.
function parsePivot(data: unknown[][]): ParseResult<BomRow> {
  const rows: BomRow[] = [];
  const errores: FilaError[] = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const fichaCode = rawText(r[0]);
    const matpriCode = rawText(r[1]);
    // Filas del bloque de tabla dinámica a la derecha no traen A/B — se
    // ignoran silenciosamente, no son datos de BOM.
    if (!fichaCode && !matpriCode) continue;

    const row = buildRow(
      i + 1,
      fichaCode,
      matpriCode,
      r[2],
      rawText(r[5]),
      rawText(r[9]),
      rawNumber(r[8]),
      rawText(r[6]),
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

// Formato "plano" (exportado directo de Novasoft, sin procesar): una sola
// hoja sin encabezados. Layout confirmado contra EXC0001_JOSE.xlsx
// (2026-09-11): col5=ficha (item), col11=matpri (item), col13=cantidad,
// col15=unidad. No trae etapa/estado/fecha_actualizacion — quedan null.
function parseRaw(data: unknown[][]): ParseResult<BomRow> {
  const rows: BomRow[] = [];
  const errores: FilaError[] = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const fichaCode = rawText(r[5]);
    const matpriCode = rawText(r[11]);
    if (!fichaCode && !matpriCode) continue; // fila marcadora o en blanco

    const row = buildRow(
      i + 1,
      fichaCode,
      matpriCode,
      r[13],
      null,
      rawText(r[15]),
      null,
      null,
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

export async function parseBomSheet(buffer: Buffer): Promise<ParseResult<BomRow>> {
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
