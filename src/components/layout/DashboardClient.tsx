"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { formatMovimientoDescripcion } from "@/lib/movimiento-format";
import { getDashboardChartData } from "@/actions/informes";
import type { DashboardPeriod, DashboardChartType, DashboardData } from "@/actions/informes";
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
  Cell,
} from "recharts";
import {
  TrendingUp,
  Package,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Inbox,
  Loader2,
} from "lucide-react";
import { getCardsForRole, type DashboardMetrics } from "@/lib/dashboard-config";

/* ──────────────────────────────────────────────
   CONSTANTS
   ────────────────────────────────────────────── */

const PIE_COLORS = ["#d62828", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "diario", label: "Diario" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "ultimos3", label: "3 días" },
  { value: "ultimos5", label: "5 días" },
  { value: "ultimos7", label: "7 días" },
  { value: "ultimos15", label: "15 días" },
  { value: "ultimos35", label: "35 días" },
];

const CHART_TYPE_OPTIONS: { value: DashboardChartType; label: string }[] = [
  { value: "categorias", label: "Categorías" },
  { value: "productos", label: "Productos" },
  { value: "marcas", label: "Marcas" },
];

const STORAGE_KEY = "dashboard-filters";

type ChartPoint = { name: string; value: number };
type EvolutionPoint = { fecha: string; total: number };
type TooltipPayloadEntry = { name?: string; value: number };

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  formatter?: (value: number) => React.ReactNode;
};

type PieTooltipProps = {
  active?: boolean;
  payload?: ChartPoint[];
  chartType: DashboardChartType;
  total: number;
};

/* ──────────────────────────────────────────────
   CUSTOM TOOLTIP — guaranteed dark, no inheritance
   ────────────────────────────────────────────── */

function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#17191f",
        border: "1px solid #3a3f4c",
        borderRadius: "10px",
        padding: "12px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        minWidth: "140px",
      }}
    >
      {label && (
        <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px", fontWeight: 600 }}>{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
          <span style={{ color: "#ffffff", fontSize: "13px", fontWeight: 500 }}>{entry.name || "Ventas"}</span>
          <span style={{ color: "#d62828", fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}>
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload, chartType, total }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  const pct = total > 0 ? ((data.value / total) * 100).toFixed(0) : "0";
  return (
    <div
      style={{
        background: "#17191f",
        border: "1px solid #3a3f4c",
        borderRadius: "10px",
        padding: "12px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        minWidth: "150px",
      }}
    >
      <p style={{ color: "#ffffff", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>{data.name}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <span style={{ color: "#94a3b8", fontSize: "12px" }}>
          {chartType === "productos" ? "Unidades:" : "Ventas:"}
        </span>
        <span style={{ color: "#d62828", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>
          {chartType === "productos" ? `${data.value} uds.` : formatCurrency(data.value)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "2px" }}>
        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Participación:</span>
        <span style={{ color: "#ffffff", fontSize: "13px", fontWeight: 600 }}>{pct}%</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */

function getGreeting(userName: string): string {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 5 && hour < 12) greeting = "Buenos días";
  else if (hour >= 12 && hour < 20) greeting = "Buenas tardes";
  else greeting = "Buenas noches";
  return `${greeting}, ${userName}`;
}

function loadFilters(): { period: DashboardPeriod; chartType: DashboardChartType } {
  if (typeof window === "undefined") return { period: "ultimos7", chartType: "categorias" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        period: PERIOD_OPTIONS.some((o) => o.value === parsed.period) ? parsed.period : "ultimos7",
        chartType: CHART_TYPE_OPTIONS.some((o) => o.value === parsed.chartType) ? parsed.chartType : "categorias",
      };
    }
  } catch {}
  return { period: "ultimos7", chartType: "categorias" };
}

function saveFilters(period: DashboardPeriod, chartType: DashboardChartType) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, chartType }));
  } catch {}
}

function calcPiePercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(0)}%`;
}

/* ──────────────────────────────────────────────
   SUB-COMPONENTS
   ────────────────────────────────────────────── */

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
    <div
      className={`bg-[var(--card)] border border-[var(--border)] rounded-xl px-5 py-4 flex flex-col items-center text-center justify-center
        shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 hover:scale-[1.02]
        h-[150px] border-l-[5px] ${borderColor}`}
    >
      <div className={`p-3 rounded-full ${colorClass} mb-2.5`}>{icon}</div>
      <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider leading-tight">{title}</p>
      <p className={`text-2xl font-extrabold font-mono tracking-tight leading-tight mt-1.5 ${valueColor || "text-[var(--text)]"}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)] leading-tight mt-1">{sub}</p>
      {trend && (
        <div
          className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${
            trend.isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          <span>{trend.isPositive ? "↑" : "↓"}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}

function PeriodFilter({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (v: DashboardPeriod) => void;
}) {
  const general: { value: DashboardPeriod; label: string }[] = [
    { value: "diario", label: "Diario" },
    { value: "semanal", label: "Semanal" },
    { value: "mensual", label: "Mensual" },
  ];
  const ranges: { value: DashboardPeriod; label: string }[] = [
    { value: "ultimos3", label: "3 días" },
    { value: "ultimos5", label: "5 días" },
    { value: "ultimos7", label: "7 días" },
    { value: "ultimos15", label: "15 días" },
    { value: "ultimos35", label: "35 días" },
  ];

  const btnBase =
    "font-semibold rounded-lg transition-all duration-200 whitespace-nowrap px-4 py-2 text-[13px]";
  const active = `${btnBase} bg-[#d62828] text-white shadow-[0_0_12px_rgba(214,40,40,0.35)]`;
  const inactive = `${btnBase} text-[#94a3b8] hover:text-white hover:bg-[#2a2e38]`;

  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center bg-[#101114] border border-[#2a2e38] rounded-xl p-1 gap-1">
        {general.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)} className={value === opt.value ? active : inactive}>
            {opt.label}
          </button>
        ))}
        <div className="w-px h-5 bg-[#2a2e38] mx-0.5 shrink-0" />
        {ranges.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)} className={value === opt.value ? active : inactive}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartTypeFilter({
  options,
  value,
  onChange,
}: {
  options: { value: DashboardChartType; label: string }[];
  value: DashboardChartType;
  onChange: (v: DashboardChartType) => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center bg-[#101114] border border-[#2a2e38] rounded-xl p-1 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`font-semibold rounded-lg transition-all duration-200 whitespace-nowrap px-4 py-2 text-[13px]
              ${
                value === opt.value
                  ? "bg-[#d62828] text-white shadow-[0_0_12px_rgba(214,40,40,0.35)]"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#2a2e38]"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Loader2 size={28} className="animate-spin text-[var(--brand)]" />
      <span className="text-sm text-[var(--text-muted)]">Cargando datos...</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
      <Inbox size={36} className="text-[var(--text-secondary)] opacity-40" />
      <p className="text-sm text-[var(--text-secondary)] italic text-center">{message}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────
   PIE CHART LEGEND
   ────────────────────────────────────────────── */

function PieLegend({
  data,
  chartType,
  total,
}: {
  data: { name: string; value: number }[];
  chartType: DashboardChartType;
  total: number;
}) {
  return (
    <div className="space-y-2.5 pt-3 border-t border-[var(--border)]/60">
      {data.slice(0, 6).map((entry, index) => {
        const percent = calcPiePercent(entry.value, total);
        const displayValue =
          chartType === "productos" ? `${entry.value} uds.` : formatCurrency(entry.value);
        return (
          <div key={entry.name} className="flex items-center justify-between text-[13px] gap-3">
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="text-[var(--text-muted)] font-medium truncate" title={entry.name}>
                {entry.name}
              </span>
            </div>
            <span className="text-[var(--text-secondary)] shrink-0 text-[12px]">{percent}</span>
            <span className="font-bold text-[var(--text)] font-mono shrink-0 text-right min-w-[85px]">
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */

interface DashboardClientProps {
  data: DashboardData;
  userName: string;
  role: string;
  formattedDate: string;
  canAccessCaja: boolean;
}

export default function DashboardClient({ data, userName, role, formattedDate, canAccessCaja }: DashboardClientProps) {
  const { cajaMovimientosRecientes } = data;

  const greeting = getGreeting(userName);
  const statCards = getStatCards(data, role);

  // ── Filter state (initialized with SSR defaults to prevent hydration mismatch) ──
  const [{ period, chartType }, setFilters] = useState<{ period: DashboardPeriod; chartType: DashboardChartType }>({
    period: "ultimos7",
    chartType: "categorias",
  });
  const [isPending, startTransition] = useTransition();

  // ── Chart data (server-fetched) ──
  const [evolutionData, setEvolutionData] = useState<EvolutionPoint[]>(data.ventasGrafico);
  const [pieData, setPieData] = useState<ChartPoint[]>(data.categoriaVentas);

  // ── Fetch filtered data when filters change (after init) ──
  const fetchChartData = useCallback(
    (p: DashboardPeriod, ct: DashboardChartType) => {
      startTransition(async () => {
        try {
          const result = await getDashboardChartData(p, ct);
          setEvolutionData(result.evolutionData);
          setPieData(result.pieData);
        } catch (e) {
          console.error("Error fetching chart data:", e);
        }
      });
    },
    []
  );

  // Load saved filters on client mount without hydration mismatch
  const mountedRef = React.useRef(false);
  useEffect(() => {
    const saved = loadFilters();
    if (saved.period !== "ultimos7" || saved.chartType !== "categorias") {
      setFilters(saved);
    }
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    saveFilters(period, chartType);
    fetchChartData(period, chartType);
  }, [period, chartType, fetchChartData]);

  // ── Filter handlers ──
  const handlePeriodChange = (p: DashboardPeriod) => setFilters((current) => ({ ...current, period: p }));
  const handleChartTypeChange = (ct: DashboardChartType) => setFilters((current) => ({ ...current, chartType: ct }));

  // ── Chart titles ──
  const evolutionTitle =
    period === "diario"
      ? "Ventas de Hoy"
      : period === "semanal"
      ? "Ventas de la Semana"
      : period === "mensual"
      ? "Ventas del Mes"
      : `Ventas — Últimos ${period.replace("ultimos", "")} días`;

  const pieTitle =
    chartType === "categorias"
      ? "Ventas por Categoría"
      : chartType === "productos"
      ? "Productos Más Vendidos"
      : "Ventas por Marca";

  const pieTotal = pieData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-4" style={{ animation: "dashboard-fadeIn 0.3s ease-out" }}>
      {/* ═══ HEADER ═══ */}
      <div className="text-center py-1">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-[var(--text)] tracking-tight">
          {greeting}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1 capitalize">{formattedDate}</p>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* ═══ LEFT: Actividad Reciente ═══ */}
        <div className="lg:col-span-3 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden flex flex-col max-h-[560px]">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]/60 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-[var(--brand-light)]">
                <Activity size={16} className="text-[var(--brand)]" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text)]">Actividad Reciente</h3>
            </div>
            {canAccessCaja && (
              <Link href="/caja" className="text-xs text-[var(--brand)] hover:underline font-semibold">
                Ver historial
              </Link>
            )}
          </div>

          <div className="divide-y divide-[var(--border)]/60 overflow-y-auto flex-1 min-h-0">
            {cajaMovimientosRecientes.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-[var(--text-secondary)] space-y-2">
                <Inbox size={28} className="opacity-40" />
                <p className="text-sm">Sin movimientos</p>
              </div>
            ) : (
              cajaMovimientosRecientes.slice(0, 10).map((mov) => {
                const isIncome = mov.tipo === "INGRESO";
                return (
                  <div
                    key={mov.id}
                    className="px-4 py-3.5 flex items-center justify-between hover:bg-[var(--bg)] transition-colors duration-150"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isIncome ? "bg-[var(--success-light)]" : "bg-[var(--danger-light)]"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight size={14} className="text-[var(--success)]" />
                        ) : (
                          <ArrowDownLeft size={14} className="text-[var(--danger)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--text)] truncate" title={formatMovimientoDescripcion(mov.descripcion)}>
                          {formatMovimientoDescripcion(mov.descripcion)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-[var(--text-muted)]">{mov.fecha}</p>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              isIncome
                                ? "bg-[var(--success-light)] text-[var(--success)]"
                                : "bg-[var(--danger-light)] text-[var(--danger)]"
                            }`}
                          >
                            {mov.tipo}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p
                        className={`text-sm font-bold font-mono ${
                          isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatCurrency(mov.monto)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Stats + Charts ═══ */}
        <div className="lg:col-span-9 flex flex-col gap-4">

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* ── EVOLUTION CHART (8 cols) ── */}
            <div className="lg:col-span-8 bg-[var(--card)] border border-[var(--border)] p-5 rounded-xl shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-[var(--brand-light)]">
                    <TrendingUp size={16} className="text-[var(--brand)]" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text)]">{evolutionTitle}</h3>
                </div>
                <PeriodFilter value={period} onChange={handlePeriodChange} />
              </div>

              <div className="h-80 w-full font-mono text-xs">
                {isPending ? (
                  <ChartSkeleton />
                ) : evolutionData.length === 0 || evolutionData.every((d) => d.total === 0) ? (
                  <EmptyState message="No hay ventas registradas para este período" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d62828" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#d62828" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2e38" vertical={false} />
                      <XAxis
                        dataKey="fecha"
                        stroke="#64748b"
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                        interval="preserveStartEnd"
                        minTickGap={35}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                        tickFormatter={(v: number) =>
                          v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
                        }
                        width={60}
                      />
                      <Tooltip
                        content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#d62828"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                        dot={{ r: 3.5, fill: "#d62828", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#d62828", stroke: "#1e2129", strokeWidth: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── PIE CHART (4 cols) ── */}
            <div className="lg:col-span-4 bg-[var(--card)] border border-[var(--border)] p-5 rounded-xl shadow-[var(--shadow-sm)] flex flex-col">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center justify-center space-x-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-[var(--brand-light)]">
                    <Package size={16} className="text-[var(--brand)]" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text)]">{pieTitle}</h3>
                </div>
                <ChartTypeFilter options={CHART_TYPE_OPTIONS} value={chartType} onChange={handleChartTypeChange} />
              </div>

              {/* Chart area */}
              <div className="flex-1 flex items-center justify-center min-h-[170px]">
                {isPending ? (
                  <ChartSkeleton />
                ) : pieData.length === 0 ? (
                  <EmptyState message="Sin datos para este período" />
                ) : (
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<PieTooltip chartType={chartType} total={pieTotal} />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              <PieLegend data={pieData} chartType={chartType} total={pieTotal} />

              {/* Total */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border)]/60">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total</span>
                <span className="text-sm font-bold text-[var(--text)] font-mono">
                  {chartType === "productos"
                    ? `${pieTotal} uds.`
                    : formatCurrency(pieTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ──────────────────────────────────────────────
   STAT CARDS BUILDER
   ────────────────────────────────────────────── */

function getStatCards(data: DashboardData, role: string) {
  const { stats } = data;

  const metrics: DashboardMetrics = {
    ventasHoy: stats.ventasHoy,
    ingresosCaja: stats.ingresosCaja,
    stockBajoCount: stats.stockBajoCount,
    totalClientes: stats.totalClientes,
    productosMasVendidosCount: data.productosMasVendidos?.length || 0,
    ventasHoyCount: stats.ventasHoyCount,
    productosSinStock: stats.productosSinStock,
    productosActivosCount: stats.productosActivosCount,
    movimientosInventarioHoy: stats.movimientosInventarioHoy,
    comprasHoy: stats.comprasHoy,
    clientesAtendidosHoy: stats.clientesAtendidosHoy,
    proveedoresActivos: stats.proveedoresActivos,
  };

  const cards = getCardsForRole(role);

  return cards.map((card) => ({
    title: card.title,
    value: card.getValue(metrics),
    sub: card.sub,
    icon: card.icon,
    colorClass: card.colorClass,
    borderColor: card.borderColor,
    valueColor: card.valueColor,
    trend: card.trend?.(metrics),
  }));
}
