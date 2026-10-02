import {
  findSheetByName,
  loadFirstSheetRows,
  rawAnioFromFechaDDMMYYYY,
  rawNumber,
  rawText,
} from "./raw-cell-utils";
import type { FilaError, ParseResult } from "./types";

export type KardexRow = {
  itemCode: string;
  codBodega: string;
  anio: number | null;
  existencia: string; // numeric como string para el driver de Postgres
  valorTotal: string | null;
};

const SHEET_NAME = "4. Kardex NS diario";

function buildRow(
  fila: number,
  itemCode: string | null,
  codBodega: string | null,
  existenciaRaw: unknown,
  anio: number | null,
  valorTotalRaw: unknown,
  seen: Set<string>,
  errores: FilaError[],
): KardexRow | null {
  if (!itemCode) {
    errores.push({ fila, motivo: "Falta el código de item." });
    return null;
  }
  if (!codBodega) {
    errores.push({ fila, motivo: `Item ${itemCode}: falta el código de bodega.` });
    return null;
  }
  const existencia = rawNumber(existenciaRaw);
  if (existencia === null) {
    errores.push({ fila, motivo: `Item ${itemCode}: existencia (t_exis) no es un número válido.` });
    return null;
  }

  const key = `${itemCode}|${codBodega}`;
  if (seen.has(key)) {
    errores.push({
      fila,
      motivo: `Item ${itemCode} en bodega ${codBodega}: código duplicado en el archivo, se conserva la primera aparición.`,
    });
    return null;
  }
  seen.add(key);

  const valorTotal = rawNumber(valorTotalRaw);

  return {
    itemCode,
    codBodega,
    anio,
    existencia: String(existencia),
    valorTotal: valorTotal !== null ? String(valorTotal) : null,
  };
}

// Formato "pivot" (tabla ya consolidada con encabezados reales). Columnas
// confirmadas en docs/schema/0001-modelo-datos-borrador.md: A=item (pese al
// header "acum"), B=cod_suc, C=cod_bod, D=ano_acu, E=t_exis, F=vr_tot.
function parsePivot(data: unknown[][]): ParseResult<KardexRow> {
  const rows: KardexRow[] = [];
  const errores: FilaError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const itemCode = rawText(r[0]);
    const codBodega = rawText(r[2]);
    if (!itemCode && !codBodega) continue;

    const row = buildRow(
      i + 1,
      itemCode,
      codBodega,
      r[4],
      rawNumber(r[3]),
      r[5],
      seen,
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

// Formato "plano" (exportado directo de Novasoft, sin procesar): una sola
// hoja sin encabezados. Layout confirmado contra EXC0008_JOSE.XLS
// (2026-09-11): col0=fecha (dd/mm/yyyy), col3=cod_bod, col5=item,
// col9=t_exis. No trae vr_tot — queda null; el año se deriva de la fecha.
function parseRaw(data: unknown[][]): ParseResult<KardexRow> {
  const rows: KardexRow[] = [];
  const errores: FilaError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const itemCode = rawText(r[5]);
    const codBodega = rawText(r[3]);
    if (!itemCode && !codBodega) continue; // fila marcadora o en blanco

    const row = buildRow(
      i + 1,
      itemCode,
      codBodega,
      r[9],
      rawAnioFromFechaDDMMYYYY(r[0]),
      null,
      seen,
      errores,
    );
    if (row) rows.push(row);
  }

  return { rows, errores };
}

export async function parseKardexSheet(buffer: Buffer): Promise<ParseResult<KardexRow>> {
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
