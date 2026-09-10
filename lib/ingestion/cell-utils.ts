import type { Cell } from "exceljs";

/** Extrae un valor de celda "plano", incluso si viene como fórmula o rich text. */
export function cellText(cell: Cell | undefined): string | null {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("result" in v) return v.result != null ? String(v.result).trim() : null; // fórmula
    if ("richText" in v)
      return (v.richText as { text: string }[]).map((r) => r.text).join("").trim();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function cellNumber(cell: Cell | undefined): number | null {
  const text = cellText(cell);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
