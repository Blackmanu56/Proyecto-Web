"use client";

import React, { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { labelMetodoPago } from "@/lib/metodosPago";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RePie,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { Users, Package } from "lucide-react";
import {
  ReportPrintHeader,
  DIAS_SEMANA,
  type AnalisisCache,
  type ChartGranularity,
} from "./ventasShared";
interface AnalisisViewProps {
  cache: AnalisisCache | null;
  loading: boolean; // skeleton en la primera activación
  fechaDesde: string;
  fechaHasta: string;
  chartGranularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
  printSection: string | null;
  setPrintSection: (s: string | null) => void;
}

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + "…" : s);

const renderYAxisCategoryTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={-6}
      y={0}
      dy={3}
      textAnchor="end"
      fill="var(--text-secondary)"
      fontSize={10}
      className="select-none"
    >
      {payload.value}
    </text>
  </g>
);

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  dia: "Diario",
  semana: "Semanal",
  mes: "Mensual",
  anio: "Anual",
};

export default function AnalisisView({
  cache,
  loading,
  fechaDesde,
  fechaHasta,
  chartGranularity,
  onGranularityChange,
  printSection,
  setPrintSection,
}: AnalisisViewProps) {
  // Estado de UI local únicamente
  const [topProductsMetric, setTopProductsMetric] = useState<"unidades" | "facturacion">("unidades");

  /* ── Tooltips ── */
  const EvolutionTooltip = ({ active, payload, granularity }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    const ventas = payload.find((p: any) => p.dataKey === "ventas")?.value || 0;

    let fechaCompleta = "";
    if (data?.fechaInicio) {
      const inicio = new Date(data.fechaInicio);
      const fin = data.fechaFin ? new Date(data.fechaFin) : null;
      if (granularity === "anio") {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { year: "numeric" });
      } else if (granularity === "mes") {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      } else if (granularity === "semana" && fin && inicio.getTime() !== fin.getTime()) {
        const optsShort: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
        const optsFull: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
        fechaCompleta = `${inicio.toLocaleDateString("es-AR", optsShort)} al ${fin.toLocaleDateString("es-AR", optsFull)}`;
      } else {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
      }
    }

    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs" style={{ minWidth: 200 }}>
        <div className="font-bold text-[var(--text)] mb-2 pb-1 border-b border-[var(--border)]">{fechaCompleta}</div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--brand)]" /> Ventas
          </span>
          <span className="font-semibold text-[var(--text)]">{formatCurrency(ventas)}</span>
        </div>
      </div>
    );
  };

  const MetodoPagoTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const totalGlobal = metodoPagoData.reduce((s, x) => s + x.value, 0);
    const pct = totalGlobal > 0 ? ((d.value / totalGlobal) * 100).toFixed(1) : "0";
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs" style={{ minWidth: 160 }}>
        <div className="font-bold text-[var(--text)] mb-1">{labelMetodoPago(d.name)}</div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-[var(--text)]">{formatCurrency(d.value)}</span>
          <span className="text-[var(--text-muted)]">{pct}%</span>
        </div>
      </div>
    );
  };

  const DiaSemanaTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs" style={{ minWidth: 160 }}>
        <div className="font-bold text-[var(--text)] mb-1">{d.name}</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">Ventas</span>
            <span className="font-semibold text-[var(--text)]">{d.payload.ventas}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">Total</span>
            <span className="font-semibold text-[var(--text)]">{formatCurrency(d.payload.total)}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── Derivados de datos ── */
  const resumen = cache?.resumen;
  const categoriaData = useMemo(() => {
    if (!cache) return [];
    return [...cache.categoria].sort((a, b) => b.subtotal - a.subtotal);
  }, [cache]);

  const categoriaPieData = useMemo(
    () => categoriaData.map((c) => ({ name: c.categoria, value: c.subtotal })),
    [categoriaData]
  );

  const categoriaBarData = useMemo(
    () =>
      categoriaData.slice(0, 12).map((c) => ({
        name: truncate(c.categoria, 20),
        subtotal: c.subtotal,
      })),
    [categoriaData]
  );

  const metodoPagoData = useMemo(
    () => (cache ? cache.metodoPago.map((m) => ({ name: m.metodo, value: m.total, cantidad: m.cantidadVentas })) : []),
    [cache]
  );

  const topProductos = useMemo(
    () =>
      cache
        ? cache.topProductos
            .slice()
            .sort((a, b) =>
              topProductsMetric === "unidades" ? b.cantidad - a.cantidad : b.ingreso - a.ingreso
            )
            .slice(0, 5)
        : [],
    [cache, topProductsMetric]
  );

  const maxProdValue = useMemo(
    () =>
      Math.max(
        ...topProductos.map((p) =>
          topProductsMetric === "unidades" ? p.cantidad : p.ingreso
        ),
        1
      ),
    [topProductos, topProductsMetric]
  );

  const diaSemanaData = useMemo(() => {
    if (!cache) return [];
    const map = new Map(cache.diaSemana.map((d) => [d.dow, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const row = map.get(i);
      return { dow: i, name: DIAS_SEMANA[i], ventas: row?.ventas ?? 0, total: row?.total ?? 0 };
    });
  }, [cache]);

  const topClientes = useMemo(() => (cache ? cache.topClientes.slice(0, 5) : []), [cache]);
  const maxClienteTotal = useMemo(() => Math.max(...topClientes.map((c) => c.total), 1), [topClientes]);

  const topVendedores = useMemo(() => (cache ? cache.vendedores.slice(0, 5) : []), [cache]);
  const maxVendedorTotal = useMemo(() => Math.max(...topVendedores.map((s) => s.totalVendido), 1), [topVendedores]);

  const granularityButtons = (
    <div className="flex flex-wrap items-center gap-1">
      {(["dia", "semana", "mes", "anio"] as ChartGranularity[]).map((g) => (
        <button
          key={g}
          onClick={() => onGranularityChange(g)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
            chartGranularity === g
              ? "bg-[var(--brand)] text-white"
              : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
          }`}
        >
          {GRANULARITY_LABELS[g]}
        </button>
      ))}
    </div>
  );

  const pieLegend = (
    data: { name: string; value: number }[],
    total: number,
    labelFn: (name: string) => string = (n) => n
  ) => (
    <div className="w-1/2 space-y-2">
      {data.map((entry, i) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
        return (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-xs text-[var(--text-muted)] truncate">{labelFn(entry.name)}</span>
            <span className="text-xs font-semibold text-[var(--text)] ml-auto">{pct}%</span>
          </div>
        );
      })}
    </div>
  );

  if (loading && !cache) {
    return (
      <div className="space-y-4" data-section-id="analisis">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
              <div className="h-10 w-10 rounded-full bg-[var(--card)] mb-3" />
              <div className="h-4 bg-[var(--card)] rounded w-1/2 mb-2" />
              <div className="h-6 bg-[var(--card)] rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
          <div className="h-4 bg-[var(--card)] rounded w-1/3 mb-4" />
          <div className="h-64 bg-[var(--card)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <section
      className="report-section space-y-5"
      data-section-id="analisis"
      data-print-active={printSection === "analisis" || null}
    >
      <ReportPrintHeader desde={fechaDesde} hasta={fechaHasta} />

      {/* Resumen compacto (mismo estilo que la barra de Detalle) */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Resumen</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Ventas Totales</div>
            <div className="text-sm font-bold text-[var(--success)]">{formatCurrency(resumen?.total ?? 0)}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Cantidad de Ventas</div>
            <div className="text-sm font-bold text-[var(--text)]">{resumen?.cantidad ?? 0}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Productos Vendidos</div>
            <div className="text-sm font-bold text-[var(--text)]">{resumen?.productosVendidos ?? 0}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Atendidos</div>
            <div className="text-sm font-bold text-[var(--text)]">{resumen?.clientesAtendidos ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Evolución */}
      <ChartWrapper
        title="Evolución de Ventas"
        height={320}
        action={granularityButtons}
      >
        {cache && cache.evolucion.length > 0 ? (
          <AreaChart data={cache.evolucion} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="periodo" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
            <Tooltip
              content={<EvolutionTooltip granularity={chartGranularity} />}
              cursor={{ stroke: "var(--text-muted)", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="ventas"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--brand)" }}
              activeDot={{ r: 5 }}
              fill="url(#brandGradient)"
              name="Ventas"
            />
          </AreaChart>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            Sin datos para el período seleccionado
          </div>
        )}
      </ChartWrapper>

      {/* Categoría | Medio de Pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWrapper title="Ventas por Categoría" height={260}>
          {categoriaPieData.length > 0 ? (
            categoriaPieData.length <= 8 ? (
              <div className="flex items-center gap-4 h-full">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePie>
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          const total = categoriaPieData.reduce((s, d) => s + d.value, 0);
                          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                          return [`${formatCurrency(value)} (${pct}%)`, name];
                        }}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        itemStyle={{ color: "var(--text)" }}
                      />
                      <Pie
                        data={categoriaPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                      >
                        {categoriaPieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </RePie>
                  </ResponsiveContainer>
                </div>
                {pieLegend(categoriaPieData, categoriaPieData.reduce((s, d) => s + d.value, 0))}
              </div>
            ) : (
              <BarChart data={categoriaBarData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--text-secondary)"
                  width={145}
                  tick={renderYAxisCategoryTick}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Subtotal"]}
                  cursor={{ fill: "var(--border)", fillOpacity: 0.3 }}
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                  itemStyle={{ color: "var(--text)" }}
                />
                <Bar dataKey="subtotal" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Subtotal" />
              </BarChart>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
              Sin datos de categorías
            </div>
          )}
        </ChartWrapper>

        <ChartWrapper title="Ventas por Medio de Pago" height={260}>
          {metodoPagoData.length > 0 ? (
            <div className="flex items-center gap-4 h-full">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePie>
                    <Tooltip content={<MetodoPagoTooltip />} />
                    <Pie
                      data={metodoPagoData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                    >
                      {metodoPagoData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </RePie>
                </ResponsiveContainer>
              </div>
              {pieLegend(metodoPagoData, metodoPagoData.reduce((s, d) => s + d.value, 0))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
              Sin datos de métodos de pago
            </div>
          )}
        </ChartWrapper>
      </div>

      {/* Top Productos | Día de la Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                <Package size={14} className="text-[var(--brand)]" />
                Top Productos
              </h3>
              <div className="flex items-center gap-1">
                {(["unidades", "facturacion"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTopProductsMetric(m)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      topProductsMetric === m
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                    }`}
                  >
                    {m === "unidades" ? "Unidades" : "Facturación"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {topProductos.length > 0 ? (
                topProductos.map((p, i) => {
                  const val = topProductsMetric === "unidades" ? p.cantidad : p.ingreso;
                  const pct = maxProdValue > 0 ? (val / maxProdValue) * 100 : 0;
                  return (
                    <div
                      key={p.productoId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
                    >
                      <span className="text-sm font-bold shrink-0 w-8 text-center text-[var(--text-muted)]">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text)] truncate" title={p.producto}>
                            {p.producto}
                          </p>
                          <span className="text-xs font-bold text-[var(--brand)] shrink-0">
                            {topProductsMetric === "unidades" ? `${p.cantidad} u.` : formatCurrency(p.ingreso)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                          <span>{p.categoria || "Sin categoría"}</span>
                          <span>·</span>
                          <span>{topProductsMetric === "unidades" ? formatCurrency(p.ingreso) : `${p.cantidad} unidades`}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-48 text-[var(--text-secondary)] text-sm">
                  Sin datos de productos
                </div>
              )}
            </div>
          </div>
        </div>

        <ChartWrapper title="Ventas por Día de la Semana" height={365}>
          {cache && cache.diaSemana.some((d) => d.ventas > 0) ? (
            <BarChart data={diaSemanaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} interval={0} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
              <Tooltip
                content={<DiaSemanaTooltip />}
                cursor={{ fill: "var(--border)", fillOpacity: 0.3 }}
              />
              <Bar dataKey="total" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Monto facturado" />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
              Sin datos para el período seleccionado
            </div>
          )}
        </ChartWrapper>
      </div>

      {/* Top Clientes | Top Vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
              <Users size={14} className="text-[var(--info)]" />
              Top Clientes
            </h3>

            <div className="space-y-2">
              {topClientes.length > 0 ? (
                topClientes.map((c, i) => {
                  const pct = maxClienteTotal > 0 ? (c.total / maxClienteTotal) * 100 : 0;
                  return (
                    <div
                      key={c.clienteId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
                    >
                      <span className="text-sm font-bold shrink-0 w-8 text-center text-[var(--text-muted)]">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text)] truncate" title={c.cliente}>
                            {c.cliente}
                          </p>
                          <span className="text-xs font-bold text-[var(--success)] shrink-0">
                            {formatCurrency(c.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                          <span>{c.cantidad} {c.cantidad === 1 ? "compra" : "compras"}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[var(--info)] transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-48 text-[var(--text-secondary)] text-sm">
                  Sin datos de clientes
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
            <Users size={14} className="text-[var(--info)]" />
            Top Vendedores
          </h3>
          <div className="space-y-2">
            {topVendedores.length > 0 ? (
              topVendedores.map((s, i) => {
                const pct = maxVendedorTotal > 0 ? (s.totalVendido / maxVendedorTotal) * 100 : 0;
                return (
                  <div
                    key={s.usuarioId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <span className="text-sm font-bold shrink-0 w-8 text-center text-[var(--text-muted)]">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text)] truncate" title={s.vendedor}>
                          {s.vendedor}
                        </p>
                        <span className="text-xs font-bold text-[var(--success)] shrink-0">
                          {formatCurrency(s.totalVendido)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                        <span>{s.cantidadVentas} {s.cantidadVentas === 1 ? "venta" : "ventas"}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--info)] transition-all duration-300"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-48 text-[var(--text-secondary)] text-sm">
                Sin datos de vendedores
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
