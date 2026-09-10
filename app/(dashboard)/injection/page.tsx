import { Factory } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function InjectionPage() {
  // TODO: motor de balance de piezas (docs/BLUEPRINT.md §8) — requiere
  // fichas + bom_items + kardex_existencias + ordenes_produccion_inyeccion.
  return (
    <EmptyState
      icon={Factory}
      title="Sin necesidades de inyección calculadas todavía"
      description="Sube BOM, Kardex y Órdenes en Proceso en Carga de Datos para que el motor de balance calcule los déficits de piezas."
    />
  );
}
