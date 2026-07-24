"use client";

import { getBottomProductos,getReporteVentas,getTopProductos,getVentasPorCategoria,getVentasPorCliente,getVentasPorProducto,getVentasPorVendedorComision } from "@/actions/informes";
import ChartWrapper,{ CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import { formatCurrency,formatDateShort } from "@/lib/utils";
import {
Award,BarChart3,
Calendar,
DollarSign,
Eye,
List,
Percent,
Printer,
RefreshCw,
Search,
ShoppingCart,
User,
Users
} from "lucide-react";
import React,{ useCallback,useEffect,useMemo,useRef,useState,useTransition } from "react";
import { Bar,BarChart,CartesianGrid,Cell,Pie,PieChart as RePie,XAxis,YAxis } from "recharts";
import DetalleVentaModal from "./DetalleVentaModal";
import TicketModal from "./TicketModal";

type VentasReportData = Awaited<ReturnType<typeof getReporteVentas>>;
type VentaRow = VentasReportData["ventas"][number];
type VentasPorProductoRow = Awaited<ReturnType<typeof getVentasPorProducto>>["data"][number];
type VentasPorCategoriaRow = Awaited<ReturnType<typeof getVentasPorCategoria>>["data"][number];
type VentasPorClienteRow = Awaited<ReturnType<typeof getVentasPorCliente>>["data"][number];
type VentasPorVendedorRow = Awaited<ReturnType<typeof getVentasPorVendedorComision>>["data"][number];
type TopProductoRow = Awaited<ReturnType<typeof getTopProductos>>["data"][number];
type BottomProductoRow = Awaited<ReturnType<typeof getBottomProductos>>["data"][number];

interface Props {
  initialData: VentasReportData;
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
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

export default function VentasReport({ initialData, usuarios }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState("");
  const [isPending, startTransition] = useTransition();

  const [ventasPorProd, setVentasPorProd] = useState<VentasPorProductoRow[] | null>(null);
  const [ventasPorCat, setVentasPorCat] = useState<VentasPorCategoriaRow[] | null>(null);
  const [ventasPorCli, setVentasPorCli] = useState<VentasPorClienteRow[] | null>(null);
  const [ventasPorVend, setVentasPorVend] = useState<VentasPorVendedorRow[] | null>(null);
  const [topProds, setTopProds] = useState<TopProductoRow[] | null>(null);
  const [bottomProds, setBottomProds] = useState<BottomProductoRow[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [ticketVentaId, setTicketVentaId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await getReporteVentas(fechaDesde || undefined, fechaHasta || undefined, usuarioId);
      setData(result);
      setVentasPorProd(null); setVentasPorCat(null); setVentasPorCli(null);
      setVentasPorVend(null); setTopProds(null); setBottomProds(null);
    });
  }, [fechaDesde, fechaHasta, usuarioId]);

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

  const ventasFiltradas = useMemo(() => {
    const v = data.ventas || [];
    if (!searchText) return v;
    return v.filter((x: VentaRow) =>
      (x.cliente || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (x.usuario || "").toLowerCase().includes(searchText.toLowerCase())
    );
  }, [data, searchText]);

  const totales = useMemo(() => {
    const v = ventasFiltradas;
    const cantidad = v.length;
    const total = v.reduce((s, x) => s + (x.total || 0), 0);
    const promedio = cantidad > 0 ? total / cantidad : 0;
    return { cantidad, total, promedio };
  }, [ventasFiltradas]);

  const clientesUnicos = useMemo(() => {
    return new Set((data.ventas || []).map((v) => v.cliente)).size;
  }, [data]);

  const ventasHoy = useMemo(() => {
    return (data.ventas || []).filter((v) => {
      try { return new Date(v.fecha).toDateString() === new Date().toDateString(); }
      catch { return false; }
    }).length;
  }, [data]);

  const kpiData = useMemo(() => [
    { label: "Ventas Hoy", value: ventasHoy.toString(), icon: <ShoppingCart size={18} />, color: "indigo" as const },
    { label: "Ventas Mes", value: totales.cantidad.toString(), icon: <List size={18} />, color: "emerald" as const },
    { label: "Ticket Promedio", value: formatCurrency(totales.promedio), icon: <DollarSign size={18} />, color: "sky" as const },
    { label: "Comisiones (5%)", value: formatCurrency(totales.total * 0.05), icon: <Award size={18} />, color: "amber" as const },
    { label: "N° Ventas", value: totales.cantidad.toString(), icon: <BarChart3 size={18} />, color: "purple" as const },
    { label: "N° Clientes", value: clientesUnicos.toString(), icon: <Users size={18} />, color: "rose" as const },
    { label: "Margen Promedio", value: "—", icon: <Percent size={18} />, color: "indigo" as const },
  ], [ventasHoy, totales, clientesUnicos]);

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><User size={12} /> Vendedor</label>
            <select value={usuarioId || ""} onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos</option>
              {usuarios.map((u) => (<option key={u.id} value={u.id}>{u.nombreCompleto || u.username}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Search size={12} /> Búsqueda</label>
            <input type="text" placeholder="Cliente / Vendedor..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch} disabled={isPending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div ref={printRef} className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Ventas</p>
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
            {kpiData.map((kpi, i) => <StatCard key={i} {...kpi} />)}
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
            <ChartWrapper title="Ventas Diarias" height={250}>
                <BarChart data={(data.ventas || []).length > 0 ? [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return { fecha: formatDateShort(d), total: 0 }; }) : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>
            <ChartWrapper title="Ventas por Categoría" height={250}>
              <RePie>
                <Pie data={[{ name: "Cargando...", value: 1 }]} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  <Cell fill={CHART_COLORS[0]} />
                </Pie>
              </RePie>
            </ChartWrapper>
          </div>
        </div>

        {/* Tabla de Ventas */}
        <div className="report-section" data-section-id="table" data-print-active={printSection === "table" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("table")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Vendedor</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Prod.</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:hidden">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                {ventasFiltradas.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Sin ventas en el período.</td></tr>
                ) : ventasFiltradas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-white print:text-black">#{String(venta.id).padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-slate-300 print:text-gray-700 text-xs">{venta.fecha}</td>
                    <td className="px-4 py-3 text-slate-200 print:text-gray-800 font-medium truncate max-w-[150px]">{venta.cliente}</td>
                    <td className="px-4 py-3 text-slate-400 print:text-gray-600">{venta.usuario}</td>
                    <td className="px-4 py-3 text-slate-300 print:text-gray-700 text-right">{venta.cantidadProductos}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">{formatCurrency(venta.total)}</td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetalleVentaId(venta.id)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition" title="Ver detalle"><Eye size={14} /></button>
                        <button onClick={() => setTicketVentaId(venta.id)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition" title="Ticket"><Printer size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <DataSection title="Ventas por Producto" loading={loadingSection === "prod"} onLoad={() => loadSection("prod", () => getVentasPorProducto({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorProd(r.data)))} loaded={ventasPorProd !== null}>
            {ventasPorProd && <DataTable columns={[{ header: "Producto", accessor: "producto" }, { header: "Cat.", accessor: "categoria" }, { header: "Cant.", accessor: "cantidad", className: "text-right" }, { header: "Subtotal", accessor: (r: VentasPorProductoRow) => formatCurrency(r.subtotal), className: "text-right" }, { header: "Ganancia", accessor: (r: VentasPorProductoRow) => formatCurrency(r.ganancia), className: "text-right" }]} data={ventasPorProd} keyExtractor={(r: VentasPorProductoRow) => r.productoId} />}
          </DataSection>

          <DataSection title="Ventas por Categoría" loading={loadingSection === "cat"} onLoad={() => loadSection("cat", () => getVentasPorCategoria({ fechaDesde, fechaHasta }).then(r => setVentasPorCat(r.data)))} loaded={ventasPorCat !== null}>
            {ventasPorCat && <DataTable columns={[{ header: "Categoría", accessor: "categoria" }, { header: "Cant.", accessor: "cantidad", className: "text-right" }, { header: "Subtotal", accessor: (r: VentasPorCategoriaRow) => formatCurrency(r.subtotal), className: "text-right" }, { header: "Ganancia", accessor: (r: VentasPorCategoriaRow) => formatCurrency(r.ganancia), className: "text-right" }]} data={ventasPorCat} keyExtractor={(r: VentasPorCategoriaRow) => r.categoria} />}
          </DataSection>

          <DataSection title="Ventas por Cliente" loading={loadingSection === "cli"} onLoad={() => loadSection("cli", () => getVentasPorCliente({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorCli(r.data)))} loaded={ventasPorCli !== null}>
            {ventasPorCli && <DataTable columns={[{ header: "Cliente", accessor: "cliente" }, { header: "Compras", accessor: "cantidad", className: "text-right" }, { header: "Total", accessor: (r: VentasPorClienteRow) => formatCurrency(r.total), className: "text-right" }]} data={ventasPorCli} keyExtractor={(r: VentasPorClienteRow) => r.clienteId} />}
          </DataSection>

          <DataSection title="Ventas por Vendedor" loading={loadingSection === "vend"} onLoad={() => loadSection("vend", () => getVentasPorVendedorComision({ fechaDesde, fechaHasta, page: 1 }).then(r => setVentasPorVend(r.data)))} loaded={ventasPorVend !== null}>
            {ventasPorVend && <DataTable columns={[{ header: "Vendedor", accessor: "vendedor" }, { header: "Ventas", accessor: "cantidadVentas", className: "text-right" }, { header: "Total", accessor: (r: VentasPorVendedorRow) => formatCurrency(r.totalVendido), className: "text-right" }, { header: "Comisión", accessor: (r: VentasPorVendedorRow) => formatCurrency(r.comision), className: "text-right" }]} data={ventasPorVend} keyExtractor={(r: VentasPorVendedorRow) => r.usuarioId} />}
          </DataSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DataSection title="Top Productos" loading={loadingSection === "top"} onLoad={() => loadSection("top", () => getTopProductos({ fechaDesde, fechaHasta }, 10).then(r => setTopProds(r.data)))} loaded={topProds !== null}>
              {topProds && <DataTable columns={[{ header: "Producto", accessor: "producto" }, { header: "Cat.", accessor: "categoria" }, { header: "Cant.", accessor: "cantidad", className: "text-right" }, { header: "Ingreso", accessor: (r: TopProductoRow) => formatCurrency(r.ingreso), className: "text-right" }]} data={topProds} keyExtractor={(r: TopProductoRow) => r.productoId} />}
            </DataSection>

            <DataSection title="Bottom Productos" loading={loadingSection === "bottom"} onLoad={() => loadSection("bottom", () => getBottomProductos({ fechaDesde, fechaHasta }, 10).then(r => setBottomProds(r.data)))} loaded={bottomProds !== null}>
              {bottomProds && <DataTable columns={[{ header: "Producto", accessor: "producto" }, { header: "Cat.", accessor: "categoria" }, { header: "Cant.", accessor: "cantidad", className: "text-right" }, { header: "Ingreso", accessor: (r: BottomProductoRow) => formatCurrency(r.ingreso), className: "text-right" }]} data={bottomProds} keyExtractor={(r: BottomProductoRow) => r.productoId} />}
            </DataSection>
          </div>
        </div>
      </div>
      </div>

      {detalleVentaId && <DetalleVentaModal ventaId={detalleVentaId} onClose={() => setDetalleVentaId(null)} onPrintTicket={() => { const id = detalleVentaId; setDetalleVentaId(null); setTicketVentaId(id); }} />}
      {ticketVentaId && <TicketModal ventaId={ticketVentaId} onClose={() => setTicketVentaId(null)} />}
    </div>
  );
}
