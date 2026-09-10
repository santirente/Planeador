import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function PurchasingPage() {
  // TODO: motor de balance de insumos (docs/BLUEPRINT.md §8) — requiere
  // productos + bom_items + kardex_existencias + demanda_stock_seguridad.
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Sin necesidades de compra calculadas todavía"
      description="Sube Productos, BOM y Kardex en Carga de Datos para que el motor de balance calcule los déficits de insumos."
    />
  );
}
