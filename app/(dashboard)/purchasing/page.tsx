import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FuenteDatos } from "@/components/shared/fuente-datos";
import { NecesidadTable } from "@/components/balance/necesidad-table";
import { getNecesidadCompra } from "@/lib/balance/queries";
import { getUmbralAdvertenciaPct } from "@/lib/config/queries";
import { isDatabaseConfigured } from "@/lib/db/queries";

// Datos en vivo (auth + DB) — nunca debe intentar pre-renderizarse en build.
export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  if (!isDatabaseConfigured()) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Base de datos no configurada"
        description="Completa .env.local para que el motor de balance pueda calcular las necesidades de compra."
      />
    );
  }

  const [rows, umbralPct] = await Promise.all([getNecesidadCompra(), getUmbralAdvertenciaPct()]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Sin necesidades de compra calculadas todavía"
        description="Sube Productos, BOM, Kardex, Pedidos y Stock de Seguridad en Carga de Datos para que el motor de balance calcule los déficits de insumos."
      />
    );
  }

  return (
    <div>
      <FuenteDatos
        fuentes={["productos", "bom", "kardex", "pedidos"]}
        nota="motor de balance — el stock de seguridad se deriva de Pedidos, configurable en Administración"
      />
      <NecesidadTable rows={rows} necesidadLabel="Necesidad de Compra (Insumos y Empaque)" umbralPct={umbralPct} />
    </div>
  );
}
