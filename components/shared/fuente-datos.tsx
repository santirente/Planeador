import { Database } from "lucide-react";

// Debe reflejar las claves de HANDLERS en app/api/ingest/route.ts y las
// etiquetas de REPORT_TYPES en components/upload/upload-form.tsx — los
// únicos 5 archivos que realmente vienen de Novasoft.
const LABELS: Record<string, string> = {
  productos: "Maestro de Productos",
  bom: "BOM / Lista de Materiales",
  kardex: "Kardex de Inventario",
  pedidos: "Listado de Pedidos",
  mallas: "Listado de Mallas",
};

export type FuenteReporteId = keyof typeof LABELS;

/** Nota de transparencia: de qué archivo(s) subido(s) en Carga de Datos sale la información de esta pantalla. */
export function FuenteDatos({ fuentes, nota }: { fuentes: FuenteReporteId[]; nota?: string }) {
  return (
    <p className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <Database size={12} className="shrink-0 text-slate-400" />
      <span className="font-medium text-slate-600">Fuente de datos:</span>
      <span>{fuentes.map((f) => LABELS[f]).join(" · ")}</span>
      {nota && <span className="text-slate-400">— {nota}</span>}
    </p>
  );
}
