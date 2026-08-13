import React from "react";
import {
  ShoppingCart,
  Wallet,
  Users,
  AlertTriangle,
  Package,
  Activity,
  ClipboardList,
  AlertCircle,
  Clock,
} from "lucide-react";

/* ──────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────── */

export interface DashboardCardConfig {
  title: string;
  getValue: (data: DashboardMetrics) => string | number;
  sub: string;
  icon: React.ReactNode;
  colorClass: string;
  borderColor: string;
  valueColor?: string;
  trend?: (data: DashboardMetrics) => { value: string; isPositive: boolean } | undefined;
}

export interface DashboardMetrics {
  // Existing metrics
  ventasHoy: number;
  ingresosCaja: number;
  stockBajoCount: number;
  totalClientes: number;
  productosMasVendidosCount: number;

  // New metrics for operational roles
  ventasHoyCount: number;
  productosSinStock: number;
  productosActivosCount: number;
  movimientosInventarioHoy: number;
  comprasHoy: number;
  clientesAtendidosHoy: number;
  proveedoresActivos: number;
}

/* ──────────────────────────────────────────────
   ROLE CARD CONFIGURATIONS
   ────────────────────────────────────────────── */

const ADMINISTRADOR_CARDS: DashboardCardConfig[] = [
  {
    title: "Ventas del Día",
    getValue: (d) => `$${d.ventasHoy.toLocaleString("es-AR")}`,
    sub: "Facturado hoy",
    icon: <ShoppingCart size={26} className="text-[var(--danger)]" />,
    colorClass: "bg-[var(--danger-light)]",
    borderColor: "border-l-[var(--danger)]",
    valueColor: "text-[var(--danger)]",
    trend: (d) =>
      d.ventasHoy > 0
        ? { value: "+12% vs ayer", isPositive: true }
        : { value: "Sin ventas hoy", isPositive: false },
  },
  {
    title: "Efectivo en Caja",
    getValue: (d) => `$${d.ingresosCaja.toLocaleString("es-AR")}`,
    sub: "Saldo actual",
    icon: <Wallet size={26} className="text-[var(--success)]" />,
    colorClass: "bg-[var(--success-light)]",
    borderColor: "border-l-[var(--success)]",
    valueColor: "text-[var(--success)]",
  },
  {
    title: "Clientes",
    getValue: (d) => d.totalClientes,
    sub: "Registrados",
    icon: <Users size={26} className="text-[var(--info)]" />,
    colorClass: "bg-[var(--info-light)]",
    borderColor: "border-l-[var(--info)]",
    valueColor: "text-[var(--info)]",
  },
  {
    title: "Stock Bajo",
    getValue: (d) => d.stockBajoCount,
    sub: "Bajo mínimo",
    icon: <AlertTriangle size={26} className="text-[var(--warning)]" />,
    colorClass: "bg-[var(--warning-light)]",
    borderColor: "border-l-[var(--warning)]",
    valueColor: "text-[var(--warning)]",
    trend: (d) =>
      d.stockBajoCount > 0
        ? { value: `${d.stockBajoCount} productos`, isPositive: false }
        : undefined,
  },
  {
    title: "Productos Activos",
    getValue: (d) => d.productosActivosCount,
    sub: "En catálogo",
    icon: <Package size={26} className="text-purple-400" />,
    colorClass: "bg-purple-500/20",
    borderColor: "border-l-purple-500",
    valueColor: "text-purple-400",
  },
];

const ENCARGADO_VENTAS_CARDS: DashboardCardConfig[] = [
  {
    title: "Ventas del Día",
    getValue: (d) => `$${d.ventasHoy.toLocaleString("es-AR")}`,
    sub: "Facturado hoy",
    icon: <ShoppingCart size={26} className="text-[var(--danger)]" />,
    colorClass: "bg-[var(--danger-light)]",
    borderColor: "border-l-[var(--danger)]",
    valueColor: "text-[var(--danger)]",
  },
  {
    title: "Ventas Realizadas",
    getValue: (d) => d.ventasHoyCount,
    sub: "Operaciones hoy",
    icon: <ClipboardList size={26} className="text-[var(--success)]" />,
    colorClass: "bg-[var(--success-light)]",
    borderColor: "border-l-[var(--success)]",
    valueColor: "text-[var(--success)]",
  },
  {
    title: "Clientes Atendidos",
    getValue: (d) => d.clientesAtendidosHoy,
    sub: "Durante el día",
    icon: <Users size={26} className="text-[var(--info)]" />,
    colorClass: "bg-[var(--info-light)]",
    borderColor: "border-l-[var(--info)]",
    valueColor: "text-[var(--info)]",
  },
  {
    title: "Ticket Promedio",
    getValue: (d) => {
      const ticket = d.ventasHoyCount > 0 ? d.ventasHoy / d.ventasHoyCount : 0;
      return `$${ticket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
    },
    sub: "Promedio por venta",
    icon: <Activity size={26} className="text-purple-400" />,
    colorClass: "bg-purple-500/20",
    borderColor: "border-l-purple-500",
    valueColor: "text-purple-400",
  },
  {
    title: "Clientes",
    getValue: (d) => d.totalClientes,
    sub: "Registrados",
    icon: <Users size={26} className="text-[var(--warning)]" />,
    colorClass: "bg-[var(--warning-light)]",
    borderColor: "border-l-[var(--warning)]",
    valueColor: "text-[var(--warning)]",
  },
];

const ENCARGADO_STOCK_CARDS: DashboardCardConfig[] = [
  {
    title: "Productos Activos",
    getValue: (d) => d.productosActivosCount,
    sub: "En catálogo",
    icon: <Package size={26} className="text-[var(--info)]" />,
    colorClass: "bg-[var(--info-light)]",
    borderColor: "border-l-[var(--info)]",
    valueColor: "text-[var(--info)]",
  },
  {
    title: "Stock Bajo",
    getValue: (d) => d.stockBajoCount,
    sub: "Bajo mínimo",
    icon: <AlertTriangle size={26} className="text-[var(--warning)]" />,
    colorClass: "bg-[var(--warning-light)]",
    borderColor: "border-l-[var(--warning)]",
    valueColor: "text-[var(--warning)]",
    trend: (d) =>
      d.stockBajoCount > 0
        ? { value: `${d.stockBajoCount} productos`, isPositive: false }
        : undefined,
  },
  {
    title: "Sin Stock",
    getValue: (d) => d.productosSinStock,
    sub: "Requieren atención",
    icon: <AlertCircle size={26} className="text-[var(--danger)]" />,
    colorClass: "bg-[var(--danger-light)]",
    borderColor: "border-l-[var(--danger)]",
    valueColor: "text-[var(--danger)]",
  },
  {
    title: "Reposición Necesaria",
    getValue: (d) => d.stockBajoCount,
    sub: "Productos",
    icon: <Clock size={26} className="text-purple-400" />,
    colorClass: "bg-purple-500/20",
    borderColor: "border-l-purple-500",
    valueColor: "text-purple-400",
  },
  {
    title: "Proveedores Activos",
    getValue: (d) => d.proveedoresActivos,
    sub: "Registrados",
    icon: <Users size={26} className="text-[var(--success)]" />,
    colorClass: "bg-[var(--success-light)]",
    borderColor: "border-l-[var(--success)]",
    valueColor: "text-[var(--success)]",
  },
];

/* ──────────────────────────────────────────────
   CONFIG MAP — add new roles here
   ────────────────────────────────────────────── */

export const ROLE_DASHBOARD_CONFIG: Record<string, DashboardCardConfig[]> = {
  ADMINISTRADOR: ADMINISTRADOR_CARDS,
  ENCARGADO_VENTAS: ENCARGADO_VENTAS_CARDS,
  ENCARGADO_STOCK: ENCARGADO_STOCK_CARDS,
};

/* ──────────────────────────────────────────────
   HELPER
   ────────────────────────────────────────────── */

const DEFAULT_CARDS: DashboardCardConfig[] = ADMINISTRADOR_CARDS;

export function getCardsForRole(role: string): DashboardCardConfig[] {
  return ROLE_DASHBOARD_CONFIG[role] ?? DEFAULT_CARDS;
}
