/**
 * Helpers para leer los archivos "planos" que exporta Novasoft directamente
 * (sin la tabla dinámica consolidada que se usó al inicio del proyecto).
 * Vienen en formato BIFF (.xls binario clásico, sin importar la extensión
 * declarada) y sin fila de encabezados reales — por eso se leen con `xlsx`
 * (soporta BIFF y OOXML) en modo `header: 1` (arreglo de arreglos por fila).
 */
import * as XLSX from "xlsx";

export function loadFirstSheetRows(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
}

export function findSheetByName(
  buffer: Buffer,
  name: string,
): unknown[][] | null {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const match = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (!match) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[match], {
    header: 1,
    defval: null,
    raw: true,
  });
}

export function rawText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function rawNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = rawText(value);
  if (text === null) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Fecha "dd/mm/yyyy" (formato de los reportes planos de Novasoft) -> "yyyy-mm-dd". */
export function rawFechaISOFromDDMMYYYY(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = rawText(value);
  if (!text) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Fecha "dd/mm/yyyy" (formato de los reportes planos de Novasoft) -> año. */
export function rawAnioFromFechaDDMMYYYY(value: unknown): number | null {
  if (value instanceof Date) return value.getFullYear();
  const text = rawText(value);
  if (!text) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  return m ? Number(m[3]) : null;
}
