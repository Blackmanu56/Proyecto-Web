"use client";

import React from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingCart,
  Wallet,
  Users,
  Sparkles,
  Inbox,
  Clock,
  RefreshCw
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  colorClass: string;
  borderColor: string;
  valueColor?: string;
  trend?: { value: string; isPositive: boolean };
  roles?: string[];
}

function StatCard({ title, value, sub, icon, colorClass, borderColor, valueColor, trend }: StatCardProps) {
  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 flex flex-col justify-between shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 h-full min-h-[130px] border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2.5 rounded-full ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">{title}</p>
        <p className={`text-xl font-bold font-mono tracking-tight ${valueColor || "text-[var(--text)]"}`}>{value}</p>
        <p className="text-[10px] text-[var(--text-secondary)]">{sub}</p>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${trend.isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          <span>{trend.isPositive ? "↑" : "↓"}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}

interface DashboardClientProps {
  data: any;
  userName: string;
  role: string;
  formattedDate: string;
}

const PIE_COLORS = ["#d62828", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];

function getGreeting(userName: string): string {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 5 && hour < 12) greeting = "Buenos días";
  else if (hour >= 12 && hour < 20) greeting = "Buenas tardes";
  else greeting = "Buenas noches";
  return `${greeting}, ${userName}`;
}

function getStatCards(data: any, role: string) {
  const { stats, cajaMovimientosRecientes } = data;

  const allStats: StatCardProps[] = [
    {
      title: "Ventas del Día",
      value: formatCurrency(stats.ventasHoy),
      sub: "Facturado hoy en el local",
      icon: <ShoppingCart size={20} className="text-[var(--danger)]" />,
      colorClass: "bg-[var(--danger-light)]",
      borderColor: "border-l-[var(--danger)]",
      valueColor: "text-[var(--danger)]",
      trend: stats.ventasHoy > 0 ? { value: "+12% vs ayer", isPositive: true } : { value: "Sin ventas hoy", isPositive: false },
      roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
    },
    {
      title: "Efectivo en Caja",
      value: formatCurrency(stats.ingresosCaja),
      sub: "Saldo actual en caja",
      icon: <Wallet size={20} className="text-[var(--success)]" />,
      colorClass: "bg-[var(--success-light)]",
      borderColor: "border-l-[var(--success)]",
      valueColor: "text-[var(--success)]",
      roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
    },
    {
      title: "Clientes",
      value: stats.totalClientes,
      sub: "Registrados en el sistema",
      icon: <Users size={20} className="text-[var(--info)]" />,
      colorClass: "bg-[var(--info-light)]",
      borderColor: "border-l-[var(--info)]",
      valueColor: "text-[var(--info)]",
      roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
    },
    {
      title: "Stock Bajo",
      value: stats.stockBajoCount,
      sub: "Productos por debajo del mínimo",
      icon: <AlertTriangle size={20} className="text-[var(--warning)]" />,
      colorClass: stats.stockBajoCount > 0 ? "bg-[var(--warning-light)]" : "bg-[var(--card)]",
      borderColor: stats.stockBajoCount > 0 ? "border-l-[var(--warning)]" : "border-l-[var(--text-secondary)]",
      valueColor: "text-[var(--warning)]",
      trend: stats.stockBajoCount > 0 ? { value: `${stats.stockBajoCount} productos`, isPositive: false } : undefined,
      roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"],
    },
    {
      title: "Productos Activos",
      value: data.productosMasVendidos?.length || 0,
      sub: "En catálogo activo",
      icon: <Package size={20} className="text-purple-400" />,
      colorClass: "bg-purple-500/20",
      borderColor: "border-l-purple-500",
      valueColor: "text-purple-400",
      roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"],
    },
  ];

  return allStats.filter((stat) => stat.roles?.includes(role));
}

export default function DashboardClient({ data, userName, role, formattedDate }: DashboardClientProps) {
  const {
    ventasGrafico,
    categoriaVentas,
    cajaMovimientosRecientes,
    prediccionesStock
  } = data;

  const greeting = getGreeting(userName);
  const statCards = getStatCards(data, role);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="pb-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text)] tracking-tight">
          {greeting}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1.5 capitalize">
          {formattedDate}
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            sub={stat.sub}
            icon={stat.icon}
            colorClass={stat.colorClass}
            borderColor={stat.borderColor}
            valueColor={stat.valueColor}
            trend={stat.trend}
          />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Weekly Sales Chart - 2/3 width */}
        <div className="lg:col-span-8 bg-[var(--card)] border border-[var(--border)] p-5 rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[var(--brand-light)]">
                <TrendingUp size={18} className="text-[var(--brand)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Evolución Semanal de Ventas</h3>
              </div>
            </div>
            <select className="text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]">
              <option>Últimos 7 días</option>
            </select>
          </div>

          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="fecha" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--panel)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--text)"
                  }}
                  formatter={(value: any) => [formatCurrency(value), "Ventas"]}
                />
                <Area type="monotone" dataKey="total" stroke="var(--brand)" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution - 1/3 width */}
        <div className="lg:col-span-4 bg-[var(--card)] border border-[var(--border)] p-5 rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--brand-light)]">
              <Package size={18} className="text-[var(--brand)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Ventas por Rubro</h3>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            {categoriaVentas.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] italic">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoriaVentas}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoriaVentas.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--panel)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius-lg)",
                      color: "var(--text)"
                    }}
                    formatter={(value: any) => [formatCurrency(value), "Facturado"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2 pt-4 border-t border-[var(--border)]/60">
            {categoriaVentas.map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="text-[var(--text-muted)] font-medium">{entry.name}</span>
                </div>
                <span className="font-bold text-[var(--text)] font-mono">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border)]/60">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Total</span>
            <span className="text-sm font-bold text-[var(--text)] font-mono">
              {formatCurrency(categoriaVentas.reduce((sum: number, entry: any) => sum + entry.value, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Activity + Predictions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Activity */}
        <div className="lg:col-span-5 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]/60">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[var(--brand-light)]">
                <Activity size={18} className="text-[var(--brand)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Actividad Reciente</h3>
              </div>
            </div>
            <Link href="/caja" className="text-xs text-[var(--brand)] hover:underline font-medium">
              Ver historial
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]/60 max-h-[380px] overflow-y-auto">
            {cajaMovimientosRecientes.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] text-sm space-y-2">
                <Inbox size={28} className="opacity-40" />
                <p>Sin movimientos recientes</p>
              </div>
            ) : (
              cajaMovimientosRecientes.map((mov: any) => {
                const isIncome = mov.tipo === "INGRESO";
                return (
                  <div
                    key={mov.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-[var(--bg)] transition-colors duration-150"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-full shrink-0 ${
                        isIncome ? "bg-[var(--success-light)]" : "bg-[var(--danger-light)]"
                      }`}>
                        {isIncome ? (
                          <ArrowUpRight size={14} className="text-[var(--success)]" />
                        ) : (
                          <ArrowDownLeft size={14} className="text-[var(--danger)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text)] truncate">{mov.descripcion}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-[var(--text-muted)]">{mov.fecha}</p>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isIncome ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"
                          }`}>
                            {mov.tipo}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold font-mono ${
                        isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}>
                        {isIncome ? "+" : "-"}{formatCurrency(mov.monto)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Predictive Module */}
        <div className="lg:col-span-7 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]/60">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Módulo Predictivo de Abastecimiento</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Análisis inteligente de stock con IA y estadísticas</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full border border-[var(--danger)] text-[var(--danger)] font-bold uppercase tracking-wider">
              IA & ESTADÍSTICA
            </span>
          </div>

          <div className="overflow-x-auto">
            {prediccionesStock.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] text-sm space-y-2">
                <Inbox size={28} className="opacity-40" />
                <p>Sin productos con riesgo de desabastecimiento</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]/60 text-left">
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider">PRODUCTO</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider">PROVEEDOR</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">STOCK ACTUAL</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">VENTA MENSUAL</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center">DÍAS RESTANTES</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {prediccionesStock.map((pred: any) => (
                    <tr key={pred.productoId} className="hover:bg-[var(--bg)] transition-colors duration-150">
                      <td className="px-4 py-2.5 font-medium text-[var(--text)]">{pred.nombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{pred.proveedor}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-[var(--text)]">{pred.stockActual}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-[var(--text)]">{pred.promedioVentaMensual}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-mono font-bold ${pred.diasRestantes <= 7 ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}>
                          {pred.diasRestantes}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {pred.sugerenciaCompra > 0 && (
                          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand)] text-white text-[10px] font-bold rounded-lg hover:bg-[var(--brand-hover)] transition-colors duration-200">
                            Pedir reposición
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
