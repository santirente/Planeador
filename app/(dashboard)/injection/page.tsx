import { Factory } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { NecesidadTable } from "@/components/balance/necesidad-table";
import { getNecesidadInyeccion } from "@/lib/balance/queries";
import { getUmbralAdvertenciaPct } from "@/lib/config/queries";
import { isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function InjectionPage() {
  if (!isDatabaseConfigured()) {
    return (
      <EmptyState
        icon={Factory}
        title="Base de datos no configurada"
        description="Completa .env.local para que el motor de balance pueda calcular las necesidades de inyección."
      />
    );
  }

  const [rows, umbralPct] = await Promise.all([getNecesidadInyeccion(), getUmbralAdvertenciaPct()]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Factory}
        title="Sin necesidades de inyección calculadas todavía"
        description="Sube BOM, Kardex, Pedidos y Órdenes en Proceso en Carga de Datos para que el motor de balance calcule los déficits de piezas."
      />
    );
  }

  return (
    <div>
      <FuenteDatos
        fuentes={["productos", "bom", "kardex", "pedidos"]}
        nota="motor de balance — el stock de seguridad se deriva de Pedidos, configurable en Administración"
      />
      <NecesidadTable rows={rows} necesidadLabel="Necesidad de Inyección (Piezas Plásticas)" umbralPct={umbralPct} />
    </div>
  );
}
