import { TrendingUp } from "lucide-react";
import { DemandChart } from "@/components/demand/demand-chart";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { getSerieDemandaMensual } from "@/lib/demand/queries";
import { isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function PredictionPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
        Configura la base de datos para ver la predicción de demanda.
      </div>
    );
  }

  const { puntos, suficienteHistorico, mesesHistoricos } = await getSerieDemandaMensual();

  return (
    <div className="space-y-4">
      <FuenteDatos fuentes={["pedidos"]} nota="acumulado mes a mes con cada carga, ver texto abajo" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center text-lg font-bold text-slate-800">
            <TrendingUp className="mr-2 text-indigo-600" size={20} />
            Predicción de Demanda
          </h2>
          <span className="text-xs text-slate-500">{mesesHistoricos} mes(es) de histórico real</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Cada carga de Pedidos suma un mes más de histórico real (la cantidad total pedida ese mes, según la fecha
          del pedido). La proyección es una tendencia lineal simple sobre esos meses — se vuelve más confiable a
          medida que se acumulan más cargas.
        </p>

        {puntos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-16 text-center">
            <p className="text-sm text-slate-500">
              Todavía no hay histórico de demanda. Sube un archivo de Pedidos en Carga de Datos para empezar a
              acumularlo.
            </p>
          </div>
        ) : (
          <>
            <div className="h-80 w-full">
              <DemandChart puntos={puntos} />
            </div>
            {!suficienteHistorico && (
              <p className="mt-3 text-xs text-amber-600">
                Todavía no hay suficiente histórico (mínimo 3 meses) para mostrar una proyección confiable — por ahora
                solo se muestra la demanda real acumulada.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
