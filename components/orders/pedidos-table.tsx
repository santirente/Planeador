"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge, type EstadoBalance } from "@/components/shared/status-badge";
import { ThTooltip } from "@/components/shared/th-tooltip";
import type { PedidoResumen, EstadoPedido } from "@/lib/orders/queries";

const ESTADO_MAP: Record<EstadoPedido, EstadoBalance> = {
  Crítico: "critical",
  "En Riesgo": "warning",
  "A Tiempo": "ok",
};

export function PedidosTable({ rows }: { rows: PedidoResumen[] }) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter(
    (r) =>
      r.numeroPedido.toLowerCase().includes(search.toLowerCase()) ||
      r.clienteNombre.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-start justify-between space-y-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:space-y-0">
        <h2 className="text-lg font-bold text-slate-800">Pedidos y Clientes Pendientes</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2 text-slate-400" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pedido o cliente..."
            className="w-64 pl-9"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">Pedido</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">Entrega</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-600">
                <ThTooltip label="Cantidad" align="end">
                  Suma de las cantidades de todas las líneas (ítems) de este número de pedido.
                </ThTooltip>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">Zona / Malla</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-600">
                <ThTooltip label="Estado">
                  Novasoft no trae este dato (llega vacío) — se calcula acá según la fecha de entrega comprometida:
                  vencida = Crítico, 7 días o menos = En Riesgo, si no = A Tiempo.
                </ThTooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((p) => (
              <tr key={p.numeroPedido} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-bold text-indigo-600">{p.numeroPedido}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-900">{p.clienteNombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {p.fechaEntrega ? new Date(p.fechaEntrega).toLocaleDateString("es-CO") : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                  {p.cantidadTotal.toLocaleString("es-CO")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {p.zona ?? "—"} {p.diaMalla && `(Malla: ${p.diaMalla})`}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <StatusBadge status={ESTADO_MAP[p.estado]} text={p.estado} />
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
    </div>
  );
}
