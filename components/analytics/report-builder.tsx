"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart2, Database, Save, Search, Table2, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ejecutarReporteAction,
  eliminarReporteAction,
  guardarReporteAction,
} from "@/lib/analytics/actions";
import type { FuenteId } from "@/lib/analytics/sources";

type CampoOpcion = { id: string; label: string };
type FuenteOpcion = { id: FuenteId; label: string; dimensiones: CampoOpcion[]; medidas: CampoOpcion[] };
type ReporteGuardado = {
  id: string;
  nombre: string;
  fuente: FuenteId;
  dimensiones: string[];
  medida: string;
  tipoGrafico: "bar" | "line";
  updatedAt: string | Date;
};
type FilaResultado = Record<string, unknown> & { valor: number };

function truncar(texto: string, max = 26) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Deben coincidir con LIMITE_DEFECTO / LIMITE_MAXIMO en lib/analytics/queries.ts
// (ese módulo es "server-only" y no se puede importar desde un Client Component).
const OPCIONES_LIMITE = [
  { value: "15", label: "Top 15" },
  { value: "30", label: "Top 30" },
  { value: "50", label: "Top 50" },
  { value: "500", label: "Todos" },
] as const;
const LIMITE_DEFECTO = 15;
const ALTO_POR_FILA_BARRA = 26;

// Qué archivo subido en Carga de Datos alimenta cada fuente del constructor.
const ARCHIVO_ORIGEN: Record<FuenteId, string> = {
  kardex: "Kardex de Inventario",
  bom: "BOM / Lista de Materiales",
  pedidos: "Listado de Pedidos",
};

export function ReportBuilder({
  fuentes,
  reportesIniciales,
}: {
  fuentes: FuenteOpcion[];
  reportesIniciales: ReporteGuardado[];
}) {
  const [tab, setTab] = useState<"builder" | "saved">("builder");
  const [fuenteId, setFuenteId] = useState<FuenteId>(fuentes[0].id);
  const [dimensiones, setDimensiones] = useState<string[]>(fuentes[0].dimensiones.slice(0, 1).map((d) => d.id));
  const [medida, setMedida] = useState<string>(fuentes[0].medidas[0]?.id ?? "");
  const [limite, setLimite] = useState<number>(LIMITE_DEFECTO);
  const [tipoGrafico, setTipoGrafico] = useState<"bar" | "line">("bar");
  const [vista, setVista] = useState<"chart" | "table">("chart");
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState<FilaResultado[]>([]);
  const [dimensionesUsadas, setDimensionesUsadas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nombreReporte, setNombreReporte] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [reportes, setReportes] = useState(reportesIniciales);
  const [pending, startTransition] = useTransition();

  const fuente = fuentes.find((f) => f.id === fuenteId)!;

  function toggleDimension(id: string) {
    setDimensiones((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  function cambiarFuente(id: FuenteId) {
    const nueva = fuentes.find((f) => f.id === id)!;
    setFuenteId(id);
    setDimensiones(nueva.dimensiones.slice(0, 1).map((d) => d.id));
    setMedida(nueva.medidas[0]?.id ?? "");
    setFilas([]);
    setError(null);
  }

  function ejecutar(overrides?: { fuente?: FuenteId; dimensiones?: string[]; medida?: string; limite?: number }) {
    const config = {
      fuente: overrides?.fuente ?? fuenteId,
      dimensiones: overrides?.dimensiones ?? dimensiones,
      medida: overrides?.medida ?? medida,
      limite: overrides?.limite ?? limite,
    };
    setError(null);
    startTransition(async () => {
      const resultado = await ejecutarReporteAction(config);
      if ("error" in resultado) {
        setError(resultado.error);
        setFilas([]);
        return;
      }
      setFilas(resultado.filas as FilaResultado[]);
      setDimensionesUsadas(resultado.dimensionesUsadas);
    });
  }

  function cambiarLimite(valor: string) {
    const n = Number(valor);
    setLimite(n);
    if (filas.length > 0) ejecutar({ limite: n });
  }

  async function guardar() {
    if (!nombreReporte.trim()) return;
    setGuardando(true);
    const resultado = await guardarReporteAction({
      nombre: nombreReporte.trim(),
      fuente: fuenteId,
      dimensiones,
      medida,
      tipoGrafico,
    });
    setGuardando(false);
    if ("error" in resultado) {
      setError(resultado.error);
      return;
    }
    setReportes((prev) => [resultado.reporte, ...prev]);
    setNombreReporte("");
  }

  async function eliminar(id: string) {
    setReportes((prev) => prev.filter((r) => r.id !== id));
    await eliminarReporteAction(id);
  }

  function cargarReporte(r: ReporteGuardado) {
    setFuenteId(r.fuente);
    setDimensiones(r.dimensiones);
    setMedida(r.medida);
    setTipoGrafico(r.tipoGrafico);
    setTab("builder");
    ejecutar({ fuente: r.fuente, dimensiones: r.dimensiones, medida: r.medida });
  }

  const chartData = useMemo(
    () =>
      filas.map((f) => ({
        label: dimensionesUsadas.map((d) => String(f[d] ?? "—")).join(" / ") || "—",
        valor: f.valor,
      })),
    [filas, dimensionesUsadas],
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab((v as "builder" | "saved") ?? "builder")}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
          <h2 className="text-lg font-semibold text-slate-800">Análisis Dinámico (BI)</h2>
          <TabsList>
            <TabsTrigger value="builder">Constructor</TabsTrigger>
            <TabsTrigger value="saved">Mis Reportes Guardados ({reportes.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="builder" className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <div className="w-full shrink-0 space-y-4 border-b border-slate-200 bg-slate-50 p-4 md:w-64 md:overflow-y-auto md:border-r md:border-b-0">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Fuente de Datos
              </label>
              <Select value={fuenteId} onValueChange={(v) => v && cambiarFuente(v as FuenteId)}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue>{() => fuente.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fuentes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                <Database size={10} /> Datos de: {ARCHIVO_ORIGEN[fuenteId]}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Dimensiones
              </label>
              <div className="flex flex-wrap gap-1.5">
                {fuente.dimensiones.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDimension(d.id)}
                    className={cn(
                      "rounded border px-2 py-1 text-xs font-medium transition-colors",
                      dimensiones.includes(d.id)
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Medida</label>
              <Select value={medida} onValueChange={(v) => v && setMedida(v)}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue>{() => fuente.medidas.find((m) => m.id === medida)?.label ?? "Selecciona"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fuente.medidas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Mostrar</label>
              <Select value={String(limite)} onValueChange={(v) => v && cambiarLimite(v)}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue>
                    {() => OPCIONES_LIMITE.find((o) => o.value === String(limite))?.label ?? "Top 15"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_LIMITE.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {limite >= 500 && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Con &quot;Todos&quot; el gráfico crece y se puede desplazar — la tabla suele ser más práctica.
                </p>
              )}
            </div>

            <Button onClick={() => ejecutar()} disabled={pending || dimensiones.length === 0 || !medida} className="w-full">
              {pending ? "Generando..." : "Generar"}
            </Button>

            <div className="border-t border-slate-200 pt-3">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Guardar Reporte
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={nombreReporte}
                  onChange={(e) => setNombreReporte(e.target.value)}
                  placeholder="Nombre del reporte"
                  className="h-8 bg-white text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  disabled={guardando || !nombreReporte.trim()}
                  onClick={guardar}
                  aria-label="Guardar reporte"
                >
                  <Save size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setVista("chart")}
                  className={cn(
                    "rounded border px-2 py-1 text-xs font-medium",
                    vista === "chart" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500",
                  )}
                >
                  Gráfico
                </button>
                <button
                  type="button"
                  onClick={() => setVista("table")}
                  className={cn(
                    "flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium",
                    vista === "table" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500",
                  )}
                >
                  <Table2 size={12} /> Tabla ({filas.length})
                </button>
              </div>

              {vista === "chart" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoGrafico("bar")}
                    className={cn(
                      "rounded border p-1.5",
                      tipoGrafico === "bar" ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-400",
                    )}
                    aria-label="Gráfico de barras"
                  >
                    <BarChart2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoGrafico("line")}
                    className={cn(
                      "rounded border p-1.5",
                      tipoGrafico === "line" ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-400",
                    )}
                    aria-label="Gráfico de línea"
                  >
                    <TrendingUp size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 text-slate-400" size={14} />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar..."
                    className="h-7 w-48 pl-7 text-xs"
                  />
                </div>
              )}
            </div>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="min-h-0 flex-1 overflow-auto">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  {pending ? "Generando..." : "Elige dimensiones y una medida, luego pulsa Generar."}
                </div>
              ) : vista === "table" ? (
                <TablaResultados
                  filas={filas}
                  dimensionesUsadas={dimensionesUsadas}
                  fuente={fuente}
                  medida={medida}
                  busqueda={busqueda}
                />
              ) : tipoGrafico === "bar" ? (
                // Horizontal: con nombres de producto largos y hasta 500
                // categorías ("Todos"), barras verticales con etiquetas
                // rotadas se amontonan y quedan ilegibles — en horizontal
                // cada categoría tiene su propia fila y el texto se lee
                // normal. El alto crece con la cantidad de filas y el
                // contenedor de arriba scrollea en vez de aplastar las barras.
                <div style={{ height: Math.max(320, chartData.length * ALTO_POR_FILA_BARRA) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string) => truncar(v)}
                        width={170}
                        interval={0}
                      />
                      <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString("es-CO") : v)} />
                      <Legend />
                      <Bar dataKey="valor" fill="#6366f1" name={fuente.medidas.find((m) => m.id === medida)?.label ?? "Valor"} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => truncar(v, 16)}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString("es-CO") : v)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#6366f1"
                      name={fuente.medidas.find((m) => m.id === medida)?.label ?? "Valor"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {reportes.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no has guardado ningún reporte.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {reportes.map((r) => (
                <div
                  key={r.id}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-400"
                  onClick={() => cargarReporte(r)}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-bold text-slate-800">{r.nombre}</h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminar(r.id);
                      }}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Eliminar reporte"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {fuentes.find((f) => f.id === r.fuente)?.label ?? r.fuente}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Actualizado: {new Date(r.updatedAt).toLocaleString("es-CO")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TablaResultados({
  filas,
  dimensionesUsadas,
  fuente,
  medida,
  busqueda,
}: {
  filas: FilaResultado[];
  dimensionesUsadas: string[];
  fuente: FuenteOpcion;
  medida: string;
  busqueda: string;
}) {
  const medidaLabel = fuente.medidas.find((m) => m.id === medida)?.label ?? "Valor";
  const filtradas = busqueda.trim()
    ? filas.filter((f) =>
        dimensionesUsadas.some((d) => String(f[d] ?? "").toLowerCase().includes(busqueda.trim().toLowerCase())),
      )
    : filas;

  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50">
        <tr>
          {dimensionesUsadas.map((d) => (
            <th
              key={d}
              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              {fuente.dimensiones.find((dim) => dim.id === d)?.label ?? d}
            </th>
          ))}
          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
            {medidaLabel}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {filtradas.map((f, i) => (
          <tr key={i} className="hover:bg-slate-50">
            {dimensionesUsadas.map((d) => (
              <td key={d} className="whitespace-nowrap px-3 py-2 text-slate-700">
                {String(f[d] ?? "—")}
              </td>
            ))}
            <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">
              {f.valor.toLocaleString("es-CO")}
            </td>
          </tr>
        ))}
        {filtradas.length === 0 && (
          <tr>
            <td colSpan={dimensionesUsadas.length + 1} className="px-3 py-8 text-center text-slate-500">
              No hay resultados.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
