import { Shield } from "lucide-react";
import { isDatabaseConfigured } from "@/lib/db/queries";

export default function AdminPage() {
  const dbConfigured = isDatabaseConfigured();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center text-xl font-bold text-slate-800">
          <Shield className="mr-2 text-indigo-600" /> Panel de Administración
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Configuración de integración de datos. Umbrales de déficit y roles llegan en una
          iteración posterior (ver <code className="rounded bg-slate-100 px-1">docs/BLUEPRINT.md</code>).
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
            <div>
              <h4 className="font-semibold text-slate-800">Base de datos (Supabase)</h4>
              <p className="text-xs text-slate-500">Conexión configurada vía DATABASE_URL</p>
            </div>
            <span
              className={
                dbConfigured
                  ? "rounded bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800"
                  : "rounded bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
              }
            >
              {dbConfigured ? "Conectado" : "Sin configurar"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
            <div>
              <h4 className="font-semibold text-slate-800">Integración directa ERP Novasoft</h4>
              <p className="text-xs text-slate-500">Ingesta por API/BD en vivo</p>
            </div>
            <span className="rounded bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
              No confirmada
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
