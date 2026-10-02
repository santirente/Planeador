"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { ThTooltip } from "@/components/shared/th-tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NecesidadRow } from "@/lib/balance/queries";

function fmt(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

export function NecesidadTable({
  rows,
  necesidadLabel,
  umbralPct,
}: {
  rows: NecesidadRow[];
  necesidadLabel: string;
  umbralPct: number;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NecesidadRow | null>(null);

  const filtered = rows.filter(
    (r) =>
      r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.itemCode.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-start justify-between space-y-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{necesidadLabel}</h2>
          <p className="text-xs text-slate-500">Haz clic en cualquier fila para ver el detalle</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2 text-slate-400" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código o nombre..."
            className="w-64 pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Descripción</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                <ThTooltip label="Stock (Kardex)" align="end">
                  Existencias actuales de este ítem en Kardex, sumando todas las bodegas donde aparece.
                </ThTooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                <ThTooltip label="Necesidad" align="end">
                  Demanda bruta calculada por el motor de balance: explota pedidos + stock de seguridad (derivado del
                  promedio semanal de pedidos, ver Administración) a través de la receta (BOM) de cada producto,
                  multinivel, descontando lo que ya hay en Kardex en cada nivel.
                </ThTooltip>
              </th>
              <th className="bg-slate-100 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                <ThTooltip label="Balance" align="end">
                  Stock menos Necesidad. Negativo (en rojo) significa déficit real — falta comprar o producir esa
                  cantidad.
                </ThTooltip>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                <ThTooltip label="Estado">
                  Balance negativo = Crítico. Balance positivo pero con menos de {umbralPct}% de colchón sobre la
                  necesidad = Advertencia (umbral configurable en Administración). Si no, Cubierto.
                </ThTooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((row) => (
              <tr
                key={row.itemCode}
                onClick={() => setSelected(row)}
                className="cursor-pointer transition-colors hover:bg-indigo-50/50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-indigo-600">{row.itemCode}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{row.nombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">{fmt(row.stock)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">{fmt(row.necesidad)}</td>
                <td
                  className={`whitespace-nowrap bg-slate-50 px-4 py-3 text-right text-sm font-bold ${
                    row.balance < 0 ? "text-red-600" : "text-slate-800"
                  }`}
                >
                  {fmt(row.balance)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <StatusBadge status={row.estado} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">{selected.itemCode}</span>
                <SheetTitle>{selected.nombre}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4 text-sm">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <span className="text-xs font-semibold uppercase text-slate-500">Estado actual</span>
                  <div className="mt-1">
                    <StatusBadge status={selected.estado} />
                  </div>
                </div>
                <div
                  className={`rounded-lg border p-4 ${
                    selected.balance < 0 ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold uppercase ${
                      selected.balance < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    Balance calculado
                  </span>
                  <div
                    className={`mt-1 text-xl font-bold ${
                      selected.balance < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {fmt(selected.balance)} unidades
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500">Stock (Kardex)</span>
                    <p className="font-medium text-slate-800">{fmt(selected.stock)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500">Necesidad total</span>
                    <p className="font-medium text-slate-800">{fmt(selected.necesidad)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Necesidad calculada explotando pedidos + stock de seguridad derivado a través de la receta (BOM),
                  con descuento de existencias de Kardex en cada nivel.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
