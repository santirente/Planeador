import { cn } from "@/lib/utils";

export type EstadoBalance = "critical" | "warning" | "ok";

const STYLES: Record<EstadoBalance, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const LABELS: Record<EstadoBalance, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  ok: "Cubierto",
};

export function StatusBadge({
  status,
  text,
}: {
  status: EstadoBalance;
  text?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
      )}
    >
      {text ?? LABELS[status]}
    </span>
  );
}
