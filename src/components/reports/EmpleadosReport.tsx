"use client";

import { getEmpleadosDashboard } from "@/actions/informes";
import type { EmpleadosDashboard, EmpleadoDashboardRow } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatLocalDate, getCierresDateRange } from "@/lib/reportPeriods";
import type { PeriodoPreset } from "@/lib/reportPeriods";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
  User,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie,
  PieChart as RePie, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import DetalleEmpleadoModal from "./DetalleEmpleadoModal";

type SubViewId = "analisis" | "detalle" | "actividad";

type PeriodoSeleccion = PeriodoPreset | "personalizado";

const PERIOD_OPTIONS: { value: PeriodoSeleccion; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
  { value: "personalizado", label: "Personalizado" },
];

const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  ENCARGADO_VENTAS: "Encargado de Ventas",
  ENCARGADO_STOCK: "Encargado de Stock",
};

const TIPO_COLOR: Record<string, string> = {
  Venta: CHART_COLORS[0],
  "Reposición": CHART_COLORS[1],
  "Movimiento de Caja": CHART_COLORS[2],
  "Apertura de Caja": CHART_COLORS[2],
  "Cierre de Caja": CHART_COLORS[2],
  "Cambio de Estado": CHART_COLORS[3],
  "Edición de datos": CHART_COLORS[4],
  "Ajuste de Precio": "#8b5cf6",
  "Ajuste de Precios": "#8b5cf6",
  "Ajuste de Stock": "#f59e0b",
};

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

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

// Tooltip custom del gráfico "Evolución de Actividad": label del día en bold,
// desglose por empleado con actividad, y el total del día.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActividadDiaTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const day = payload[0]?.payload;
  if (!day) return null;
  return (
    <div style={tooltipStyle.contentStyle}>
      <p style={{ ...tooltipStyle.labelStyle, fontWeight: 700, marginBottom: 4 }}>{day.label}</p>
      {(day.porEmpleado || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <p key={p.usuarioId} style={tooltipStyle.itemStyle}>
            {p.nombre}: <strong>{p.acciones}</strong> acciones
          </p>
        )
      )}
      <p style={{ ...tooltipStyle.itemStyle, fontWeight: 700, marginTop: 4 }}>
        Total: <strong>{day.total}</strong>
      </p>
    </div>
  );
}

// Círculo de color según el tipo de actividad (Venta/Reposición/Caja/Estado)
function TipoDot({ tipo }: { tipo: string }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
      style={{ backgroundColor: TIPO_COLOR[tipo] || CHART_COLORS[4] }}
    />
  );
}

interface Props {
  initialData: EmpleadosDashboard;
  userRole: string;
}

export default function EmpleadosReport({ initialData }: Props) {
  const [data, setData] = useState<EmpleadosDashboard>(initialData);
  const [fechaDesde, setFechaDesde] = useState(() => formatLocalDate(new Date()));
  const [fechaHasta, setFechaHasta] = useState(() => formatLocalDate(new Date()));
  const [activePeriod, setActivePeriod] = useState<PeriodoSeleccion>("dia");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [rolFiltro, setRolFiltro] = useState("");
  const [isPending, startTransition] = useTransition();
  const [printSection, setPrintSection] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<SubViewId>("analisis");
  const [selectedEmpleado, setSelectedEmpleado] = useState<EmpleadoDashboardRow | null>(null);

  // Filtros y paginación para el Historial de Actividades
  const [actividadSearch, setActividadSearch] = useState("");
  const [actividadUsuarioId, setActividadUsuarioId] = useState("");
  const [actividadModulo, setActividadModulo] = useState("");
  const [actividadTipo, setActividadTipo] = useState("");
  const [actividadPage, setActividadPage] = useState(1);
  const [actividadPageSize, setActividadPageSize] = useState(20);

  // Módulos y tipos únicos presentes en las actividades
  const availableModulos = useMemo(() => {
    const set = new Set(data.actividadReciente.map((a) => a.modulo).filter(Boolean));
    return Array.from(set).sort();
  }, [data.actividadReciente]);

  const availableTipos = useMemo(() => {
    let items = data.actividadReciente;
    if (actividadModulo) {
      items = items.filter((a) => a.modulo === actividadModulo);
    }
    const set = new Set(items.map((a) => a.tipo).filter(Boolean));
    return Array.from(set).sort();
  }, [data.actividadReciente, actividadModulo]);

  // Filtros aplicados a la lista completa de actividades del período
  const actividadesFiltradas = useMemo(() => {
    let list = data.actividadReciente;
    if (actividadUsuarioId) {
      const uid = Number(actividadUsuarioId);
      list = list.filter((a) => a.usuarioId === uid);
    }
    if (rolFiltro) {
      list = list.filter((a) => a.rol === rolFiltro);
    }
    if (actividadModulo) {
      list = list.filter((a) => a.modulo === actividadModulo);
    }
    if (actividadTipo) {
      list = list.filter((a) => a.tipo === actividadTipo);
    }
    if (actividadSearch.trim()) {
      const q = actividadSearch.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.descripcion.toLowerCase().includes(q) ||
          a.empleado.toLowerCase().includes(q) ||
          a.tipo.toLowerCase().includes(q) ||
          a.modulo.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.actividadReciente, actividadUsuarioId, rolFiltro, actividadModulo, actividadTipo, actividadSearch]);

  const totalActividades = actividadesFiltradas.length;
  const totalPages = Math.max(1, Math.ceil(totalActividades / actividadPageSize));
  const currentPage = Math.min(Math.max(1, actividadPage), totalPages);

  const paginatedActividades = useMemo(() => {
    const start = (currentPage - 1) * actividadPageSize;
    return actividadesFiltradas.slice(start, start + actividadPageSize);
  }, [actividadesFiltradas, currentPage, actividadPageSize]);

  useEffect(() => {
    if (printSection) {
      const t = setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [printSection]);

  // Refetch del dashboard con el rango elegido
  const handleSearch = (desde: string = fechaDesde, hasta: string = fechaHasta) => {
    startTransition(async () => {
      const result = await getEmpleadosDashboard(
        desde ? `${desde}T00:00:00` : undefined,
        hasta ? `${hasta}T00:00:00` : undefined
      );
      setData(result);
      setActividadPage(1);
    });
  };

  const handlePeriodChange = (period: PeriodoSeleccion) => {
    setActivePeriod(period);
    if (period === "personalizado") {
      setFiltersOpen(true);
      return;
    }
    const range = getCierresDateRange(period);
    const desde = range.desde.slice(0, 10);
    const hasta = range.hasta.slice(0, 10);
    setFechaDesde(desde);
    setFechaHasta(hasta);
    handleSearch(desde, hasta);
  };

  // Filtros client-side (Rol + búsqueda) — aplican a la tabla de empleados
  const empleadosTabla = useMemo(() => {
    let rows = data.empleados;
    if (rolFiltro) rows = rows.filter((e) => e.rol === rolFiltro);
    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase();
      rows = rows.filter(
        (e) =>
          e.nombreCompleto.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data.empleados, rolFiltro, searchUser]);

  // Ranking y cálculo de participación de empleados en el período
  const totalAccionesGeneral = useMemo(
    () => data.empleados.reduce((s, e) => s + e.acciones, 0),
    [data.empleados]
  );

  const maxEmpleadoAcciones = useMemo(
    () => Math.max(...data.empleados.map((e) => e.acciones), 1),
    [data.empleados]
  );

  const empleadosRanking = useMemo(
    () => [...data.empleados].filter((e) => e.acciones > 0).sort((a, b) => b.acciones - a.acciones),
    [data.empleados]
  );

  const printActive = (id: string) => (printSection === id) || null;

  return (
    <div className="space-y-4">
      {/* Selector de sub-vista */}
      <div className="print:hidden flex flex-wrap gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-1">
        {(["analisis", "detalle", "actividad"] as SubViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => setActiveSubView(v)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeSubView === v
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            {v === "analisis" ? "Análisis" : v === "detalle" ? "Detalle de empleados" : "Historial de Actividades"}
          </button>
        ))}
      </div>

      {/* Barra de filtros colapsable */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Fila superior: toggle + período */}
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 hover:text-[var(--text)] transition-colors shrink-0"
          >
            <Search size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-muted)]">
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
            </span>
            {filtersOpen ? (
              <ChevronUp size={14} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            )}
          </button>

          <div className="h-4 w-px bg-[var(--border)] shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <Calendar size={14} className="text-[var(--text-muted)]" />
            <span className="text-xs font-semibold text-[var(--text-muted)]">Período:</span>
            <Select
              value={activePeriod}
              onValueChange={(v) => handlePeriodChange(v as PeriodoSeleccion)}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contenido colapsable */}
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setActivePeriod("personalizado");
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setActivePeriod("personalizado");
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <UserCheck size={12} /> Rol
                </label>
                <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="ENCARGADO_VENTAS">Encargado de Ventas</option>
                  <option value="ENCARGADO_STOCK">Encargado de Stock</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <User size={12} /> Usuario
                </label>
                <input
                  type="text"
                  placeholder="Buscar por nombre o usuario..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleSearch()}
                disabled={isPending}
                className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                {isPending ? "Buscando..." : "Buscar"}
              </button>
              <button
                onClick={() => setPrintSection("tabla")}
                className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--border)] text-[var(--text-muted)] text-sm font-bold rounded-lg flex items-center gap-2 transition border border-[var(--border)]"
              >
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Empleados — Actividad y Uso del Sistema</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* ── 1. SUBMÓDULO ANÁLISIS ── */}
        {activeSubView === "analisis" && (
          <>
            {/* Resumen */}
            <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total Empleados</div>
                  <div className="text-base font-bold text-[var(--text)]">{data.resumen.total}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Personal Activo</div>
                  <div className="text-base font-bold text-[var(--success)]">{data.resumen.activos}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Con Actividad en el Período</div>
                  <div className="text-base font-bold text-[var(--brand)]">
                    {data.resumen.empleadosConActividad ?? empleadosRanking.length}
                  </div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Acciones del Período</div>
                  <div className="text-base font-bold text-[var(--text)]">{data.resumen.actividadPeriodo}</div>
                </div>
              </div>
            </div>

            {/* Evolución de Actividad */}
            <div className="report-section" data-section-id="actividad-dia" data-print-active={printActive("actividad-dia")}>
              <ChartWrapper title="Evolución de Actividad" height={280}>
                {data.actividadPorDia.length === 0 ? (
                  <div className="flex items-center justify-center h-full w-full text-sm text-[var(--text-secondary)]">
                    Sin actividad en el período seleccionado
                  </div>
                ) : (
                  <AreaChart data={data.actividadPorDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="empleadosActividadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={ActividadDiaTooltip} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "4 4" }} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS[0] }}
                      activeDot={{ r: 5 }}
                      fill="url(#empleadosActividadGrad)"
                      name="Total"
                    />
                  </AreaChart>
                )}
              </ChartWrapper>
            </div>

            {/* Fila 2: Actividad por Módulo + Distribución por Empleado */}
            <div className="report-section" data-section-id="modulos" data-print-active={printActive("modulos")}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartWrapper title="Carga por Módulo" height={280}>
                  {data.actividadPorModulo.length === 0 ? (
                    <div className="flex items-center justify-center h-full w-full text-sm text-[var(--text-secondary)]">
                      Sin actividad en el período seleccionado
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 h-full">
                      <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePie>
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                const total = data.actividadPorModulo.reduce((s, d) => s + d.acciones, 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(0) : "0";
                                return [`${value} acciones (${pct}%)`, name];
                              }}
                              contentStyle={tooltipStyle.contentStyle}
                              itemStyle={tooltipStyle.itemStyle}
                              labelStyle={tooltipStyle.labelStyle}
                            />
                            <Pie
                              data={data.actividadPorModulo}
                              dataKey="acciones"
                              nameKey="modulo"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                            >
                              {data.actividadPorModulo.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                          </RePie>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 space-y-2.5">
                        {data.actividadPorModulo.map((entry, i) => {
                          const total = data.actividadPorModulo.reduce((s, d) => s + d.acciones, 0);
                          const pct = total > 0 ? ((entry.acciones / total) * 100).toFixed(0) : "0";
                          return (
                            <div key={entry.modulo} className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-sm shrink-0"
                                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="text-xs text-[var(--text-muted)] truncate" title={entry.modulo}>
                                {entry.modulo}
                              </span>
                              <span className="text-xs font-semibold text-[var(--text)] ml-auto shrink-0">
                                {entry.acciones} <span className="text-[var(--text-muted)] font-normal">({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </ChartWrapper>

                {/* Distribución por Empleado (Ranking con barras y clic para abrir modal) */}
                <div className="bg-card rounded-xl p-4 border border-border flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-muted mb-4 flex items-center gap-2">
                      <User size={14} className="text-[var(--brand)]" />
                      Distribución por Empleado
                    </h3>
                    {empleadosRanking.length === 0 ? (
                      <div className="flex items-center justify-center h-[280px] text-sm text-[var(--text-secondary)]">
                        Sin actividad en el período seleccionado
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1.5 pb-1">
                        {empleadosRanking.map((e, i) => {
                          const pctTotal = totalAccionesGeneral > 0
                            ? ((e.acciones / totalAccionesGeneral) * 100).toFixed(0)
                            : "0";
                          const pctBar = maxEmpleadoAcciones > 0
                            ? (e.acciones / maxEmpleadoAcciones) * 100
                            : 0;
                          return (
                            <div
                              key={e.usuarioId}
                              onClick={() => setSelectedEmpleado(e)}
                              className="group flex items-center gap-3 p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--brand)]/50 cursor-pointer transition-all"
                            >
                              <span className="text-sm font-bold shrink-0 w-6 text-center text-[var(--text-muted)] group-hover:text-[var(--brand)]">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                                    {e.nombreCompleto}
                                  </p>
                                  <span className="text-xs font-bold text-[var(--brand)] shrink-0">
                                    {e.acciones} acc. ({pctTotal}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
                                  <span>{ROL_LABEL[e.rol] || e.rol}</span>
                                  <span>·</span>
                                  <span>Última: {e.ultimaActividadLabel || "—"}</span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                                    style={{ width: `${Math.max(pctBar, 4)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── 2. SUBMÓDULO DETALLE DE EMPLEADOS ── */}
        {activeSubView === "detalle" && (
          <div className="report-section" data-section-id="tabla" data-print-active={printActive("tabla")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={sectionHeaderClass}>Listado de Empleados</h3>
              <button onClick={() => setPrintSection("tabla")} className={printButtonClass} title="Imprimir esta sección">
                <Printer size={12} />
              </button>
            </div>
            <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                      <th className={"text-left " + tableCellHeader}>Empleado</th>
                      <th className={"text-left " + tableCellHeader}>Rol</th>
                      <th className={"text-left " + tableCellHeader}>Estado</th>
                      <th className={"text-left " + tableCellHeader}>Última actividad</th>
                      <th className={"text-right " + tableCellHeader}>Acciones (en el período)</th>
                      <th className={"text-right " + tableCellHeader}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                    {empleadosTabla.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                          Sin empleados para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      empleadosTabla.map((emp) => (
                        <tr key={emp.usuarioId} className="hover:bg-[var(--border)]/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[var(--text)]">{emp.nombreCompleto}</p>
                            <p className="text-xs text-[var(--text-muted)]">@{emp.username}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{ROL_LABEL[emp.rol] || emp.rol}</td>
                          <td className="px-4 py-3">
                            {emp.activo ? (
                              <span className="text-xs font-semibold text-[var(--success)]">Activo</span>
                            ) : (
                              <span className="text-xs font-semibold text-[var(--danger)]">Inactivo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{emp.ultimaActividadLabel || "—"}</td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{emp.acciones}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedEmpleado(emp)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-hover)] transition print:hidden"
                            >
                              <User size={12} /> Ver Detalle
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. SUBMÓDULO HISTORIAL DE ACTIVIDADES ── */}
        {activeSubView === "actividad" && (
          <div className="report-section space-y-3" data-section-id="actividad-reciente" data-print-active={printActive("actividad-reciente")}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div>
                <h3 className={sectionHeaderClass}>Historial de Actividades</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalActividades === 1
                    ? "1 actividad registrada"
                    : `${totalActividades} actividades registradas en el período`}
                  {data.actividadReciente.length !== totalActividades && (
                    <span> (filtradas de un total de {data.actividadReciente.length})</span>
                  )}
                </p>
              </div>
              <button onClick={() => setPrintSection("actividad-reciente")} className={printButtonClass} title="Imprimir esta sección">
                <Printer size={12} />
              </button>
            </div>

            {/* Filtros contextuales */}
            <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Search size={12} /> Búsqueda
                </label>
                <input
                  type="text"
                  placeholder="Buscar en descripción, producto..."
                  value={actividadSearch}
                  onChange={(e) => {
                    setActividadSearch(e.target.value);
                    setActividadPage(1);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <User size={12} /> Empleado
                </label>
                <select
                  value={actividadUsuarioId}
                  onChange={(e) => {
                    setActividadUsuarioId(e.target.value);
                    setActividadPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">Todos los empleados</option>
                  {data.empleados.map((u) => (
                    <option key={u.usuarioId} value={u.usuarioId}>
                      {u.nombreCompleto} ({ROL_LABEL[u.rol] || u.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Layers size={12} /> Módulo
                </label>
                <select
                  value={actividadModulo}
                  onChange={(e) => {
                    setActividadModulo(e.target.value);
                    setActividadTipo("");
                    setActividadPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">Todos los módulos</option>
                  {availableModulos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Filter size={12} /> Tipo de Acción
                </label>
                <select
                  value={actividadTipo}
                  onChange={(e) => {
                    setActividadTipo(e.target.value);
                    setActividadPage(1);
                  }}
                  className={inputClass}
                >
                  <option value="">Todas las acciones</option>
                  {availableTipos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabla de Actividades */}
            <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                      <th className={"text-left " + tableCellHeader}>Fecha y hora</th>
                      <th className={"text-left " + tableCellHeader}>Empleado</th>
                      <th className={"text-left " + tableCellHeader}>Rol</th>
                      <th className={"text-left " + tableCellHeader}>Módulo</th>
                      <th className={"text-left " + tableCellHeader}>Acción</th>
                      <th className={"text-left " + tableCellHeader}>Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                    {paginatedActividades.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                          {data.actividadReciente.length === 0
                            ? "Sin actividad en el período seleccionado."
                            : "No se encontraron actividades con los filtros aplicados."}
                        </td>
                      </tr>
                    ) : (
                      paginatedActividades.map((item) => (
                        <tr key={item.id} className="hover:bg-[var(--border)]/40 transition-colors">
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{item.fechaLabel}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--text)]">{item.empleado}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{ROL_LABEL[item.rol] || item.rol}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{item.modulo}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 [&>span]:mt-0">
                              <TipoDot tipo={item.tipo} />
                              <span className="text-[var(--text)]">{item.tipo}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text)]">{item.descripcion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación */}
              {totalActividades > 0 && (
                <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span>
                      Mostrando{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min((currentPage - 1) * actividadPageSize + 1, totalActividades)}
                      </strong>{" "}
                      a{" "}
                      <strong className="text-[var(--text)]">
                        {Math.min(currentPage * actividadPageSize, totalActividades)}
                      </strong>{" "}
                      de <strong className="text-[var(--text)]">{totalActividades}</strong> actividades
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span>Filas por página:</span>
                      <select
                        value={actividadPageSize}
                        onChange={(e) => {
                          setActividadPageSize(Number(e.target.value));
                          setActividadPage(1);
                        }}
                        className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActividadPage(1)}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Primera página"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        onClick={() => setActividadPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2">
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                      </span>
                      <button
                        onClick={() => setActividadPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Página siguiente"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setActividadPage(totalPages)}
                        disabled={currentPage >= totalPages}
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

      {/* Modal de Detalle de Empleado */}
      {selectedEmpleado && (
        <DetalleEmpleadoModal
          emp={selectedEmpleado}
          onClose={() => setSelectedEmpleado(null)}
        />
      )}
    </div>
  );
}
