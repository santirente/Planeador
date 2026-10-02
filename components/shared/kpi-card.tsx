import Link from "next/link";
import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";
import { HoverTooltip } from "@/components/shared/hover-tooltip";
import { cn } from "@/lib/utils";

export function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  alert,
  href,
  tooltip,
}: {
  title: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  alert?: boolean;
  href?: string;
  tooltip?: ReactNode;
}) {
  const inner = (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-white p-4 shadow-sm transition-all",
        href && "cursor-pointer hover:border-indigo-400",
        alert ? "border-red-300 ring-1 ring-red-100" : "border-slate-200",
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
          {title}
          {tooltip && <Info size={11} className="text-slate-400" />}
        </span>
        <div
          className={cn(
            "rounded-md p-2",
            alert ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400",
          )}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="flex items-baseline space-x-1">
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
    </div>
  );

  const content = href ? <Link href={href}>{inner}</Link> : inner;

  return tooltip ? <HoverTooltip tooltip={tooltip}>{content}</HoverTooltip> : content;
}
