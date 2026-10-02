"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Envuelve contenido ya renderizado (server o client) en un tooltip de
 * hover. Existe por separado de KPICard/etc. para que un Server Component
 * pueda pasarle `children` (JSX ya renderizado, sí serializable) sin tener
 * que convertir todo el componente padre en "use client" — eso rompía props
 * como `icon={Clock}` (una referencia a componente no es serializable a
 * través del límite server/client).
 */
export function HoverTooltip({ tooltip, children }: { tooltip: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help" />}>{children}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
