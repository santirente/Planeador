"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function InfoCard({
  title,
  value,
  unit,
  tooltip,
  tone = "neutral",
}: {
  title: string;
  value: ReactNode;
  unit?: string;
  tooltip: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "cursor-help rounded-lg border p-4 text-left shadow-sm",
              tone === "positive" && "border-emerald-200 bg-emerald-50",
              tone === "negative" && "border-red-300 bg-red-50",
              tone === "neutral" && "border-slate-200 bg-white",
            )}
          />
        }
      >
        <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
          {title}
          <Info size={12} className="text-slate-400" />
        </span>
        <h3
          className={cn(
            "mt-1 text-2xl font-bold",
            tone === "positive" && "text-emerald-700",
            tone === "negative" && "text-red-700",
            tone === "neutral" && "text-slate-800",
          )}
        >
          {value} {unit}
        </h3>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
