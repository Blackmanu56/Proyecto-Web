"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ClientesDashboard } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Filter, Printer, Search, ShoppingBag, Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePie,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const selectTriggerClass =
  "bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const printButtonClass =
  "p-1.5 rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-emerald-400 hover:bg-[var(--border)] transition print:hidden";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    fontSize: 12,
    padding: "10px 14px",
  },
  itemStyle: { color: "var(--text)" },
  labelStyle: { color: "var(--text-muted)" },
};

type SubViewId = "analisis" | "detalle" | "sin_comprar";

type SortKey = "nombre" | "estado" | "compras" | "total" | "ultima";
type SortDir = "asc" | "desc";

// Nombres cortos de meses en español para los selectores de año
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Nombres completos de meses en español para los tooltips
const MESES_COMPLETOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Dirección por defecto al hacer clic por primera vez en cada columna
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  nombre: "asc",
  estado: "asc",
  compras: "desc",
  total: "desc",
  ultima: "desc",
};


// Tooltip simple
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length || payload[0].value === 0) return null;
  const displayLabel = payload[0]?.payload?.mesCompleto || payload[0]?.payload?.rango || label;
  return (
    <div style={tooltipStyle.contentStyle}>
      {displayLabel && <p style={{ ...tooltipStyle.labelStyle, marginBottom: 2 }}>{displayLabel}</p>}
      <p style={tooltipStyle.itemStyle}>
        {payload[0].name || payload[0].dataKey}: <strong>{payload[0].value}</strong>
      </p>
    </div>
  );
}

// Tooltip para Nuevos vs Recurrentes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NuevosVsRecurrentesTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  const total = (p?.nuevos ?? 0) + (p?.recurrentes ?? 0);
  if (total === 0) return null;
  return (
    <div style={tooltipStyle.contentStyle}>
      {p?.mesCompleto && <p style={{ ...tooltipStyle.labelStyle, marginBottom: 4, fontWeight: "bold" }}>{p.mesCompleto}</p>}
      <p style={{ ...tooltipStyle.itemStyle, color: CHART_COLORS[0], marginBottom: 2 }}>
        Nuevos (1ª compra): <strong>{p?.nuevos ?? 0}</strong>
      </p>
      <p style={{ ...tooltipStyle.itemStyle, color: CHART_COLORS[2] }}>
        Recurrentes: <strong>{p?.recurrentes ?? 0}</strong>
      </p>
    </div>
  );
}

interface Props {
  initialData: ClientesDashboard;
  userRole?: string;
}

export default function ClientesReport({ initialData }: Props) {
  // Sub-módulos: Análisis | Detalle de clientes | Clientes sin compras recientes
  const [activeSubView, setActiveSubView] = useState<SubViewId>("analisis");

  const [data] = useState<ClientesDashboard>(initialData);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");
  const [filtroActividad, setFiltroActividad] = useState<"todos" | "con_compras" | "sin_compras">("todos");
  const [pageDetalle, setPageDetalle] = useState(1);
  const [pageSizeDetalle, setPageSizeDetalle] = useState(20);

  // Submódulo Clientes sin compras recientes
  const [modoSinCompras, setModoSinCompras] = useState<"recientes" | "nunca">("recientes");
  const [diasSinComprar, setDiasSinComprar] = useState<number>(90);
  const [pageSinCompras, setPageSinCompras] = useState(1);
  const [pageSizeSinCompras, setPageSizeSinCompras] = useState(20);

  const [printSection, setPrintSection] = useState<string | null>(null);
  useEffect(() => {
    if (printSection) {
      const t = setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [printSection]);

  // Selector de año para "Clientes Nuevos por Mes" (altas registradas)
  const [anioNuevos, setAnioNuevos] = useState<number>(() => new Date().getFullYear());
  const aniosDisponibles = useMemo(() => {
    const years = new Set(data.nuevosPorMes.map((i) => i.mes.slice(0, 4)));
    if (years.size === 0) years.add(String(new Date().getFullYear()));
    return Array.from(years)
      .map(Number)
      .sort((a, b) => b - a);
  }, [data]);

  const nuevosPorMesAnio = useMemo(() => {
    const porMes = new Map(data.nuevosPorMes.map((i) => [i.mes, i.cantidad] as const));
    return MESES_CORTOS.map((label, i) => {
      const key = `${anioNuevos}-${String(i + 1).padStart(2, "0")}`;
      return { label, mesCompleto: MESES_COMPLETOS[i], cantidad: porMes.get(key) ?? 0 };
    });
  }, [data, anioNuevos]);

  // Selector de año para "Clientes Nuevos vs Recurrentes" (actividad comercial)
  const [anioNuevosVsRecurrentes, setAnioNuevosVsRecurrentes] = useState<number>(() => new Date().getFullYear());
  const aniosNuevosVsRecurrentesDisponibles = useMemo(() => {
    const years = new Set(data.nuevosVsRecurrentes.map((i) => i.mes.slice(0, 4)));
    if (years.size === 0) years.add(String(new Date().getFullYear()));
    return Array.from(years)
      .map(Number)
      .sort((a, b) => b - a);
  }, [data]);

  const nuevosVsRecurrentesAnio = useMemo(() => {
    const porMes = new Map(data.nuevosVsRecurrentes.map((i) => [i.mes, i] as const));
    return MESES_CORTOS.map((label, i) => {
      const key = `${anioNuevosVsRecurrentes}-${String(i + 1).padStart(2, "0")}`;
      const item = porMes.get(key);
      return {
        label,
        mesCompleto: MESES_COMPLETOS[i],
        nuevos: item?.nuevos ?? 0,
        recurrentes: item?.recurrentes ?? 0,
      };
    });
  }, [data, anioNuevosVsRecurrentes]);

  // ── Filtros combinados de la tabla de detalle (Búsqueda + Estado + Actividad Comercial) ──
  const filteredClientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.clientesCompleto.filter((c) => {
      // 1. Buscador por nombre o DNI
      if (q && !c.nombre.toLowerCase().includes(q) && !c.dni.toLowerCase().includes(q)) {
        return false;
      }
      // 2. Filtro administrativo: Activos / Inactivos
      if (filtroEstado === "activos" && !c.activo) return false;
      if (filtroEstado === "inactivos" && c.activo) return false;

      // 3. Filtro actividad comercial: Con compras / Sin compras
      if (filtroActividad === "con_compras" && c.cantidadCompras === 0) return false;
      if (filtroActividad === "sin_compras" && c.cantidadCompras > 0) return false;

      return true;
    });
  }, [data.clientesCompleto, search, filtroEstado, filtroActividad]);

  // Ordenamiento client-side de la tabla completa
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  };

  const sortedClientes = useMemo(() => {
    if (!sortKey) return filteredClientes;
    return [...filteredClientes].sort((a, b) => {
      if (sortKey === "nombre") {
        const cmp = a.nombre.localeCompare(b.nombre);
        return sortDir === "desc" ? -cmp : cmp;
      }
      if (sortKey === "ultima") {
        // Clientes sin compras (null) siempre al final, en ambas direcciones
        if (!a.ultimaCompraIso && !b.ultimaCompraIso) return 0;
        if (!a.ultimaCompraIso) return 1;
        if (!b.ultimaCompraIso) return -1;
        return sortDir === "desc"
          ? b.ultimaCompraIso.localeCompare(a.ultimaCompraIso)
          : a.ultimaCompraIso.localeCompare(b.ultimaCompraIso);
      }
      let cmp = 0;
      switch (sortKey) {
        case "estado":
          cmp = (a.activo ? 0 : 1) - (b.activo ? 0 : 1);
          break;
        case "compras":
          cmp = a.cantidadCompras - b.cantidadCompras;
          break;
        case "total":
          cmp = a.totalGastado - b.totalGastado;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredClientes, sortKey, sortDir]);

  // Paginación Detalle
  const totalPagesDetalle = Math.max(1, Math.ceil(sortedClientes.length / pageSizeDetalle));
  const currentPageDetalle = Math.min(pageDetalle, totalPagesDetalle);
  const paginatedClientes = useMemo(() => {
    const start = (currentPageDetalle - 1) * pageSizeDetalle;
    return sortedClientes.slice(start, start + pageSizeDetalle);
  }, [sortedClientes, currentPageDetalle, pageSizeDetalle]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="text-[var(--text-muted)] opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[var(--brand)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--brand)]" />
    );
  };

  const maxTop = useMemo(
    () => data.top10.reduce((m, c) => Math.max(m, c.total), 0),
    [data]
  );

  // ── Clientes sin compras recientes y que nunca compraron ──
  const clientesSinComprasRecientes = useMemo(() => {
    const ahoraMs = Date.now();
    return data.clientesCompleto
      .filter((c) => {
        if (c.cantidadCompras === 0 || !c.ultimaCompraIso) return false;
        const dias = Math.floor((ahoraMs - new Date(c.ultimaCompraIso).getTime()) / 86400000);
        return dias >= diasSinComprar;
      })
      .map((c) => ({
        ...c,
        dias: Math.floor((ahoraMs - new Date(c.ultimaCompraIso!).getTime()) / 86400000),
      }))
      .sort((a, b) => b.dias - a.dias);
  }, [data.clientesCompleto, diasSinComprar]);

  const clientesNuncaCompraron = useMemo(() => {
    return data.clientesCompleto
      .filter((c) => c.cantidadCompras === 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [data.clientesCompleto]);

  const totalPagesRecientes = Math.max(1, Math.ceil(clientesSinComprasRecientes.length / pageSizeSinCompras));
  const currentPageRecientes = Math.min(pageSinCompras, totalPagesRecientes);
  const paginatedRecientes = useMemo(() => {
    const start = (currentPageRecientes - 1) * pageSizeSinCompras;
    return clientesSinComprasRecientes.slice(start, start + pageSizeSinCompras);
  }, [clientesSinComprasRecientes, currentPageRecientes, pageSizeSinCompras]);

  const totalPagesNunca = Math.max(1, Math.ceil(clientesNuncaCompraron.length / pageSizeSinCompras));
  const currentPageNunca = Math.min(pageSinCompras, totalPagesNunca);
  const paginatedNunca = useMemo(() => {
    const start = (currentPageNunca - 1) * pageSizeSinCompras;
    return clientesNuncaCompraron.slice(start, start + pageSizeSinCompras);
  }, [clientesNuncaCompraron, currentPageNunca, pageSizeSinCompras]);

  const totalPagesSinCompras = modoSinCompras === "recientes" ? totalPagesRecientes : totalPagesNunca;
  const currentPageSinCompras = modoSinCompras === "recientes" ? currentPageRecientes : currentPageNunca;
  const totalItemsSinCompras = modoSinCompras === "recientes" ? clientesSinComprasRecientes.length : clientesNuncaCompraron.length;

  const printActive = (id: string) => (printSection === id) || null;

  return (
    <div className="space-y-4">
      {/* Selector de sub-vista */}
      <div className="print:hidden flex flex-wrap gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-1">
        {(["analisis", "detalle", "sin_comprar"] as SubViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => setActiveSubView(v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubView === v
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            {v === "analisis"
              ? "Análisis"
              : v === "detalle"
              ? "Detalle de clientes"
              : "Clientes sin compras recientes"}
          </button>
        ))}
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">
            Informe de Clientes —{" "}
            {activeSubView === "analisis"
              ? "Análisis"
              : activeSubView === "detalle"
              ? "Detalle de Clientes"
              : "Clientes sin compras recientes"}
          </p>
          <p className="text-xs text-gray-500">Generado: {formatDate(new Date())}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* ── 1. SUBMÓDULO ANÁLISIS ── */}
        {activeSubView === "analisis" && (
          <>
            {/* Resumen KPI */}
            <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total de Clientes</div>
                  <div className="text-sm font-bold text-[var(--text)]">{data.resumen.total}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Activos</div>
                  <div className="text-sm font-bold text-[var(--text)]">{data.resumen.activos}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Inactivos</div>
                  <div className="text-sm font-bold text-[var(--text)]">{data.resumen.inactivos}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Nuevos</div>
                  <div className="text-sm font-bold text-[var(--text)]">{data.resumen.nuevos30d}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">últimos 30 días</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes con compras</div>
                  <div className="text-sm font-bold text-[var(--brand)]">{data.resumen.conCompras}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">
                    {data.resumen.total > 0
                      ? `${Math.round((data.resumen.conCompras / data.resumen.total) * 100)}% del total`
                      : "0% del total"}
                  </div>
                </div>
              </div>
            </div>

            {/* Fila 1 de gráficos: Dinámica de Clientes (3 columnas) */}
            <div className="report-section" data-section-id="charts" data-print-active={printActive("charts")}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartWrapper title="Clientes Activos vs Inactivos" height={260}>
                  <RePie>
                    <Pie data={data.activosInactivos} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} label>
                      {data.activosInactivos.map((e, i) => (
                        <Cell key={i} fill={e.name === "Activos" ? CHART_COLORS[0] : CHART_COLORS[5]} />
                      ))}
                    </Pie>
                    <Tooltip content={ChartTooltip} />
                  </RePie>
                </ChartWrapper>

                <ChartWrapper
                  title="Clientes Nuevos por Mes"
                  height={260}
                  action={
                    <Select value={String(anioNuevos)} onValueChange={(v) => setAnioNuevos(Number(v))}>
                      <SelectTrigger className="h-7 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aniosDisponibles.map((a) => (
                          <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                >
                  <BarChart data={nuevosPorMesAnio}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Bar dataKey="cantidad" name="Clientes registrados" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Tooltip content={ChartTooltip} cursor={false} />
                  </BarChart>
                </ChartWrapper>

                <ChartWrapper
                  title="Clientes Nuevos vs. Recurrentes"
                  height={260}
                  action={
                    <Select value={String(anioNuevosVsRecurrentes)} onValueChange={(v) => setAnioNuevosVsRecurrentes(Number(v))}>
                      <SelectTrigger className="h-7 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aniosNuevosVsRecurrentesDisponibles.map((a) => (
                          <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                >
                  <BarChart data={nuevosVsRecurrentesAnio}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Bar dataKey="nuevos" name="Nuevos" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recurrentes" name="Recurrentes" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    <Tooltip content={NuevosVsRecurrentesTooltip} cursor={false} />
                  </BarChart>
                </ChartWrapper>
              </div>
            </div>

            {/* Fila 2 de gráficos: Distribuciones de Gasto y Compras (2 columnas amplias) */}
            <div className="report-section" data-section-id="distribuciones" data-print-active={printActive("distribuciones")}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartWrapper title="Distribución por Nivel de Gasto" height={260}>
                  <BarChart data={data.distribucionGasto} margin={{ left: 10, right: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="rango"
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Bar dataKey="clientes" name="Clientes" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    <Tooltip content={ChartTooltip} cursor={false} />
                  </BarChart>
                </ChartWrapper>

                <ChartWrapper title="Distribución por Cantidad de Compras" height={260}>
                  <BarChart data={data.distribucionCompras} margin={{ left: 10, right: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="rango"
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Bar dataKey="clientes" name="Clientes" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    <Tooltip content={ChartTooltip} cursor={false} />
                  </BarChart>
                </ChartWrapper>
              </div>
            </div>

            {/* Fila 3: Top 10 Clientes */}
            <div className="report-section" data-section-id="rankings" data-print-active={printActive("rankings")}>
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={sectionHeaderClass}>Top 10 Clientes con Mayor Facturación</h3>
                  <span className="text-xs text-[var(--text-muted)] font-semibold">
                    {data.top10.length} cliente{data.top10.length === 1 ? "" : "s"}
                  </span>
                </div>
                {data.top10.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-6">Sin datos de compras registradas.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {data.top10.map((c, i) => (
                      <div key={c.clienteId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-semibold text-[var(--text)] truncate">{i + 1}. {c.nombre}</span>
                          <span className="font-bold text-[var(--text)] ml-2 shrink-0">{formatCurrency(c.total)}</span>
                        </div>
                        <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--brand)] rounded-full"
                            style={{ width: `${maxTop ? (c.total / maxTop) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 2. SUBMÓDULO DETALLE DE CLIENTES ── */}
        {activeSubView === "detalle" && (
          <div className="report-section" data-section-id="clientes" data-print-active={printActive("clientes")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={sectionHeaderClass}>Detalle de Clientes</h3>
              <button onClick={() => setPrintSection("clientes")} className={printButtonClass} title="Imprimir esta sección">
                <Printer size={12} />
              </button>
            </div>
            <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
              {/* Barra de filtros conjuntos: Buscador + Estado + Actividad Comercial + Contador */}
              <div className="print:hidden p-4 border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)]/40 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Buscador */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Buscar cliente</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPageDetalle(1);
                        }}
                        placeholder="Buscar por nombre o DNI..."
                        className={inputClass + " pl-9"}
                      />
                    </div>
                  </div>

                  {/* Filtro Estado Administrativo */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Estado</label>
                    <Select
                      value={filtroEstado}
                      onValueChange={(v) => {
                        setFiltroEstado(v as typeof filtroEstado);
                        setPageDetalle(1);
                      }}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los estados</SelectItem>
                        <SelectItem value="activos">Activos</SelectItem>
                        <SelectItem value="inactivos">Inactivos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro Actividad Comercial */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Actividad Comercial</label>
                    <Select
                      value={filtroActividad}
                      onValueChange={(v) => {
                        setFiltroActividad(v as typeof filtroActividad);
                        setPageDetalle(1);
                      }}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos (con y sin compras)</SelectItem>
                        <SelectItem value="con_compras">Con compras realizadas</SelectItem>
                        <SelectItem value="sin_compras">Sin compras registradas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Indicador de clientes encontrados */}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                  <span>
                    Mostrando <strong>{filteredClientes.length}</strong> de <strong>{data.clientesCompleto.length}</strong> clientes
                  </span>
                  {(search || filtroEstado !== "todos" || filtroActividad !== "todos") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFiltroEstado("todos");
                        setFiltroActividad("todos");
                        setPageDetalle(1);
                      }}
                      className="text-[var(--brand)] hover:underline font-semibold"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Tabla de detalle */}
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                      <th
                        onClick={() => handleSort("nombre")}
                        aria-label="Ordenar por Nombre"
                        title="Ordenar por Nombre"
                        className={
                          "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                          tableCellHeader
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          Nombre
                          {renderSortIndicator("nombre")}
                        </span>
                      </th>
                      <th className={"text-left " + tableCellHeader}>DNI</th>
                      <th
                        onClick={() => handleSort("estado")}
                        aria-label="Ordenar por Estado"
                        title="Ordenar por Estado"
                        className={
                          "text-center cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                          tableCellHeader
                        }
                      >
                        <span className="inline-flex items-center justify-center gap-1">
                          Estado
                          {renderSortIndicator("estado")}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort("compras")}
                        aria-label="Ordenar por Compras"
                        title="Ordenar por Compras"
                        className={
                          "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                          tableCellHeader
                        }
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Compras
                          {renderSortIndicator("compras")}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort("total")}
                        aria-label="Ordenar por Total gastado"
                        title="Ordenar por Total gastado"
                        className={
                          "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                          tableCellHeader
                        }
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Total gastado
                          {renderSortIndicator("total")}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort("ultima")}
                        aria-label="Ordenar por Última compra"
                        title="Ordenar por Última compra"
                        className={
                          "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                          tableCellHeader
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          Última compra
                          {renderSortIndicator("ultima")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                    {paginatedClientes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                          No se encontraron clientes para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedClientes.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--border)]/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.dni}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={c.activo ? "success" : "danger"}>
                              {c.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text-muted)]">{c.cantidadCompras}</td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{formatCurrency(c.totalGastado)}</td>
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.ultimaCompra || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación */}
              {sortedClientes.length > 0 && (
                <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span>
                      Mostrando{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min((currentPageDetalle - 1) * pageSizeDetalle + 1, sortedClientes.length)}
                      </strong>{" "}
                      a{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min(currentPageDetalle * pageSizeDetalle, sortedClientes.length)}
                      </strong>{" "}
                      de <strong className="text-[var(--text)]">{sortedClientes.length}</strong> clientes
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span>Filas por página:</span>
                      <select
                        value={pageSizeDetalle}
                        onChange={(e) => {
                          setPageSizeDetalle(Number(e.target.value));
                          setPageDetalle(1);
                        }}
                        className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPageDetalle(1)}
                        disabled={currentPageDetalle <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Primera página"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        onClick={() => setPageDetalle((p) => Math.max(1, p - 1))}
                        disabled={currentPageDetalle <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2">
                        Página <strong>{currentPageDetalle}</strong> de <strong>{totalPagesDetalle}</strong>
                      </span>
                      <button
                        onClick={() => setPageDetalle((p) => Math.min(totalPagesDetalle, p + 1))}
                        disabled={currentPageDetalle >= totalPagesDetalle}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página siguiente"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setPageDetalle(totalPagesDetalle)}
                        disabled={currentPageDetalle >= totalPagesDetalle}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Última página"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3. SUBMÓDULO CLIENTES SIN COMPRAS RECIENTES ── */}
        {activeSubView === "sin_comprar" && (
          <div className="report-section" data-section-id="sin_compras_recientes" data-print-active={printActive("sin_compras_recientes")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={sectionHeaderClass}>
                {modoSinCompras === "recientes"
                  ? `Clientes sin compras en los últimos ${diasSinComprar} días`
                  : "Clientes registrados que nunca compraron"}
              </h3>
              <button onClick={() => setPrintSection("sin_compras_recientes")} className={printButtonClass} title="Imprimir esta sección">
                <Printer size={12} />
              </button>
            </div>

            <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
              {/* Controles de filtro y tiempo */}
              <div className="print:hidden p-4 border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)]/40 flex flex-wrap items-center justify-between gap-3">
                {/* Switch de modo: Sin compras recientes / Nunca compraron */}
                <div className="flex items-center gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModoSinCompras("recientes");
                      setPageSinCompras(1);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      modoSinCompras === "recientes"
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Sin compras recientes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoSinCompras("nunca");
                      setPageSinCompras(1);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      modoSinCompras === "nunca"
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Nunca compraron ({clientesNuncaCompraron.length})
                  </button>
                </div>

                {/* Selector de días sin comprar (solo si está en modo recientes) */}
                {modoSinCompras === "recientes" && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Período sin compras:</span>
                    <Select
                      value={String(diasSinComprar)}
                      onValueChange={(v) => {
                        setDiasSinComprar(Number(v));
                        setPageSinCompras(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                        <SelectItem value="180">180 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Tabla según el modo */}
              <div className="overflow-x-auto scrollbar-thin">
                {modoSinCompras === "recientes" ? (
                  <table className="w-full text-sm min-w-[650px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                        <th className={"text-left " + tableCellHeader}>Nombre</th>
                        <th className={"text-right " + tableCellHeader}>Cantidad de compras</th>
                        <th className={"text-right " + tableCellHeader}>Total gastado</th>
                        <th className={"text-left " + tableCellHeader}>Última compra</th>
                        <th className={"text-right " + tableCellHeader}>Días sin comprar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                      {paginatedRecientes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                            No hay clientes con más de {diasSinComprar} días sin comprar. ¡Todos los clientes con compras previas han comprado recientemente!
                          </td>
                        </tr>
                      ) : (
                        paginatedRecientes.map((c) => (
                          <tr key={c.id} className="hover:bg-[var(--border)]/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-muted)]">{c.cantidadCompras}</td>
                            <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{formatCurrency(c.totalGastado)}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.ultimaCompra || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400">
                                {c.dias} días
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm min-w-[550px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                        <th className={"text-left " + tableCellHeader}>Nombre</th>
                        <th className={"text-left " + tableCellHeader}>DNI</th>
                        <th className={"text-center " + tableCellHeader}>Estado</th>
                        <th className={"text-left " + tableCellHeader}>Fecha de registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                      {paginatedNunca.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                            No hay clientes registrados que nunca hayan comprado. Todos cuentan con al menos una compra.
                          </td>
                        </tr>
                      ) : (
                        paginatedNunca.map((c) => (
                          <tr key={c.id} className="hover:bg-[var(--border)]/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.dni}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={c.activo ? "success" : "danger"}>
                                {c.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.creadoEn}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Barra de Paginación Sin Compras */}
              {totalItemsSinCompras > 0 && (
                <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span>
                      Mostrando{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min((currentPageSinCompras - 1) * pageSizeSinCompras + 1, totalItemsSinCompras)}
                      </strong>{" "}
                      a{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min(currentPageSinCompras * pageSizeSinCompras, totalItemsSinCompras)}
                      </strong>{" "}
                      de <strong className="text-[var(--text)]">{totalItemsSinCompras}</strong> clientes
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span>Filas por página:</span>
                      <select
                        value={pageSizeSinCompras}
                        onChange={(e) => {
                          setPageSizeSinCompras(Number(e.target.value));
                          setPageSinCompras(1);
                        }}
                        className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPageSinCompras(1)}
                        disabled={currentPageSinCompras <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Primera página"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        onClick={() => setPageSinCompras((p) => Math.max(1, p - 1))}
                        disabled={currentPageSinCompras <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2">
                        Página <strong>{currentPageSinCompras}</strong> de <strong>{totalPagesSinCompras}</strong>
                      </span>
                      <button
                        onClick={() => setPageSinCompras((p) => Math.min(totalPagesSinCompras, p + 1))}
                        disabled={currentPageSinCompras >= totalPagesSinCompras}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página siguiente"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setPageSinCompras(totalPagesSinCompras)}
                        disabled={currentPageSinCompras >= totalPagesSinCompras}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Última página"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
