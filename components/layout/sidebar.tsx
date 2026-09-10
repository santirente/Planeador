"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-shrink-0 flex-col bg-slate-900 text-white">
      <Link
        href="/dashboard"
        className="flex h-16 shrink-0 items-center border-b border-slate-800 px-4"
      >
        <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-indigo-600 text-xl font-bold">
          P
        </div>
        <span className="text-lg font-bold tracking-wide">ProPlan</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white",
              )}
            >
              <span className="flex items-center">
                <Icon size={20} className="shrink-0" />
                <span className="ml-3">{item.name}</span>
              </span>
              {item.proximamente && (
                <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Pronto
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
