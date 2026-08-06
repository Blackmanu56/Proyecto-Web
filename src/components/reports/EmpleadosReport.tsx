"use client";

import { getActividadRecienteVendedores,getRankingVendedores,getReporteEmpleados,getVentasPorVendedorComision } from "@/actions/informes";
import ChartWrapper,{ CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import { formatCurrency } from "@/lib/utils";
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
import { useEffect,useMemo,useState,useTransition } from "react";
import { Area,AreaChart,Bar,BarChart,CartesianGrid,XAxis,YAxis } from "recharts";
import { getCierresDateRange } from "@/lib/reportPeriods";
import type { PeriodoPreset } from "@/lib/reportPeriods";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type EmpleadoReportRow = Awaited<ReturnType<typeof getReporteEmpleados>>[number];
type RankingVendedorRow = Awaited<ReturnType<typeof getRankingVendedores>>["data"][number];
type ActividadVendedorRow = Awaited<ReturnType<typeof getActividadRecienteVendedores>>["data"][number];
type VentasPorVendedorRow = Awaited<ReturnType<typeof getVentasPorVendedorComision>>["data"][number];
type PeriodoSeleccion = PeriodoPreset | "personalizado";

const PERIOD_OPTIONS: { value: PeriodoSeleccion; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
  { value: "personalizado", label: "Personalizado" },
];

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

interface Props {
  initialData: EmpleadoReportRow[];
  userRole: string;
}

export default function EmpleadosReport({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [rolFiltro, setRolFiltro] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [isPending, startTransition] = useTransition();
  const [activePeriod, setActivePeriod] = useState<PeriodoSeleccion>("dia");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [ranking, setRanking] = useState<RankingVendedorRow[] | null>(null);
  const [actividad, setActividad] = useState<ActividadVendedorRow[] | null>(null);
  const [ventasPorVend, setVentasPorVend] = useState<VentasPorVendedorRow[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  const handleSearch = (desde = fechaDesde, hasta = fechaHasta) => {
    startTransition(async () => {
      const result = await getReporteEmpleados(desde || undefined, hasta || undefined);
      setData(result);
      setRanking(null); setActividad(null); setVentasPorVend(null);
    });
  };

  const handlePeriodChange = (period: PeriodoSeleccion) => {
    setActivePeriod(period);
    if (period === "personalizado") return; // el usuario elige Desde/Hasta y presiona Buscar
    const range = getCierresDateRange(period);
    const desde = range.desde.slice(0, 10);
    const hasta = range.hasta.slice(0, 10);
    setFechaDesde(desde);
    setFechaHasta(hasta);
    handleSearch(desde, hasta);
  };

  const loadSection = async (section: string, fetcher: () => Promise<unknown>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  };

  const handlePrint = () => window.print();

  useEffect(() => {
    if (printSection) {
      setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
    }
  }, [printSection]);

  const empleadosFiltrados = useMemo(() => {
    let e = data;
    if (rolFiltro) e = e.filter((x: EmpleadoReportRow) => x.rol === rolFiltro);
    if (searchUser) e = e.filter((x: EmpleadoReportRow) =>
      (x.nombreCompleto || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (x.username || "").toLowerCase().includes(searchUser.toLowerCase())
    );
    return e;
  }, [data, rolFiltro, searchUser]);

  const kpis = useMemo(() => {
    const e = empleadosFiltrados;
    const total = e.length;
    const totalVentas = e.reduce((s, x) => s + (x.ventasCount || 0), 0);
    const totalVendido = e.reduce((s, x) => s + (x.totalVendido || 0), 0);
    const conVentas = e.filter((x: EmpleadoReportRow) => (x.ventasCount || 0) > 0);
    const promEmpleado = conVentas.length > 0 ? totalVendido / conVentas.length : 0;
    const mejor = e.reduce((best: EmpleadoReportRow | null, x) => (x.totalVendido > (best?.totalVendido || 0) ? x : best), null);
    const peor = e.reduce((worst: EmpleadoReportRow | null, x) => ((x.totalVendido < (worst?.totalVendido || Infinity) && x.totalVendido > 0) ? x : worst), null);
    return [
      { label: "Empleados", value: total.toString() },
      { label: "Activos", value: total.toString() },
      { label: "Ventas Mes", value: totalVentas.toString() },
      { label: "Comisiones Pag.", value: formatCurrency(totalVendido * 0.05) },
      { label: "Mejor Vend.", value: mejor && mejor.totalVendido > 0 ? mejor.nombreCompleto : "\u2014" },
      { label: "Peor Vend.", value: peor && peor.totalVendido > 0 ? peor.nombreCompleto : "\u2014" },
      { label: "Prom. x Empl.", value: formatCurrency(promEmpleado) },
    ];
  }, [empleadosFiltrados]);

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
                  <option value="ADMINISTRADOR">Admin</option>
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
                  placeholder="Buscar..."
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
                onClick={handlePrint}
                className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--border)] text-[var(--text-muted)] text-sm font-bold rounded-lg flex items-center gap-2 transition border border-[var(--border)]"
              >
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Rendimiento de Empleados</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* Resumen */}
        <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
                <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">{kpi.label}</div>
                <div className="text-sm font-bold text-[var(--text)]">{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="report-section" data-section-id="charts" data-print-active={printSection === "charts" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("charts")}
              className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartWrapper title="Ranking Vendedores" height={250}>
              <BarChart data={ranking?.slice(0, 10) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis dataKey="vendedor" type="category" stroke="#64748b" tick={{ fontSize: 10 }} width={100} />
                <Bar dataKey="totalVendido" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartWrapper>
            <ChartWrapper title="Actividad por Día" height={250}>
              <AreaChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="ventas" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ChartWrapper>
          </div>
        </div>

        {/* Data Sections */}
        <div className="report-section" data-section-id="data-sections" data-print-active={printSection === "data-sections" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("data-sections")}
              className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
          {!ranking ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-muted">Ranking Vendedores</h3>
                <button onClick={() => loadSection("rank", () => getRankingVendedores({ fechaDesde, fechaHasta, rol: rolFiltro || undefined }).then(r => setRanking(r.data)))} disabled={loadingSection === "rank"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-border text-text-muted hover:bg-border-hover disabled:opacity-40 transition">
                  {loadingSection === "rank" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-muted">Ranking Vendedores</h3>
              <DataTable
                columns={[
                  { header: "#", accessor: (r: RankingVendedorRow) => "#" + r.usuarioId },
                  { header: "Vendedor", accessor: "vendedor" },
                  { header: "Rol", accessor: "rol" },
                  { header: "Ventas", accessor: "ventas", className: "text-right" },
                  { header: "Total", accessor: (r: RankingVendedorRow) => formatCurrency(r.totalVendido), className: "text-right" },
                  { header: "Promedio", accessor: (r: RankingVendedorRow) => formatCurrency(r.promedioVenta), className: "text-right" },
                ]}
                data={ranking} keyExtractor={(r: RankingVendedorRow) => r.usuarioId} emptyMessage="Sin datos de ranking." />
            </div>
          )}

          {!actividad ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-muted">Actividad Reciente</h3>
                <button onClick={() => loadSection("act", () => getActividadRecienteVendedores().then(r => setActividad(r.data)))} disabled={loadingSection === "act"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-border text-text-muted hover:bg-border-hover disabled:opacity-40 transition">
                  {loadingSection === "act" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-muted">Actividad Reciente</h3>
              <DataTable
                columns={[
                  { header: "Vendedor", accessor: "vendedor" },
                  { header: "Últ. Venta", accessor: (r: ActividadVendedorRow) => r.ultimaVenta || "\u2014" },
                  { header: "Últ. Cierre", accessor: (r: ActividadVendedorRow) => r.ultimoCierre || "\u2014" },
                  { header: "Hoy", accessor: "ventasHoy", className: "text-right" },
                  { header: "Semana", accessor: "ventasSemana", className: "text-right" },
                ]}
                data={actividad} keyExtractor={(r: ActividadVendedorRow) => r.usuarioId} emptyMessage="Sin actividad registrada." />
            </div>
          )}

          {!ventasPorVend ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-muted">Ventas por Vendedor</h3>
                <button onClick={() => loadSection("vv", () => getVentasPorVendedorComision({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorVend(r.data)))} disabled={loadingSection === "vv"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-border text-text-muted hover:bg-border-hover disabled:opacity-40 transition">
                  {loadingSection === "vv" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-muted">Ventas por Vendedor</h3>
              <DataTable
                columns={[
                  { header: "Vendedor", accessor: "vendedor" },
                  { header: "Ventas", accessor: "cantidadVentas", className: "text-right" },
                  { header: "Total", accessor: (r: VentasPorVendedorRow) => formatCurrency(r.totalVendido), className: "text-right" },
                  { header: "Comisión", accessor: (r: VentasPorVendedorRow) => formatCurrency(r.comision), className: "text-right" },
                ]}
                data={ventasPorVend} keyExtractor={(r: VentasPorVendedorRow) => r.usuarioId} emptyMessage="Sin ventas registradas." />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

