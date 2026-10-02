import { UploadForm } from "@/components/upload/upload-form";
import { CargaEstadoBadge } from "@/components/upload/carga-estado-badge";
import { getRecentCargas, isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const cargas = await getRecentCargas();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <UploadForm />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-slate-900">Historial de Cargas Recientes</h3>
        </div>

        {!isDatabaseConfigured() ? (
          <p className="p-6 text-sm text-slate-500">
            La base de datos todavía no está configurada — el historial aparecerá aquí una vez
            que completes <code className="rounded bg-slate-100 px-1">.env.local</code>.
          </p>
        ) : cargas.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aún no hay cargas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Tipo Reporte</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Archivo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Filas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {cargas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      {new Date(c.createdAt).toLocaleString("es-CO")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{c.tipoReporte}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{c.archivoNombre}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {c.filasExitosas}/{c.filasTotales}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <CargaEstadoBadge
                        estado={c.estado}
                        filasError={c.filasError}
                        detalleErrores={c.detalleErrores}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
