"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle, UploadCloud, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Solo estos 5 reportes vienen realmente de Novasoft (confirmado con el
// usuario, 2026-09-12) — "Stock de Seguridad" y "Órdenes en Proceso de
// Inyección" ya no existen como archivo aparte, se derivan cruzando estos
// datos (ver lib/balance/engine.ts). Debe reflejar las claves de HANDLERS en
// app/api/ingest/route.ts.
const IMPLEMENTED_TYPES = new Set(["productos", "kardex", "bom", "pedidos", "mallas"]);

const REPORT_TYPES = [
  { value: "productos", label: "Maestro de Productos (Excel)" },
  { value: "kardex", label: "Kardex de Inventario (Excel)" },
  { value: "bom", label: "BOM / Lista de Materiales (Excel)" },
  { value: "pedidos", label: "Listado de Pedidos (Excel)" },
  { value: "mallas", label: "Listado de Mallas (Excel)" },
] as const;

type UploadResult = {
  error?: string;
  filasExitosas?: number;
  filasError?: number;
  errores?: { fila: number; motivo: string }[];
};

export function UploadForm({ onDone }: { onDone?: () => void }) {
  const [tipoReporte, setTipoReporte] = useState<string>("productos");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submitFile(file: File) {
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipoReporte", tipoReporte);
      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = (await res.json()) as UploadResult;
      setResult(data);
      onDone?.();
    } catch {
      setResult({ error: "No se pudo conectar con el servidor." });
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFile(file);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-slate-800">
        Ingesta de Datos (ERP Novasoft)
      </h2>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Tipo de Reporte a Cargar
        </label>
        <Select value={tipoReporte} onValueChange={(v) => setTipoReporte(v ?? "productos")}>
          <SelectTrigger className="w-full bg-slate-50">
            <SelectValue>
              {(value: string | null) =>
                REPORT_TYPES.find((r) => r.value === value)?.label ?? "Selecciona un reporte"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
                {!IMPLEMENTED_TYPES.has(r.value) ? " — próximamente" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragging ? "border-indigo-400 bg-indigo-50/50" : "border-slate-300 hover:bg-slate-50",
        )}
      >
        <UploadCloud className="mx-auto h-12 w-12 text-indigo-500" />
        <h3 className="mt-2 text-sm font-semibold text-slate-900">
          Arrastra tu archivo Excel aquí
        </h3>
        <p className="mt-1 text-sm text-slate-500">Soporta los archivos (.xls/.xlsx) exportados directamente de Novasoft</p>
        <div className="mt-6 flex justify-center">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) submitFile(file);
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? "Procesando archivo..." : "Seleccionar y Validar Archivo"}
          </Button>
        </div>
      </div>

      {result && (
        <div
          className={cn(
            "mt-4 rounded-lg border p-4",
            result.error
              ? "border-red-200 bg-red-50"
              : (result.filasError ?? 0) > 0
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              {result.error ? (
                <AlertTriangle className="mr-3 mt-0.5 shrink-0 text-red-600" size={22} />
              ) : (
                <CheckCircle className="mr-3 mt-0.5 shrink-0 text-emerald-600" size={22} />
              )}
              <div>
                {result.error ? (
                  <p className="font-bold text-red-800">{result.error}</p>
                ) : (
                  <>
                    <p className="font-bold text-emerald-800">Carga procesada</p>
                    <p className="text-sm text-emerald-700">
                      {result.filasExitosas} filas guardadas correctamente
                      {(result.filasError ?? 0) > 0 && `, ${result.filasError} con errores`}.
                    </p>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setResult(null)} className="text-slate-500 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>

          {result.errores && result.errores.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Fila</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.errores.slice(0, 200).map((e, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1 text-slate-500">{e.fila || "—"}</td>
                      <td className="px-3 py-1 text-slate-700">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
