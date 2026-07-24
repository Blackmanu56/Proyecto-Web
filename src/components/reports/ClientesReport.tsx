"use client";

import {
getClientesReport,getFrecuenciaComprasCliente,getVentasPorCliente,
} from "@/actions/informes";
import ChartWrapper,{ CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/utils";
import {
Award,
Calendar,
Clock,
DollarSign,
Printer,
RefreshCw,
Search,
TrendingUp,
UserPlus,
Users
} from "lucide-react";
import React,{ useCallback,useEffect,useMemo,useState,useTransition } from "react";
import {
Bar,
BarChart,
CartesianGrid,
Cell,
Line,
LineChart,
Pie,
PieChart as RePie,
XAxis,YAxis,
} from "recharts";

type ClientesReportResult = Awaited<ReturnType<typeof getClientesReport>>;
type ClienteReportRow = ClientesReportResult["data"][number];
type VentasPorClienteRow = Awaited<ReturnType<typeof getVentasPorCliente>>["data"][number];
type FrecuenciaComprasRow = Awaited<ReturnType<typeof getFrecuenciaComprasCliente>>["data"][number];

interface Props {
  initialData?: ClientesReportResult;
  userRole?: string;
}

function DataSection({ title, loading, onLoad, loaded, children }: {
  title: string; loading: boolean; onLoad: () => void; loaded: boolean; children: React.ReactNode;
}) {
  if (!loaded) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          <button onClick={onLoad} disabled={loading}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
            {loading ? "Cargando..." : "Cargar"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

export default function ClientesReport({}: Props) {
  const [clientes, setClientes] = useState<ClienteReportRow[]>([]);
  const [clientesTotal, setClientesTotal] = useState(0);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [searchText, setSearchText] = useState("");
  const [isPending, startTransition] = useTransition();

  const [ventasPorCli, setVentasPorCli] = useState<VentasPorClienteRow[] | null>(null);
  const [frecuenciaData, setFrecuenciaData] = useState<FrecuenciaComprasRow[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await getClientesReport({ fechaDesde, fechaHasta, search: searchText || undefined });
      setClientes(result.data);
      setClientesTotal(result.total);
      setVentasPorCli(null);
      setFrecuenciaData(null);
    });
  }, [fechaDesde, fechaHasta, searchText]);

  const loadSection = useCallback(async (section: string, fetcher: () => Promise<unknown>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  }, []);

  const handlePrint = () => window.print();

  useEffect(() => {
    if (printSection) {
      setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
    }
  }, [printSection]);

  const kpiData = useMemo(() => {
    const total = clientesTotal;
    const activos = clientes.filter((c: ClienteReportRow) => c.cantidadCompras > 0).length;
    const nuevos = clientes.filter((c: ClienteReportRow) => c.cantidadCompras === 1).length;
    const totalGastado = clientes.reduce((s, c) => s + c.totalGastado, 0);
    const totalCompras = clientes.reduce((s, c) => s + c.cantidadCompras, 0);
    const ticketProm = totalCompras > 0 ? totalGastado / totalCompras : 0;
    const frecProm = clientes.length > 0
      ? clientes.reduce((s, c) => s + (c.frecuencia || 0), 0) / clientes.length
      : 0;

    return [
      { label: "Total Clientes", value: total.toString(), icon: <Users size={18} />, color: "indigo" as const },
      { label: "Clientes Activos", value: activos.toString(), icon: <UserPlus size={18} />, color: "emerald" as const },
      { label: "Nuevos (período)", value: nuevos.toString(), icon: <TrendingUp size={18} />, color: "sky" as const },
      { label: "Ticket Promedio", value: formatCurrency(ticketProm), icon: <DollarSign size={18} />, color: "amber" as const },
      { label: "Frecuencia Prom.", value: `${Math.round(frecProm)} días`, icon: <Clock size={18} />, color: "rose" as const },
      { label: "Total Facturado", value: formatCurrency(totalGastado), icon: <Award size={18} />, color: "purple" as const },
    ];
  }, [clientes, clientesTotal]);

  const clientesNuevos = useMemo(() =>
    clientes.filter((c: ClienteReportRow) => c.cantidadCompras === 1),
  [clientes]);

  const clientesInactivos = useMemo(() =>
    clientes.filter((c: ClienteReportRow) => c.cantidadCompras === 0),
  [clientes]);

  const gastoTendencia = useMemo(() => {
    const sorted = [...clientes].sort((a, b) => b.totalGastado - a.totalGastado);
    return sorted.slice(0, 20).map((c, i) => ({
      rank: i + 1,
      cliente: c.nombre.length > 12 ? c.nombre.substring(0, 12) + "..." : c.nombre,
      gasto: c.totalGastado,
    }));
  }, [clientes]);

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Search size={12} /> Búsqueda</label>
            <input type="text" placeholder="Nombre del cliente..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch} disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
          </button>
          <button onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Clientes</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiData.map((kpi, i) => <StatCard key={i} {...kpi} />)}
          </div>
        </div>

        {/* Main table */}
        <div className="report-section" data-section-id="table" data-print-active={printSection === "table" || null}>
          <div className="flex items-center justify-between mb-2 print:hidden">
            <h3 className="text-sm font-semibold text-slate-300">Clientes</h3>
            <button onClick={() => setPrintSection("table")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <DataTable
            columns={[
              { header: "Nombre", accessor: "nombre" },
              { header: "DNI", accessor: "dni" },
              { header: "Compras", accessor: "cantidadCompras", className: "text-right" },
              { header: "Total Gastado", accessor: (r: ClienteReportRow) => formatCurrency(r.totalGastado), className: "text-right" },
              { header: "Frecuencia", accessor: (r: ClienteReportRow) => r.frecuencia > 0 ? `${r.frecuencia} días` : "—", className: "text-right" },
              { header: "Última Compra", accessor: (r: ClienteReportRow) => r.ultimaCompra || "—" },
            ]}
            data={clientes}
            keyExtractor={(r: ClienteReportRow) => r.id}
            emptyMessage="Sin clientes en el período."
          />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartWrapper title="Top Clientes por Gasto" height={250}>
              <BarChart data={ventasPorCli ? ventasPorCli.slice(0, 10) : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="cliente" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>

            <ChartWrapper title="Frecuencia de Compra" height={250}>
              <RePie>
                <Pie data={frecuenciaData ? (() => {
                  const cats: Record<string, number> = {};
                  frecuenciaData.forEach((f: FrecuenciaComprasRow) => { cats[f.categoria] = (cats[f.categoria] || 0) + 1; });
                  return Object.entries(cats).map(([name, value]) => ({ name, value }));
                })() : []} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {[0, 1, 2, 3, 4].map((i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
              </RePie>
            </ChartWrapper>

            <ChartWrapper title="Tendencia de Gasto" height={250}>
              <LineChart data={gastoTendencia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="rank" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="gasto" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartWrapper>
          </div>
        </div>

        {/* Lazy Data Sections */}
        <div className="report-section" data-section-id="data-sections" data-print-active={printSection === "data-sections" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("data-sections")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
          <DataSection title="Clientes por Gasto" loading={loadingSection === "gasto"}
            onLoad={() => loadSection("gasto", () => getVentasPorCliente({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorCli(r.data)))}
            loaded={ventasPorCli !== null}>
            {ventasPorCli && (
              <DataTable columns={[
                { header: "Cliente", accessor: "cliente" },
                { header: "Compras", accessor: "cantidad", className: "text-right" },
                { header: "Total", accessor: (r: VentasPorClienteRow) => formatCurrency(r.total), className: "text-right" },
              ]} data={ventasPorCli} keyExtractor={(r: VentasPorClienteRow) => r.clienteId} />
            )}
          </DataSection>

          <DataSection title="Frecuencia de Compra" loading={loadingSection === "frec"}
            onLoad={() => loadSection("frec", () => getFrecuenciaComprasCliente().then(r => setFrecuenciaData(r.data)))}
            loaded={frecuenciaData !== null}>
            {frecuenciaData && (
              <DataTable columns={[
                { header: "Cliente", accessor: "cliente" },
                { header: "Compras", accessor: "cantidadCompras", className: "text-right" },
                { header: "Frecuencia", accessor: (r: FrecuenciaComprasRow) => r.frecuenciaDias > 0 ? `${r.frecuenciaDias} días` : "—", className: "text-right" },
                { header: "Categoría", accessor: "categoria" },
              ]} data={frecuenciaData} keyExtractor={(r: FrecuenciaComprasRow) => r.clienteId} />
            )}
          </DataSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Clientes Nuevos</h3>
              <DataTable
                columns={[
                  { header: "Nombre", accessor: "nombre" },
                  { header: "Gasto", accessor: (r: ClienteReportRow) => formatCurrency(r.totalGastado), className: "text-right" },
                  { header: "Últ. Compra", accessor: (r: ClienteReportRow) => r.ultimaCompra || "—" },
                ]}
                data={clientesNuevos.slice(0, 10)}
                keyExtractor={(r: ClienteReportRow) => r.id}
                emptyMessage="Sin clientes nuevos en el período."
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Clientes Inactivos</h3>
              <DataTable
                columns={[
                  { header: "Nombre", accessor: "nombre" },
                  { header: "DNI", accessor: "dni" },
                  { header: "Últ. Compra", accessor: (r: ClienteReportRow) => r.ultimaCompra || "—" },
                ]}
                data={clientesInactivos.slice(0, 10)}
                keyExtractor={(r: ClienteReportRow) => r.id}
                emptyMessage="Sin clientes inactivos."
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
