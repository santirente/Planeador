import { Shield } from "lucide-react";
import { isDatabaseConfigured } from "@/lib/db/queries";
import { getUmbralAdvertenciaPct, getSemanasColchonStockSeguridad } from "@/lib/config/queries";
import { updateUmbralAction, updateSemanasColchonAction } from "@/lib/config/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const dbConfigured = isDatabaseConfigured();
  const [umbralActual, semanasColchonActual] = dbConfigured
    ? await Promise.all([getUmbralAdvertenciaPct(), getSemanasColchonStockSeguridad()])
    : [null, null];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center text-xl font-bold text-slate-800">
          <Shield className="mr-2 text-indigo-600" /> Panel de Administración
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Configuración de integración de datos. Roles y permisos llegan en una
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

      {dbConfigured && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-lg font-bold text-slate-800">Umbral de Advertencia</h3>
          <p className="mb-4 text-sm text-slate-600">
            Un balance negativo siempre se marca <strong>Crítico</strong>. Un balance positivo pero con menos de
            este porcentaje de colchón sobre la necesidad se marca <strong>Advertencia</strong> en vez de
            &quot;Cubierto&quot;, en las pantallas de Necesidad de Compra e Inyección.
          </p>
          {/* key=umbralActual: fuerza a React a remontar el Input (no
              controlado, usa defaultValue) cuando el valor guardado cambia
              tras el Server Action + revalidatePath, evitando el warning de
              Base UI "changing the default value state of an uncontrolled
              FieldControl". */}
          <form key={umbralActual} action={updateUmbralAction} className="flex items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Umbral (%)</span>
              <Input
                type="number"
                name="umbralAdvertenciaPct"
                defaultValue={umbralActual ?? 15}
                min={0}
                max={100}
                step="0.1"
                className="w-32"
              />
            </label>
            <Button type="submit">Guardar</Button>
          </form>
        </div>
      )}

      {dbConfigured && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-lg font-bold text-slate-800">Colchón de Stock de Seguridad</h3>
          <p className="mb-4 text-sm text-slate-600">
            Novasoft no exporta un archivo aparte de stock de seguridad — se calcula cruzando el histórico de
            Pedidos: promedio de demanda semanal de cada ítem (sobre el rango de fechas real cargado) × estas semanas
            de colchón. Afecta la Necesidad de Compra, Inyección y Capacidad de Mano de Obra.
          </p>
          <form key={semanasColchonActual} action={updateSemanasColchonAction} className="flex items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Semanas de colchón</span>
              <Input
                type="number"
                name="semanasColchon"
                defaultValue={semanasColchonActual ?? 2}
                min={0}
                step="0.5"
                className="w-32"
              />
            </label>
            <Button type="submit">Guardar</Button>
          </form>
        </div>
      )}
    </div>
  );
}
