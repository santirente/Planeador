import { Clock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { InfoCard } from "@/components/shared/info-card";
import { getCapacidadSemana, getNecesidadMinutosTotal } from "@/lib/labor/queries";
import { updateCapacidadDiaAction } from "@/lib/config/actions";
import { isDatabaseConfigured } from "@/lib/db/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

const NOMBRES_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export default async function LaborPage() {
  if (!isDatabaseConfigured()) {
    return (
      <EmptyState
        icon={Clock}
        title="Base de datos no configurada"
        description="Completa .env.local para configurar la capacidad de mano de obra."
      />
    );
  }

  const [capacidad, necesidadTotal] = await Promise.all([getCapacidadSemana(), getNecesidadMinutosTotal()]);
  const capacidadTotal = capacidad.reduce((sum, d) => sum + d.minutosDisponibles, 0);
  const balance = capacidadTotal - necesidadTotal;

  return (
    <div className="space-y-6">
      <FuenteDatos
        fuentes={["productos", "bom", "kardex", "pedidos"]}
        nota="necesidad de minutos, vía motor de balance (incluye stock de seguridad derivado) — la capacidad se configura a mano abajo, no viene de archivo"
      />
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Nota:</strong> la hoja de Novasoft para capacidad de mano de obra tiene un formato irregular que
        todavía no se pudo mapear automáticamente (ver <code className="rounded bg-white px-1">docs/BLUEPRINT.md</code>).
        Mientras tanto, la disponibilidad se configura manualmente abajo. La necesidad de minutos sí es real —
        viene del motor de balance (ítems categoría &quot;tiempo&quot; en el BOM).
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          title="Necesidad Total (semana)"
          value={necesidadTotal.toLocaleString("es-CO")}
          unit="min"
          tooltip={
            <>
              Suma de los minutos de todos los ítems categoría &quot;tiempo&quot; (tareas de mano de obra) que el
              motor de balance tocó al explotar la demanda real de hoy: pedidos + stock de seguridad, propagados a
              través de la receta (BOM) de cada producto. Se recalcula cada vez que cambian los datos — no es un
              valor configurado a mano.
            </>
          }
        />
        <InfoCard
          title="Capacidad Configurada (semana)"
          value={capacidadTotal.toLocaleString("es-CO")}
          unit="min"
          tooltip={
            <>
              Suma de los &quot;Minutos disponibles&quot; que configuraste manualmente para cada día en los
              formularios de abajo. No viene de Novasoft — la hoja de capacidad del ERP tiene un formato irregular
              que todavía no se pudo mapear automáticamente, así que por ahora se define a mano acá.
            </>
          }
        />
        <InfoCard
          title="Balance"
          value={balance.toLocaleString("es-CO")}
          unit="min"
          tone={balance < 0 ? "negative" : "positive"}
          tooltip={
            <>
              Capacidad Configurada menos Necesidad Total. Un valor negativo significa que la mano de obra
              disponible no alcanza para cubrir la demanda actual de la semana.
            </>
          }
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Capacidad Disponible por Día</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {capacidad.map((dia) => (
            <form
              key={`${dia.dia}-${dia.actualizadoEn}`}
              action={updateCapacidadDiaAction}
              className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <input type="hidden" name="dia" value={dia.dia} />
              <h3 className="border-b border-slate-200 pb-2 text-center font-bold text-slate-700">
                {NOMBRES_DIA[dia.dia]}
              </h3>
              <label className="block text-xs text-slate-500">
                Minutos disponibles
                <Input
                  type="number"
                  name="minutosDisponibles"
                  defaultValue={dia.minutosDisponibles}
                  min={0}
                  className="mt-1"
                />
              </label>
              <label className="block text-xs text-slate-500">
                Headcount
                <Input type="number" name="headcount" defaultValue={dia.headcount ?? ""} min={0} className="mt-1" />
              </label>
              <label className="block text-xs text-slate-500">
                Horas extra
                <Input
                  type="number"
                  name="horasExtra"
                  defaultValue={dia.horasExtra ?? ""}
                  min={0}
                  className="mt-1"
                />
              </label>
              <label className="block text-xs text-slate-500">
                Temporales
                <Input
                  type="number"
                  name="temporales"
                  defaultValue={dia.temporales ?? ""}
                  min={0}
                  className="mt-1"
                />
              </label>
              <Button type="submit" size="sm" className="w-full">
                Guardar
              </Button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
