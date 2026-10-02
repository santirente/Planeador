"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoDemanda } from "@/lib/demand/queries";

function formatMes(anioMes: string) {
  const [anio, mes] = anioMes.split("-").map(Number);
  const nombre = new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString("es-CO", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  return nombre.replace(".", "");
}

export function DemandChart({ puntos }: { puntos: PuntoDemanda[] }) {
  const data = puntos.map((p) => ({ ...p, label: formatMes(p.anioMes) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => (typeof value === "number" ? value.toLocaleString("es-CO") : value)} />
        <Legend />
        <Line
          type="monotone"
          dataKey="real"
          name="Demanda Real (Histórico)"
          stroke="#1e293b"
          strokeWidth={3}
          connectNulls={false}
          dot
        />
        <Line
          type="monotone"
          dataKey="proyectado"
          name="Proyección (tendencia lineal)"
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="5 5"
          connectNulls
          dot
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
