import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function OrdersPage() {
  return (
    <EmptyState
      icon={ClipboardList}
      title="Sin pedidos cargados todavía"
      description="Sube Pedidos_Novasoft y el Listado de Mallas en Carga de Datos para ver el estado de despacho por cliente."
    />
  );
}
