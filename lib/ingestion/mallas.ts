import ExcelJS from "exceljs";
import { cellText } from "./cell-utils";
import type { ParseResult } from "./types";

export type MallaRow = {
  nitCliente: string;
  nombreClientePrincipal: string | null;
  nombrePunto: string | null;
  zona: string | null;
  nombreZona: string | null;
  ciudad: string | null;
  diaDespacho: string | null;
  diaMalla: string | null;
};

const SHEET_NAME = "2. Listado de mallas";
// Columnas confirmadas en docs/schema/0001-modelo-datos-borrador.md
const COL = {
  nit: 1,
  nombreClientePrincipal: 3,
  nombrePunto: 4,
  zona: 5,
  nombreZona: 6,
  ciudad: 8,
  diaDespacho: 9,
  diaMalla: 10,
};

export async function parseMallasSheet(buffer: Buffer): Promise<ParseResult<MallaRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    return {
      rows: [],
      errores: [{ fila: 0, motivo: `No se encontró la hoja "${SHEET_NAME}" en el archivo.` }],
    };
  }

  const rows: MallaRow[] = [];
  const errores: { fila: number; motivo: string }[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado

    const nitCliente = cellText(row.getCell(COL.nit));
    if (!nitCliente) {
      errores.push({ fila: rowNumber, motivo: "Falta el NIT del cliente." });
      return;
    }

    rows.push({
      nitCliente,
      nombreClientePrincipal: cellText(row.getCell(COL.nombreClientePrincipal)),
      nombrePunto: cellText(row.getCell(COL.nombrePunto)),
      zona: cellText(row.getCell(COL.zona)),
      nombreZona: cellText(row.getCell(COL.nombreZona)),
      ciudad: cellText(row.getCell(COL.ciudad)),
      diaDespacho: cellText(row.getCell(COL.diaDespacho)),
      diaMalla: cellText(row.getCell(COL.diaMalla)),
    });
  });

  return { rows, errores };
}
