"use client";

import { getEmpleadosDashboard } from "@/actions/informes";
import type { EmpleadosDashboard, EmpleadoDashboardRow } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate, getCierresDateRange } from "@/lib/reportPeriods";
import type { PeriodoPreset } from "@/lib/reportPeriods";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Printer,
  RefreshCw,
  Search,
  User,
  UserCheck,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

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
  "Cambio de Estado": CHART_COLORS[3],
};

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const printButtonClass =
  "p-1.5 rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-emerald-400 hover:bg-[var(--border)] transition print:hidden";

// Único patrón de tooltip del proyecto (ver ClientesReport.tsx)
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

// Tooltip custom del gráfico "Actividad por Día": label del día en bold,
// una fila por empleado con actividad, y el total del día.
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

// Métricas según el rol del empleado (usadas en Resumen por Empleado y en el detalle)
function RoleMetrics({ emp }: { emp: EmpleadoDashboardRow }) {
  if (emp.rol === "ENCARGADO_VENTAS") {
    return (
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[var(--text-muted)]">
        <span>Ventas: <strong className="text-[var(--text)]">{emp.ventasCount}</strong></span>
        <span>Monto vendido: <strong className="text-[var(--text)]">{formatCurrency(emp.totalVendido)}</strong></span>
      </div>
    );
  }
  if (emp.rol === "ENCARGADO_STOCK") {
    return (
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[var(--text-muted)]">
        <span>Reposiciones: <strong className="text-[var(--text)]">{emp.comprasCount}</strong></span>
        <span>Cambios de estado: <strong className="text-[var(--text)]">{emp.cambiosEstadoProductoCount}</strong></span>
      </div>
    );
  }
  if (emp.rol === "ADMINISTRADOR") {
    return (
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[var(--text-muted)]">
        <span>Cajas abiertas: <strong className="text-[var(--text)]">{emp.cajasAbiertasCount}</strong></span>
        <span>Movimientos de caja: <strong className="text-[var(--text)]">{emp.movimientosCajaCount}</strong></span>
      </div>
    );
  }
  // Rol desconocido → solo la parte común
  return null;
}

// Contenido de la fila expandida de la tabla (debajo de la fila del empleado)
function EmpleadoDetalle({ emp }: { emp: EmpleadoDashboardRow }) {
  const modulos = [
    { label: "Ventas", value: emp.ventasCount },
    { label: "Reposiciones", value: emp.comprasCount },
    { label: "Caja", value: emp.movimientosCajaCount },
    { label: "Productos", value: emp.cambiosEstadoProductoCount },
  ];
  const max = Math.max(...modulos.map((m) => m.value), 1);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Actividad por módulo
        </p>
        <div className="space-y-2">
          {modulos.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-muted)]">{m.label}</span>
                <span className="font-bold text-[var(--text)]">{m.value}</span>
              </div>
              <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--brand)] rounded-full"
                  style={{ width: `${(m.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Métricas de rol
        </p>
        <RoleMetrics emp={emp} />
      </div>
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Actividad reciente
        </p>
        {emp.actividadReciente.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">Sin actividad en el período</p>
        ) : (
          <div className="space-y-1.5">
            {emp.actividadReciente.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <TipoDot tipo={a.tipo} />
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text)]">
                    {a.tipo} <span className="font-normal text-[var(--text-muted)]">· {a.descripcion}</span>
                  </p>
                  <p className="text-[var(--text-muted)]">{a.fechaLabel}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [expandedUsuarioId, setExpandedUsuarioId] = useState<number | null>(null);

  useEffect(() => {
    if (printSection) {
      const t = setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [printSection]);

  // Refetch del dashboard con el rango elegido — F1: date-only del input + "T00:00:00"
  const handleSearch = (desde: string = fechaDesde, hasta: string = fechaHasta) => {
    startTransition(async () => {
      const result = await getEmpleadosDashboard(
        desde ? `${desde}T00:00:00` : undefined,
        hasta ? `${hasta}T00:00:00` : undefined
      );
      setData(result);
    });
  };

  const handlePeriodChange = (period: PeriodoSeleccion) => {
    setActivePeriod(period);
    if (period === "personalizado") {
      // El usuario elige Desde/Hasta en el panel y presiona Buscar
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

  // Filtros client-side (Rol + búsqueda) — aplican a la tabla final
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

  // "Actividad por Empleado" es un resumen simple, no un ranking
  const empleadosConActividad = useMemo(
    () => data.empleados.filter((e) => e.acciones > 0),
    [data.empleados]
  );

  const printActive = (id: string) => (printSection === id) || null;

  return (
    <div className="space-y-4">
      {/* Barra de filtros colapsable (mismo patrón que VentasReport/CierresReport) */}
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

        {/* Resumen (6 tarjetas) */}
        <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total Empleados</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.total}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Activos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.activos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Administradores</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.administradores}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Encargados de Ventas</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.encargadosVentas}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Encargados de Stock</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.encargadosStock}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Actividad del Período</div>
              <div className="text-sm font-bold text-[var(--brand)]">{data.resumen.actividadPeriodo}</div>
            </div>
          </div>
        </div>

        {/* Actividad por Día (full-width) */}
        <div className="report-section" data-section-id="actividad-dia" data-print-active={printActive("actividad-dia")}>
          <ChartWrapper title="Actividad por Día" height={250}>
            {data.actividadPorDia.length === 0 ? (
              <div className="flex items-center justify-center h-full w-full text-sm text-[var(--text-secondary)]">
                Sin actividad en el período
              </div>
            ) : (
              <AreaChart data={data.actividadPorDia}>
                <defs>
                  <linearGradient id="empleadosActividadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={ActividadDiaTooltip} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#empleadosActividadGrad)" name="Total" />
              </AreaChart>
            )}
          </ChartWrapper>
        </div>

        {/* Fila 2: Actividad por Módulo + Actividad por Empleado */}
        <div className="report-section" data-section-id="modulos" data-print-active={printActive("modulos")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartWrapper title="Actividad por Módulo" height={250}>
              {data.actividadPorModulo.length === 0 ? (
                <div className="flex items-center justify-center h-full w-full text-sm text-[var(--text-secondary)]">
                  Sin actividad en el período
                </div>
              ) : (
                <BarChart data={data.actividadPorModulo} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="modulo" type="category" stroke="var(--text-muted)" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip
                    formatter={(value: number) => [`${value} acciones`, "Actividad"]}
                    cursor={{ fill: "var(--border)", fillOpacity: 0.3 }}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    labelStyle={tooltipStyle.labelStyle}
                  />
                  <Bar dataKey="acciones" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} name="Acciones" />
                </BarChart>
              )}
            </ChartWrapper>

            {/* Actividad por Empleado — resumen simple, sin ranking */}
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Actividad por Empleado</h3>
              {empleadosConActividad.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">Sin actividad en el período</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {empleadosConActividad.map((e) => (
                    <div key={e.usuarioId} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{e.nombreCompleto}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{e.rol}</p>
                      </div>
                      <span className="text-xs font-bold text-[var(--text)] shrink-0">{e.acciones} acciones</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resumen por Empleado (TODOS, incluyendo inactivos) */}
        <div className="report-section" data-section-id="resumen-empleados" data-print-active={printActive("resumen-empleados")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Resumen por Empleado</h3>
            <button onClick={() => setPrintSection("resumen-empleados")} className={printButtonClass} title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.empleados.map((emp) => (
              <div key={emp.usuarioId} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center text-sm font-bold uppercase shrink-0">
                    {emp.nombreCompleto.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text)] truncate">{emp.nombreCompleto}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{emp.rol}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  {emp.activo ? (
                    <span className="text-xs font-semibold text-[var(--success)]">Activo</span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--danger)]">Inactivo</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)] truncate">
                    Última actividad: {emp.ultimaActividadLabel || "—"}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Acciones en el período: <strong className="text-[var(--text)]">{emp.acciones}</strong>
                </p>
                <RoleMetrics emp={emp} />
              </div>
            ))}
          </div>
        </div>

        {/* Actividad Reciente (cronológica desc) */}
        <div className="report-section" data-section-id="actividad-reciente" data-print-active={printActive("actividad-reciente")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Actividad Reciente</h3>
            <button onClick={() => setPrintSection("actividad-reciente")} className={printButtonClass} title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl p-4">
            {data.actividadReciente.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-6">Sin actividad en el período</p>
            ) : (
              <div className="divide-y divide-[var(--border)] print:divide-gray-300">
                {data.actividadReciente.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-2.5">
                    <TipoDot tipo={item.tipo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-[var(--text)]">{item.tipo}</p>
                        <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0">{item.fechaLabel}</span>
                      </div>
                      <p className="text-sm text-[var(--text)]">{item.descripcion}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.empleado} <span className="opacity-70">· {item.rol}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabla Empleados (con fila expandible por empleado) */}
        <div className="report-section" data-section-id="tabla" data-print-active={printActive("tabla")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Empleados</h3>
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
                    <th className={"text-right " + tableCellHeader}>Acciones</th>
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
                  ) : empleadosTabla.map((emp) => (
                    <Fragment key={emp.usuarioId}>
                      <tr className="hover:bg-[var(--border)]/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--text)]">{emp.nombreCompleto}</p>
                          <p className="text-xs text-[var(--text-muted)]">{emp.username}</p>
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
                            onClick={() =>
                              setExpandedUsuarioId(expandedUsuarioId === emp.usuarioId ? null : emp.usuarioId)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition print:hidden"
                          >
                            {expandedUsuarioId === emp.usuarioId ? (
                              <>
                                <ChevronUp size={12} /> Ocultar
                              </>
                            ) : (
                              <>
                                <ChevronDown size={12} /> Detalle
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedUsuarioId === emp.usuarioId && (
                        <tr className="bg-[var(--panel)]/50">
                          <td colSpan={6} className="px-4 py-3">
                            <EmpleadoDetalle emp={emp} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FALTAN DATOS — no se imprime */}
        <div className="print:hidden border border-yellow-500/40 bg-yellow-500/5 rounded-xl p-4">
          <p className="text-sm font-bold text-[var(--text)] mb-1">Datos no disponibles</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Estas métricas no se pueden obtener con los datos actuales del sistema.
          </p>
          <ul className="list-disc list-inside space-y-1">
            {data.faltanDatos.map((msg) => (
              <li key={msg} className="text-xs text-[var(--text-muted)]">{msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
