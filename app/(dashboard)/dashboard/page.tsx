import Link from "next/link";
import { Clock, ShoppingCart, Factory, ClipboardList, Activity, UploadCloud, AlertTriangle, Info } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { getBalanceSummary, getNecesidadCompra, getNecesidadInyeccion } from "@/lib/balance/queries";
import { getRecentCargas, isDatabaseConfigured } from "@/lib/db/queries";
import { sql } from "drizzle-orm";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

async function getPedidosPendientesCount() {
  const { db } = await import("@/lib/db/client");
  const { pedidos } = await import("@/lib/db/schema");
  const [{ count }] = await db.select({ count: sql<number>`count(distinct ${pedidos.numeroPedido})` }).from(pedidos);
  return Number(count);
}

export default async function DashboardPage() {
  const dbConfigured = isDatabaseConfigured();

  const [cargas, summary, pedidosCount, compra, inyeccion] = dbConfigured
    ? await Promise.all([
        getRecentCargas(1),
        getBalanceSummary(),
        getPedidosPendientesCount(),
        getNecesidadCompra(),
        getNecesidadInyeccion(),
      ])
    : [[], { insumosEnDeficit: 0, piezasEnDeficit: 0 }, 0, [], []];

  const ultimaCarga = cargas[0];
  const hayDatos = dbConfigured && ultimaCarga !== undefined;

  const criticos = [...compra, ...inyeccion]
    .filter((r) => r.estado === "critical")
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <FuenteDatos
        fuentes={["productos", "bom", "kardex", "pedidos"]}
        nota="motor de balance — el stock de seguridad se deriva de Pedidos, configurable en Administración"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Faltante Capacidad"
          value="—"
          unit="min"
          icon={Clock}
          href="/labor"
          tooltip="Todavía no se calcula aquí — ve a Capacidad de Mano de Obra para ver la necesidad de minutos (motor de balance) contra la capacidad que configures a mano por día."
        />
        <KPICard
          title="Insumos en Déficit"
          value={hayDatos ? String(summary.insumosEnDeficit) : "—"}
          unit="ítems"
          icon={ShoppingCart}
          alert={summary.insumosEnDeficit > 0}
          href="/purchasing"
          tooltip="Cantidad de insumos (materia prima o empaque) cuyo balance (stock + programado − necesidad) quedó negativo, calculado por el motor de balance sobre la demanda real (pedidos + stock de seguridad) explotada a través del BOM."
        />
        <KPICard
          title="Piezas en Déficit"
          value={hayDatos ? String(summary.piezasEnDeficit) : "—"}
          unit="ítems"
          icon={Factory}
          alert={summary.piezasEnDeficit > 0}
          href="/injection"
          tooltip="Cantidad de piezas en proceso de inyección cuyo balance quedó negativo — mismo cálculo que Insumos en Déficit, pero para ítems categoría 'en proceso'."
        />
        <KPICard
          title="Pedidos Pendientes"
          value={hayDatos ? String(pedidosCount) : "—"}
          unit="pedidos"
          icon={ClipboardList}
          href="/orders"
          tooltip="Número de pedidos distintos (por número de pedido) en la tabla de Pedidos — se reemplaza por completo con cada archivo de Pedidos que subas en Carga de Datos."
        />
        <KPICard
          title="Última Act. Datos"
          value={ultimaCarga ? new Date(ultimaCarga.createdAt).toLocaleDateString("es-CO") : "Sin cargas"}
          icon={Activity}
          href="/upload"
          tooltip="Fecha de la carga más reciente en Carga de Datos, de cualquier tipo de reporte (Productos, BOM, Kardex, Pedidos, etc.)."
        />
      </div>

      {!hayDatos ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center">
          <UploadCloud className="mb-4 h-12 w-12 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-800">Todavía no hay datos cargados</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Sube el Excel de Productos, BOM y Kardex para que el Dashboard y el motor de balance empiecen a mostrar
            información real.
          </p>
          <Button
            className="mt-6"
            nativeButton={false}
            render={<Link href="/upload">Ir a Carga de Datos</Link>}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 flex items-center gap-1.5 text-lg font-semibold text-slate-800">
            <AlertTriangle className="mr-1 text-red-500" size={20} />
            Alertas Críticas
            <Tooltip>
              <TooltipTrigger render={<span className="cursor-help" />}>
                <Info size={13} className="text-slate-400" />
              </TooltipTrigger>
              <TooltipContent align="start">
                Los 8 ítems (insumos + piezas) con el balance más negativo entre Necesidad de Compra y Necesidad de
                Inyección — mientras más negativo, más arriba en la lista.
              </TooltipContent>
            </Tooltip>
          </h3>
          {criticos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin déficits críticos por ahora.</p>
          ) : (
            <div className="space-y-2">
              {criticos.map((item) => (
                <div
                  key={item.itemCode}
                  className="flex items-center justify-between rounded-md border border-slate-100 p-2 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{item.nombre}</div>
                    <div className="text-xs text-slate-500">{item.itemCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-600">{item.balance.toLocaleString("es-CO")}</div>
                    <StatusBadge status={item.estado} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
