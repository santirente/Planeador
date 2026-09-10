export type FilaError = { fila: number; motivo: string };

export type ParseResult<TRow> = {
  rows: TRow[];
  errores: FilaError[];
};
