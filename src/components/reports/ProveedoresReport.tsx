"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import {
  getProveedoresReport, getReposicionProductos, getSinMovimientoProductos, getStockBajo,
} from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search, RefreshCw, Printer,
  ChevronDown, ChevronUp, ShieldCheck,
} from "lucide-react";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart as RePie, Pie, Cell,
} from "recharts";

type ProveedoresReportResult = Awaited<ReturnType<typeof getProveedoresReport>>;
type ProveedorReportRow = ProveedoresReportResult["data"][number];
type SinMovimientoRow = Awaited<ReturnType<typeof getSinMovimientoProductos>>["data"][number];
type StockBajoRow = Awaited<ReturnType<typeof getStockBajo>>["data"][number];
type ReposicionRow = Awaited<ReturnType<typeof getReposicionProductos>>["data"][number];

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

interface Props {
  initialData?: ProveedoresReportResult;
  userRole?: string;
}

function DataSection({ title, loading, onLoad, loaded, children }: {
  title: string; loading: boolean; onLoad: () => void; loaded: boolean; children: React.ReactNode;
}) {
  if (!loaded) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-muted">{title}</h3>
          <button onClick={onLoad} disabled={loading}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-border text-text-muted hover:bg-border-hover disabled:opacity-40 transition">
            {loading ? "Cargando..." : "Cargar"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-muted">{title}</h3>
      {children}
    </div>
  );
}

export default function ProveedoresReport({}: Props) {
  const [proveedores, setProveedores] = useState<ProveedorReportRow[]>([]);
  const [proveedoresTotal, setProveedoresTotal] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sinMovimiento, setSinMovimiento] = useState<SinMovimientoRow[] | null>(null);
  const [stockBajo, setStockBajo] = useState<StockBajoRow[] | null>(null);
  const [reposicion, setReposicion] = useState<ReposicionRow[] | null>(null);
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

  const proveedoresFiltrados = useMemo(() => {
    let p = proveedores;
    if (estadoFiltro === "activo") p = p.filter((x: ProveedorReportRow) => x.productosCount > 0);
    else if (estadoFiltro === "inactivo") p = p.filter((x: ProveedorReportRow) => x.productosCount === 0);
    return p;
  }, [proveedores, estadoFiltro]);

  const kpiData = useMemo(() => {
    const total = proveedoresTotal;
    const activos = proveedores.filter((p: ProveedorReportRow) => p.productosCount > 0).length;
    const totalProductos = proveedores.reduce((s, p) => s + p.productosCount, 0);
    const valorStockTotal = proveedores.reduce((s, p) => s + p.valorStock, 0);
    const stockBajoCount = proveedores.reduce((s, p) => s + p.stockBajoCount, 0);

    return [
      { label: "Total Proveedores", value: total.toString() },
      { label: "Proveedores Activos", value: activos.toString() },
      { label: "Productos en Stock", value: totalProductos.toString() },
      { label: "Valor Stock Total", value: formatCurrency(valorStockTotal) },
      { label: "Valor Stock Costo", value: formatCurrency(valorStockTotal) },
      { label: "Stock Bajo", value: stockBajoCount.toString() },
    ];
  }, [proveedores, proveedoresTotal]);

  const provChartData = useMemo(() => {
    return proveedoresFiltrados
      .filter((p: ProveedorReportRow) => p.valorStock > 0)
      .sort((a, b) => b.valorStock - a.valorStock)
      .slice(0, 10)
      .map((p: ProveedorReportRow) => ({
        nombre: p.nombre.length > 14 ? p.nombre.substring(0, 14) + "..." : p.nombre,
        valor: p.valorStock,
        productos: p.productosCount,
      }));
  }, [proveedoresFiltrados]);

  const pieChartData = useMemo(() => {
    const top = proveedoresFiltrados
      .filter((p: ProveedorReportRow) => p.valorStock > 0)
      .sort((a, b) => b.valorStock - a.valorStock)
      .slice(0, 8);
    const otros = proveedoresFiltrados
      .filter((p: ProveedorReportRow) => p.valorStock > 0)
      .sort((a, b) => b.valorStock - a.valorStock)
      .slice(8);
    const otrosValor = otros.reduce((s, p) => s + p.valorStock, 0);
    return [
      ...top.map((p: ProveedorReportRow) => ({ name: p.nombre.length > 10 ? p.nombre.substring(0, 10) + "..." : p.nombre, value: p.valorStock })),
      ...(otrosValor > 0 ? [{ name: "Otros", value: otrosValor }] : []),
    ];
  }, [proveedoresFiltrados]);

  return (
    <div className="space-y-4">
      {/* Barra de filtros colapsable (mismo patrón que VentasReport/CierresReport) */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Fila superior: toggle */}
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
        </div>

        {/* Contenido colapsable */}
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Search size={12} /> Búsqueda
                </label>
                <input
                  type="text"
                  placeholder="Nombre del proveedor..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <ShieldCheck size={12} /> Estado
                </label>
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className={inputClass}>
                  <option value="todos">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSearch}
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
          <p className="text-sm">Informe de Proveedores</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* Resumen */}
        <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiData.map((kpi, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
                <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">{kpi.label}</div>
                <div className="text-sm font-bold text-[var(--text)]">{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main table */}
        <div className="report-section" data-section-id="table" data-print-active={printSection === "table" || null}>
          <div className="flex items-center justify-between mb-2 print:hidden">
            <h3 className="text-sm font-semibold text-text-muted">Proveedores</h3>
            <button onClick={() => setPrintSection("table")}
              className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <DataTable
            columns={[
              { header: "Nombre", accessor: "nombre" },
              { header: "CUIT", accessor: "cuit" },
              { header: "Productos", accessor: "productosCount", className: "text-right" },
              { header: "Valor Stock", accessor: (r: ProveedorReportRow) => formatCurrency(r.valorStock), className: "text-right" },
              { header: "Stock Bajo", accessor: "stockBajoCount", className: "text-right" },
              { header: "Últ. Compra", accessor: (r: ProveedorReportRow) => r.ultimaCompra || "—" },
            ]}
            data={proveedoresFiltrados}
            keyExtractor={(r: ProveedorReportRow) => r.id}
            emptyMessage="Sin proveedores registrados."
          />
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
              className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
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
                { header: "Precio", accessor: (r: SinMovimientoRow) => formatCurrency(r.precioVenta), className: "text-right" },
              ]} data={sinMovimiento} keyExtractor={(r: SinMovimientoRow) => r.id} />
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
                  { header: "Stock Actual", accessor: (r: StockBajoRow) => <span className="text-rose-400 font-bold">{r.stockActual}</span>, className: "text-right" },
                  { header: "Stock Mín.", accessor: "stockMinimo", className: "text-right" },
                ]} data={stockBajo} keyExtractor={(r: StockBajoRow) => r.id} />
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
                  { header: "Sugerencia", accessor: (r: ReposicionRow) => r.sugerencia, className: "text-right" },
                ]} data={reposicion} keyExtractor={(r: ReposicionRow) => r.id} />
              )}
            </DataSection>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
