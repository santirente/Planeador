"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { navigation } from "@/lib/navigation";
import { logout } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function initialsFromEmail(email: string) {
  const name = email.split("@")[0] ?? "";
  return name.slice(0, 2).toUpperCase();
}

export function Header({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const title =
    navigation.find((item) => pathname.startsWith(item.href))?.name ??
    "ProPlan";

  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>

      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-400 hover:text-slate-600"
        >
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
        </Button>

        <div className="h-8 w-px bg-slate-200" />

        {userEmail ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center rounded-lg p-1.5 transition-colors hover:bg-slate-50">
                  <Avatar className="mr-2 h-8 w-8 border border-indigo-200 bg-indigo-100 text-indigo-700">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700">
                      {initialsFromEmail(userEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-slate-700 md:block">
                    {userEmail}
                  </span>
                  <ChevronDown size={16} className="ml-2 text-slate-400" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Sesión</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => logout()}
              >
                <LogOut className="mr-2" size={16} />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
