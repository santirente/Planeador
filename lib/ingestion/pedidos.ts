import ExcelJS from "exceljs";
import { cellText, cellNumber } from "./cell-utils";
import {
  findSheetByName,
  loadFirstSheetRows,
  rawFechaISOFromDDMMYYYY,
  rawNumber,
  rawText,
} from "./raw-cell-utils";
import type { FilaError, ParseResult } from "./types";

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

// Formato "plano" (exportado directo de Novasoft, reporte FAC0015 "PED PEND X
// SEMANAS DETALLE", confirmado contra FAC0015_JOSE.XLS el 2026-10-02): una
// sola hoja agrupada por producto —
//   fila de producto: solo col1 = "CODIGO-NOMBRE" (ej. "3001-003-01-ORGANIZADOR")
//   fila de línea:    col1=fecha entrega, col4=pedido, col7=cliente,
//                     col13=vencido (antes de la 1ª semana), col19/22/25/30=
//                     semanas 1-4, col32=fecha entrega (repetida)
//   fila de subtotal: sin col1/col4, solo las columnas de cantidades (se ignora)
// No trae fecha del pedido, NIT del cliente ni bodega — quedan null.
const RAW_COL = { fechaEntrega: 1, pedido: 4, cliente: 7, vencido: 13, sem: [19, 22, 25, 30] };
const RAW_PRODUCTO = /^(\S+?-\d+(?:-\d+)?)-(.+)$/;

function parseRaw(data: unknown[][]): ParseResult<PedidoRow> {
  const rows: PedidoRow[] = [];
  const errores: FilaError[] = [];
  let itemActual: string | null = null;

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const ocupadas = r.reduce<number[]>((acc, v, j) => (rawText(v) !== null ? [...acc, j] : acc), []);
    if (ocupadas.length === 0) continue;

    const pedido = rawText(r[RAW_COL.pedido]);

    // Fila de producto: solo col1, y no es una fecha.
    if (ocupadas.length === 1 && ocupadas[0] === RAW_COL.fechaEntrega && !pedido) {
      const texto = rawText(r[RAW_COL.fechaEntrega]);
      const m = texto ? RAW_PRODUCTO.exec(texto) : null;
      if (m) itemActual = m[1];
      else if (texto && rawFechaISOFromDDMMYYYY(texto) === null && /[A-Za-z]/.test(texto) && itemActual !== null) {
        errores.push({ fila: i + 1, motivo: `No se pudo leer el código de producto de "${texto}".` });
        itemActual = null;
      }
      continue;
    }

    if (!pedido) continue; // subtotal por producto, encabezados o relleno

    if (!itemActual) {
      errores.push({ fila: i + 1, motivo: `Pedido ${pedido}: no se encontró el producto al que pertenece.` });
      continue;
    }

    const vencido = rawNumber(r[RAW_COL.vencido]);
    const semanas = RAW_COL.sem.map((c) => rawNumber(r[c]));
    const cantidad = (vencido ?? 0) + semanas.reduce<number>((s, v) => s + (v ?? 0), 0);
    if (vencido === null && semanas.every((v) => v === null)) {
      errores.push({ fila: i + 1, motivo: `Pedido ${pedido} / item ${itemActual}: no trae cantidad.` });
      continue;
    }

    const entrega = rawFechaISOFromDDMMYYYY(r[RAW_COL.fechaEntrega]) ?? rawFechaISOFromDDMMYYYY(r[32]);
    const sem = semanas.map((v) => (v !== null ? String(v) : null));

    rows.push({
      numeroPedido: pedido,
      fecha: null,
      fechaEntrega: entrega,
      clienteNit: null,
      clienteNombre: rawText(r[RAW_COL.cliente]),
      itemCode: itemActual,
      bodega: null,
      cantidad: String(cantidad),
      sem1: sem[0],
      sem2: sem[1],
      sem3: sem[2],
      sem4: sem[3],
      fechaCorte: null,
      diaMalla: null,
      estadoPedido: null,
    });
  }

  return { rows, errores };
}

export async function parsePedidosSheet(buffer: Buffer): Promise<ParseResult<PedidoRow>> {
  if (!findSheetByName(buffer, SHEET_NAME)) {
    const data = loadFirstSheetRows(buffer);
    if (data.length === 0) {
      return { rows: [], errores: [{ fila: 0, motivo: "El archivo está vacío o no se pudo leer." }] };
    }
    return parseRaw(data);
  }
  return parsePivot(buffer);
}

async function parsePivot(buffer: Buffer): Promise<ParseResult<PedidoRow>> {
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
