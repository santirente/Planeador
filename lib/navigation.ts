import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  UploadCloud,
  ShoppingCart,
  Factory,
  Users,
  ClipboardList,
  TrendingUp,
  BarChart2,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  name: string;
  icon: LucideIcon;
  /** Módulo aún no implementado (ver docs/BLUEPRINT.md, fases del roadmap). */
  proximamente?: boolean;
};

export const navigation: NavItem[] = [
  { href: "/dashboard", name: "Dashboard Principal", icon: LayoutDashboard },
  { href: "/upload", name: "Carga de Datos", icon: UploadCloud },
  {
    href: "/purchasing",
    name: "Nec. Compra (Insumos)",
    icon: ShoppingCart,
  },
  { href: "/injection", name: "Nec. Inyección (Piezas)", icon: Factory },
  { href: "/orders", name: "Pedidos y Clientes", icon: ClipboardList },
  {
    href: "/labor",
    name: "Capacidad Mano de Obra",
    icon: Users,
  },
  {
    href: "/prediction",
    name: "Predicción Demanda",
    icon: TrendingUp,
  },
  {
    href: "/dynamic-analysis",
    name: "Análisis Dinámico (BI)",
    icon: BarChart2,
  },
  { href: "/admin", name: "Administración", icon: Settings },
];
