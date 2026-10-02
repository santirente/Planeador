import ExcelJS from "exceljs";
import { cellText, cellNumber } from "./cell-utils";
import type { ParseResult } from "./types";

export type PedidoRow = {
  numeroPedido: string;
  fecha: string | null;
  fechaEntrega: string | null;
  clienteNit: string | null;
  clienteNombre: string | null;
  itemCode: string;
  bodega: string | null;
  cantidad: string | null;
  sem1: string | null;
  sem2: string | null;
  sem3: string | null;
  sem4: string | null;
  fechaCorte: string | null;
  diaMalla: string | null;
  estadoPedido: string | null;
};

const SHEET_NAME = "5. Pedidos_Novasoft";
// Columnas confirmadas en docs/schema/0001-modelo-datos-borrador.md
const COL = {
  numero: 4,
  fecha: 5,
  fechaEnt: 6,
  item: 8,
  bodega: 10,
  cantidad: 15,
  nitClie: 18,
  nombreCliente: 20,
  sem1: 23,
  sem2: 24,
  sem3: 25,
  sem4: 26,
  fecCorte: 27,
  diaMalla: 28,
  estadoPedido: 32,
};

function numOrNull(cell: ReturnType<ExcelJS.Row["getCell"]>) {
  const n = cellNumber(cell);
  return n !== null ? String(n) : null;
}

export async function parsePedidosSheet(buffer: Buffer): Promise<ParseResult<PedidoRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    return {
      rows: [],
      errores: [{ fila: 0, motivo: `No se encontró la hoja "${SHEET_NAME}" en el archivo.` }],
    };
  }

  const rows: PedidoRow[] = [];
  const errores: { fila: number; motivo: string }[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado

    const numeroPedido = cellText(row.getCell(COL.numero));
    const itemCode = cellText(row.getCell(COL.item));

    if (!numeroPedido && !itemCode) return; // fila vacía de relleno

    if (!numeroPedido) {
      errores.push({ fila: rowNumber, motivo: `Falta el número de pedido (item ${itemCode ?? ""}).` });
      return;
    }
    if (!itemCode) {
      errores.push({ fila: rowNumber, motivo: `Pedido ${numeroPedido}: falta el código de item.` });
      return;
    }

    rows.push({
      numeroPedido,
      fecha: cellText(row.getCell(COL.fecha)),
      fechaEntrega: cellText(row.getCell(COL.fechaEnt)),
      clienteNit: cellText(row.getCell(COL.nitClie)),
      clienteNombre: cellText(row.getCell(COL.nombreCliente)),
      itemCode,
      bodega: cellText(row.getCell(COL.bodega)),
      cantidad: numOrNull(row.getCell(COL.cantidad)),
      sem1: numOrNull(row.getCell(COL.sem1)),
      sem2: numOrNull(row.getCell(COL.sem2)),
      sem3: numOrNull(row.getCell(COL.sem3)),
      sem4: numOrNull(row.getCell(COL.sem4)),
      fechaCorte: cellText(row.getCell(COL.fecCorte)),
      diaMalla: cellText(row.getCell(COL.diaMalla)),
      estadoPedido: cellText(row.getCell(COL.estadoPedido)),
    });
  });

  return { rows, errores };
}
