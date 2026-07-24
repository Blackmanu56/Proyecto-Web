"use client";

import { getActividadRecienteVendedores,getRankingVendedores,getReporteEmpleados,getVentasPorVendedorComision } from "@/actions/informes";
import ChartWrapper,{ CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/utils";
import {
Award,
Calendar,
Medal,
Printer,
RefreshCw,
Search,
Star,
TrendingUp,
UserCheck,
Users,
Wallet,
} from "lucide-react";
import { useEffect,useMemo,useState,useTransition } from "react";
import { Area,AreaChart,Bar,BarChart,CartesianGrid,XAxis,YAxis } from "recharts";

type EmpleadoReportRow = Awaited<ReturnType<typeof getReporteEmpleados>>[number];
type RankingVendedorRow = Awaited<ReturnType<typeof getRankingVendedores>>["data"][number];
type ActividadVendedorRow = Awaited<ReturnType<typeof getActividadRecienteVendedores>>["data"][number];
type VentasPorVendedorRow = Awaited<ReturnType<typeof getVentasPorVendedorComision>>["data"][number];

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

  const [ranking, setRanking] = useState<RankingVendedorRow[] | null>(null);
  const [actividad, setActividad] = useState<ActividadVendedorRow[] | null>(null);
  const [ventasPorVend, setVentasPorVend] = useState<VentasPorVendedorRow[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getReporteEmpleados(fechaDesde || undefined, fechaHasta || undefined);
      setData(result);
      setRanking(null); setActividad(null); setVentasPorVend(null);
    });
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
      { label: "Empleados", value: total.toString(), icon: <Users size={18} />, color: "indigo" as const },
      { label: "Activos", value: total.toString(), icon: <UserCheck size={18} />, color: "emerald" as const },
      { label: "Ventas Mes", value: totalVentas.toString(), icon: <TrendingUp size={18} />, color: "sky" as const },
      { label: "Comisiones Pag.", value: formatCurrency(totalVendido * 0.05), icon: <Wallet size={18} />, color: "amber" as const },
      { label: "Mejor Vend.", value: mejor && mejor.totalVendido > 0 ? mejor.nombreCompleto : "\u2014", icon: <Award size={18} />, color: "emerald" as const },
      { label: "Peor Vend.", value: peor && peor.totalVendido > 0 ? peor.nombreCompleto : "\u2014", icon: <Medal size={18} />, color: "rose" as const },
      { label: "Prom. x Empl.", value: formatCurrency(promEmpleado), icon: <Star size={18} />, color: "purple" as const },
    ];
  }, [empleadosFiltrados]);

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Desde</label><input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" /></div>
          <div><label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Hasta</label><input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" /></div>
          <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Rol</label>
            <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos</option>
              <option value="ADMINISTRADOR">Admin</option>
              <option value="ENCARGADO_VENTAS">Encargado de Ventas</option>
              <option value="ENCARGADO_STOCK">Encargado de Stock</option>
            </select>
          </div>
          <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Usuario</label>
            <input type="text" placeholder="Buscar..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch} disabled={isPending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Rendimiento de Empleados</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* KPIs */}
        <div className="report-section" data-section-id="kpis" data-print-active={printSection === "kpis" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("kpis")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {kpis.map((kpi, i) => <StatCard key={i} {...kpi} />)}
          </div>
        </div>

        {/* Charts */}
        <div className="report-section" data-section-id="charts" data-print-active={printSection === "charts" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("charts")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
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
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
          {!ranking ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Ranking Vendedores</h3>
                <button onClick={() => loadSection("rank", () => getRankingVendedores({ fechaDesde, fechaHasta, rol: rolFiltro || undefined }).then(r => setRanking(r.data)))} disabled={loadingSection === "rank"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                  {loadingSection === "rank" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Ranking Vendedores</h3>
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
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Actividad Reciente</h3>
                <button onClick={() => loadSection("act", () => getActividadRecienteVendedores().then(r => setActividad(r.data)))} disabled={loadingSection === "act"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                  {loadingSection === "act" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Actividad Reciente</h3>
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
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Ventas por Vendedor</h3>
                <button onClick={() => loadSection("vv", () => getVentasPorVendedorComision({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorVend(r.data)))} disabled={loadingSection === "vv"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                  {loadingSection === "vv" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Ventas por Vendedor</h3>
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

