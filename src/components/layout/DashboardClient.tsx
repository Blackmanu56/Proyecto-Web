"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
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
  ShoppingBag,
  Coins,
  Sparkles,
  Inbox
} from "lucide-react";

interface StatProps {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  textColor?: string;
  wide?: boolean;
}

function StatCard({ title, value, sub, icon, iconBg, textColor = "text-white", wide }: StatProps) {
  return (
    <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-black/5 hover:border-slate-700/60 transition duration-150 h-full`}>
      <div className="space-y-1">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{title}</p>
        <p className={`${wide ? "text-3xl" : "text-2xl"} font-black ${textColor} font-mono tracking-tight`}>{value}</p>
        <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg} border border-white/5`}>
        {icon}
      </div>
    </div>
  );
}

interface DashboardClientProps {
  data: any;
}

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f43f5e"];

export default function DashboardClient({ data }: DashboardClientProps) {
  const {
    stats,
    ventasGrafico,
    productosMasVendidos,
    categoriaVentas,
    cajaMovimientosRecientes,
    prediccionesStock
  } = data;

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Sales — prominent, spans 2 cols on large screens */}
        <div className="sm:col-span-2">
          <StatCard
            title="Ventas del Día"
            value={formatCurrency(stats.ventasHoy)}
            sub="Facturado hoy en el local"
            icon={<ShoppingBag size={22} />}
            iconBg="bg-indigo-500/10 text-indigo-400"
            textColor="text-indigo-400"
            wide
          />
        </div>
        {/* Caja */}
        <StatCard
          title="Efectivo en Caja"
          value={formatCurrency(stats.ingresosCaja)}
          sub="Saldo activo de la caja"
          icon={<Coins size={18} />}
          iconBg="bg-emerald-500/10 text-emerald-400"
          textColor="text-emerald-400"
        />
        {/* Stock alerts — warning-colored */}
        <StatCard
          title="Alertas de Stock"
          value={stats.stockBajoCount}
          sub="Stock crítico"
          icon={<AlertTriangle size={18} />}
          iconBg={stats.stockBajoCount > 0 ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-500"}
          textColor={stats.stockBajoCount > 0 ? "text-amber-400" : "text-white"}
        />
      </div>

      {/* 2. Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico de Ventas Semanal (8/12 cols) */}
        <div className="lg:col-span-8 bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-indigo-400">
              <TrendingUp size={18} />
              <h3 className="text-sm font-bold text-white">Evolución Semanal de Ventas</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Últimos 7 días</span>
          </div>

          <div className="h-72 w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="fecha" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                  formatter={(value: any) => [formatCurrency(value), "Ventas"]}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribución por Categorías (4/12 cols) */}
        <div className="lg:col-span-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Package size={18} />
              <h3 className="text-sm font-bold text-white">Ventas por Rubro</h3>
            </div>

            <div className="h-48 w-full flex items-center justify-center font-mono text-[10px]">
              {categoriaVentas.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Sin datos de facturación</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriaVentas}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoriaVentas.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                      formatter={(value: any) => [formatCurrency(value), "Facturado"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div className="space-y-2 pt-4 border-t border-slate-800/60">
            {categoriaVentas.map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-400 font-medium">{entry.name}</span>
                </div>
                <span className="font-bold text-white font-mono">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Motor de Predicciones & Movimientos de Caja */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MOTOR PREDICTIVO DE DEMANDA (7/12 cols) */}
        <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Sparkles size={18} className="text-indigo-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white">Módulo Predictivo de Abastecimiento</h3>
            </div>
            <span className="text-[10px] bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20 text-indigo-400 font-bold uppercase tracking-wider animate-pulse">
              IA & Estadística
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal mb-3">
            El motor matemático analiza la velocidad de venta histórica diaria de cada producto y proyecta los días de existencias restantes. Sugiere órdenes de reaprovisionamiento automáticas para evitar quiebres de stock.
          </p>

          <div className="space-y-3 overflow-y-auto max-h-72">
            {prediccionesStock.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-600 text-xs space-y-2">
                <Inbox size={28} className="opacity-40" />
                <p>No se registran productos con riesgo de desabastecimiento en 30 días.</p>
              </div>
            ) : (
              prediccionesStock.map((pred: any) => (
                <div
                  key={pred.productoId}
                  className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 max-w-[65%]">
                    <p className="font-semibold text-white truncate">{pred.nombre}</p>
                    <p className="text-[10px] text-slate-500">Proveedor: {pred.proveedor}</p>
                    <div className="flex items-center space-x-2.5 text-[9px] font-bold uppercase tracking-wider mt-1">
                      <span className="text-indigo-400">Venta Mensual: {pred.promedioVentaMensual} u.</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">Stock Actual: {pred.stockActual} u.</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                    <div className="text-right">
                      <p className={`font-bold font-mono ${pred.diasRestantes <= 7 ? "text-red-400" : "text-amber-400"}`}>
                        {pred.diasRestantes} días restantes
                      </p>
                      <p className="text-[9px] text-slate-500">Autonomía de Stock</p>
                    </div>

                    {pred.sugerenciaCompra > 0 && (
                      <div className="text-right mt-1 sm:mt-1.5 flex items-center space-x-1.5 justify-end">
                        <span className="bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/10 text-[9px] font-bold text-indigo-400 uppercase tracking-wide">
                          Pedir +{pred.sugerenciaCompra} u.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MOVIMIENTOS RECIENTES DE CAJA (5/12 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Activity size={18} />
              <h3 className="text-sm font-bold text-white">Transacciones Recientes</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Historial</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-72">
            {cajaMovimientosRecientes.length === 0 ? (
              <p className="text-center py-12 text-xs text-slate-600">No se registran movimientos en el sistema.</p>
            ) : (
              cajaMovimientosRecientes.map((mov: any) => {
                const isIncome = mov.tipo === "INGRESO";
                return (
                  <div
                    key={mov.id}
                    className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5 max-w-[70%]">
                      <div className={`p-1.5 rounded-lg ${
                        isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                      </div>
                      <div>
                        <p className="font-semibold text-white truncate max-w-[130px] sm:max-w-none">{mov.descripcion}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{mov.fecha}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold font-mono ${
                        isIncome ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {isIncome ? "+" : "-"}{formatCurrency(mov.monto)}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase">{mov.tipo}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
