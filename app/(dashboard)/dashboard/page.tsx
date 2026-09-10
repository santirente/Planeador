import Link from "next/link";
import { Clock, ShoppingCart, Factory, ClipboardList, Activity, UploadCloud } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  // TODO: reemplazar por datos reales del motor de balance una vez exista
  // al menos una carga (ver docs/BLUEPRINT.md, Roadmap paso 3).
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard title="Faltante Capacidad" value="—" unit="min" icon={Clock} href="/labor" />
        <KPICard title="Insumos en Déficit" value="—" unit="ítems" icon={ShoppingCart} href="/purchasing" />
        <KPICard title="Piezas en Déficit" value="—" unit="ítems" icon={Factory} href="/injection" />
        <KPICard title="Pedidos Pendientes" value="—" unit="pedidos" icon={ClipboardList} href="/orders" />
        <KPICard title="Última Act. Datos" value="Sin cargas" icon={Activity} href="/upload" />
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center">
        <UploadCloud className="mb-4 h-12 w-12 text-indigo-400" />
        <h2 className="text-lg font-semibold text-slate-800">
          Todavía no hay datos cargados
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Sube el Excel de Productos, BOM y Kardex para que el Dashboard y el
          motor de balance empiecen a mostrar información real.
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/upload">Ir a Carga de Datos</Link>}
        />
      </div>
    </div>
  );
}
