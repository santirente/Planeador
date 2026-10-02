"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type EstadoCarga = "success" | "warning" | "error";
type ErrorDetalle = { fila: number; motivo: string };

export function CargaEstadoBadge({
  estado,
  filasError,
  detalleErrores,
}: {
  estado: EstadoCarga;
  filasError: number;
  detalleErrores: ErrorDetalle[] | null;
}) {
  const badge =
    estado === "success" ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle size={12} className="mr-1" /> Éxito
      </span>
    ) : estado === "warning" ? (
      <span className="inline-flex cursor-help items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
        <AlertTriangle size={12} className="mr-1" /> Advertencia ({filasError})
      </span>
    ) : (
      <span className="inline-flex cursor-help items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <AlertTriangle size={12} className="mr-1" /> Fallido
      </span>
    );

  if (!detalleErrores || detalleErrores.length === 0) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
      <TooltipContent align="start" className="max-w-sm">
        <p className="mb-1 font-semibold">
          {detalleErrores.length} fila(s) con error{detalleErrores.length !== 1 ? "s" : ""}:
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {detalleErrores.slice(0, 5).map((e, i) => (
            <li key={i}>
              {e.fila ? `Fila ${e.fila}: ` : ""}
              {e.motivo}
            </li>
          ))}
        </ul>
        {detalleErrores.length > 5 && (
          <p className="mt-1 text-slate-300">y {detalleErrores.length - 5} más...</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
