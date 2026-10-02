import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { PedidosTable } from "@/components/orders/pedidos-table";
import { getPedidosPendientes } from "@/lib/orders/queries";
import { isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!isDatabaseConfigured()) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Base de datos no configurada"
        description="Completa .env.local para ver los pedidos pendientes."
      />
    );
  }

  const rows = await getPedidosPendientes();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin pedidos cargados todavía"
        description="Sube Pedidos_Novasoft y el Listado de Mallas en Carga de Datos para ver el estado de despacho por cliente."
      />
    );
  }

  return (
    <div>
      <FuenteDatos fuentes={["pedidos", "mallas"]} />
      <PedidosTable rows={rows} />
    </div>
  );
}
