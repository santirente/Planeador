"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Encabezado de columna de tabla con tooltip explicando de dónde sale el valor. */
export function ThTooltip({
  label,
  children,
  align = "center",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-help items-center gap-1" />}>
        {label}
        <Info size={11} className="text-slate-400" />
      </TooltipTrigger>
      <TooltipContent align={align}>{children}</TooltipContent>
    </Tooltip>
  );
}
