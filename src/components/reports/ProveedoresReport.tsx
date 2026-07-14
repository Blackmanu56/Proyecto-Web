"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import {
  getProveedoresReport, getReposicionProductos, getSinMovimientoProductos, getStockBajo,
} from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search, RefreshCw, Printer, ShoppingCart, Package,
  DollarSign, TrendingUp, AlertTriangle, Truck,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart as RePie, Pie, Cell,
} from "recharts";

interface Props {
  initialData?: any;
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

export default function ProveedoresReport({ initialData, userRole }: Props) {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [proveedoresTotal, setProveedoresTotal] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [isPending, startTransition] = useTransition();

  const [sinMovimiento, setSinMovimiento] = useState<any[] | null>(null);
  const [stockBajo, setStockBajo] = useState<any[] | null>(null);
  const [reposicion, setReposicion] = useState<any[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await getProveedoresReport({ search: searchText || undefined });
      setProveedores(result.data);
      setProveedoresTotal(result.total);
      setSinMovimiento(null);
      setStockBajo(null);
      setReposicion(null);
    });
  }, [searchText]);

  const loadSection = useCallback(async (section: string, fetcher: () => Promise<any>) => {
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

  const proveedoresFiltrados = useMemo(() => {
    let p = proveedores;
    if (estadoFiltro === "activo") p = p.filter((x: any) => x.productosCount > 0);
    else if (estadoFiltro === "inactivo") p = p.filter((x: any) => x.productosCount === 0);
    return p;
  }, [proveedores, estadoFiltro]);

  const kpiData = useMemo(() => {
    const total = proveedoresTotal;
    const activos = proveedores.filter((p: any) => p.productosCount > 0).length;
    const totalProductos = proveedores.reduce((s: number, p: any) => s + p.productosCount, 0);
    const valorStockTotal = proveedores.reduce((s: number, p: any) => s + p.valorStock, 0);
    const stockBajoCount = proveedores.reduce((s: number, p: any) => s + p.stockBajoCount, 0);

    return [
      { label: "Total Proveedores", value: total.toString(), icon: <Truck size={18} />, color: "indigo" as const },
      { label: "Proveedores Activos", value: activos.toString(), icon: <Package size={18} />, color: "emerald" as const },
      { label: "Productos en Stock", value: totalProductos.toString(), icon: <ShoppingCart size={18} />, color: "sky" as const },
      { label: "Valor Stock Total", value: formatCurrency(valorStockTotal), icon: <DollarSign size={18} />, color: "amber" as const },
      { label: "Valor Stock Costo", value: formatCurrency(valorStockTotal), icon: <TrendingUp size={18} />, color: "rose" as const },
      { label: "Stock Bajo", value: stockBajoCount.toString(), icon: <AlertTriangle size={18} />, color: "purple" as const },
    ];
  }, [proveedores, proveedoresTotal]);

  const provChartData = useMemo(() => {
    return proveedoresFiltrados
      .filter((p: any) => p.valorStock > 0)
      .sort((a: any, b: any) => b.valorStock - a.valorStock)
      .slice(0, 10)
      .map((p: any) => ({
        nombre: p.nombre.length > 14 ? p.nombre.substring(0, 14) + "..." : p.nombre,
        valor: p.valorStock,
        productos: p.productosCount,
      }));
  }, [proveedoresFiltrados]);

  const pieChartData = useMemo(() => {
    const top = proveedoresFiltrados
      .filter((p: any) => p.valorStock > 0)
      .sort((a: any, b: any) => b.valorStock - a.valorStock)
      .slice(0, 8);
    const otros = proveedoresFiltrados
      .filter((p: any) => p.valorStock > 0)
      .sort((a: any, b: any) => b.valorStock - a.valorStock)
      .slice(8);
    const otrosValor = otros.reduce((s: number, p: any) => s + p.valorStock, 0);
    return [
      ...top.map((p: any) => ({ name: p.nombre.length > 10 ? p.nombre.substring(0, 10) + "..." : p.nombre, value: p.valorStock })),
      ...(otrosValor > 0 ? [{ name: "Otros", value: otrosValor }] : []),
    ];
  }, [proveedoresFiltrados]);

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Search size={12} /> Búsqueda</label>
            <input type="text" placeholder="Nombre del proveedor..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Estado</label>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
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
          <p className="text-sm">Informe de Proveedores</p>
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
            <h3 className="text-sm font-semibold text-slate-300">Proveedores</h3>
            <button onClick={() => setPrintSection("table")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <DataTable
            columns={[
              { header: "Nombre", accessor: "nombre" },
              { header: "CUIT", accessor: "cuit" },
              { header: "Productos", accessor: "productosCount", className: "text-right" },
              { header: "Valor Stock", accessor: (r: any) => formatCurrency(r.valorStock), className: "text-right" },
              { header: "Stock Bajo", accessor: "stockBajoCount", className: "text-right" },
              { header: "Últ. Compra", accessor: (r: any) => r.ultimaCompra || "—" },
            ]}
            data={proveedoresFiltrados}
            keyExtractor={(r: any) => r.id}
            emptyMessage="Sin proveedores registrados."
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
          <ChartWrapper title="Stock por Proveedor" height={250}>
            <RePie>
              <Pie data={pieChartData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                {pieChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
            </RePie>
          </ChartWrapper>

          <ChartWrapper title="Top Proveedores por Valor" height={250}>
            <BarChart data={provChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Bar dataKey="valor" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrapper>

          <ChartWrapper title="Productos por Proveedor" height={250}>
            <BarChart data={provChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Bar dataKey="productos" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
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
          <DataSection title="Productos sin Movimiento" loading={loadingSection === "sinmov"}
            onLoad={() => loadSection("sinmov", () => getSinMovimientoProductos({ page: 1 }).then(r => setSinMovimiento(r.data)))}
            loaded={sinMovimiento !== null}>
            {sinMovimiento && (
              <DataTable columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "Stock", accessor: "stockActual", className: "text-right" },
                { header: "Precio", accessor: (r: any) => formatCurrency(r.precioVenta), className: "text-right" },
              ]} data={sinMovimiento} keyExtractor={(r: any) => r.id} />
            )}
          </DataSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DataSection title="Productos con Stock Bajo" loading={loadingSection === "stockbajo"}
              onLoad={() => loadSection("stockbajo", () => getStockBajo({ page: 1 }).then(r => setStockBajo(r.data)))}
              loaded={stockBajo !== null}>
              {stockBajo && (
                <DataTable columns={[
                  { header: "Producto", accessor: "producto" },
                  { header: "Proveedor", accessor: "proveedor" },
                  { header: "Stock Actual", accessor: (r: any) => <span className="text-rose-400 font-bold">{r.stockActual}</span>, className: "text-right" },
                  { header: "Stock Mín.", accessor: "stockMinimo", className: "text-right" },
                ]} data={stockBajo} keyExtractor={(r: any) => r.id} />
              )}
            </DataSection>

            <DataSection title="Reposición Necesaria" loading={loadingSection === "repos"}
              onLoad={() => loadSection("repos", () => getReposicionProductos().then(r => setReposicion(r.data)))}
              loaded={reposicion !== null}>
              {reposicion && (
                <DataTable columns={[
                  { header: "Producto", accessor: "producto" },
                  { header: "Proveedor", accessor: "proveedor" },
                  { header: "Stock", accessor: "stockActual", className: "text-right" },
                  { header: "Mínimo", accessor: "stockMinimo", className: "text-right" },
                  { header: "Sugerencia", accessor: (r: any) => r.sugerencia, className: "text-right" },
                ]} data={reposicion} keyExtractor={(r: any) => r.id} />
              )}
            </DataSection>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
