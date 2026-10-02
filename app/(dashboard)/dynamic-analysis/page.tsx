import { ReportBuilder } from "@/components/analytics/report-builder";
import { listarReportes } from "@/lib/analytics/queries";
import { FUENTES_LISTA } from "@/lib/analytics/sources";
import { isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function DynamicAnalysisPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
        Configura la base de datos para usar el Análisis Dinámico.
      </div>
    );
  }

  const reportes = await listarReportes();

  return (
    <ReportBuilder
      fuentes={FUENTES_LISTA}
      reportesIniciales={reportes.map((r) => ({ ...r, dimensiones: r.dimensiones }))}
    />
  );
}
