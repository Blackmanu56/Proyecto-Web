"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { getReporteProductos, getProductosMasVendidos, getProductosMayorIngreso } from "@/actions/informes";
import type { ReporteProducto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  RefreshCw, Package, TrendingUp, DollarSign, Filter, Printer,
  Box, ShoppingBag, Percent, Truck,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import SubPestanasProductos from "./SubPestanasProductos";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart as RePie, Pie, Cell } from "recharts";

type TopProductoRow = Awaited<ReturnType<typeof getProductosMasVendidos>>[number];

interface Props {
  initialData: ReporteProducto[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
  userRole: string;
}

type ViewMode = "todos" | "masVendidos" | "mayorIngreso";
type StockFilter = "todos" | "sinStock" | "stockBajo" | "stockNormal";

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<{ size: number }> }[] = [
  { id: "todos", label: "Stock", icon: Package },
  { id: "masVendidos", label: "Más Vendidos", icon: TrendingUp },
  { id: "mayorIngreso", label: "Mayor Ingreso", icon: DollarSign },
];

function applyStockFilter(productos: ReporteProducto[], filter: StockFilter): ReporteProducto[] {
  switch (filter) {
    case "sinStock": return productos.filter((p) => p.cantidad === 0);
    case "stockBajo": return productos.filter((p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo);
    case "stockNormal": return productos.filter((p) => p.cantidad > p.stockMinimo);
    default: return productos;
  }
}

export default function ProductosReport({ initialData, categorias, proveedores }: Props) {
  const [allData, setAllData] = useState(initialData);
  const [viewMode, setViewMode] = useState<ViewMode>("todos");
  const [stockFilter, setStockFilter] = useState<StockFilter>("todos");
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [proveedorId, setProveedorId] = useState<number | undefined>(undefined);
  const [topList, setTopList] = useState<TopProductoRow[]>([]);
  const [printSection, setPrintSection] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const data = useMemo(() => {
    if (viewMode !== "todos") return [];
    return applyStockFilter(allData, stockFilter);
  }, [allData, stockFilter, viewMode]);

  const kpis = useMemo(() => {
    const total = allData.length;
    const activos = allData.filter((p) => p.activo).length;
    const valorVenta = allData.reduce((s, p) => s + p.cantidad * p.precioVenta, 0);
    const valorCompra = allData.reduce((s, p) => s + p.cantidad * p.precioCompra, 0);
    const margenProm = valorCompra > 0 ? ((valorVenta - valorCompra) / valorCompra) * 100 : 0;
    return [
      { label: "Total Productos", value: total.toString(), icon: <Package size={18} />, color: "indigo" as const },
      { label: "Activos", value: activos.toString(), icon: <Box size={18} />, color: "emerald" as const },
      { label: "Valor Venta", value: formatCurrency(valorVenta), icon: <DollarSign size={18} />, color: "sky" as const },
      { label: "Valor Costo", value: formatCurrency(valorCompra), icon: <ShoppingBag size={18} />, color: "amber" as const },
      { label: "Margen Prom.", value: margenProm.toFixed(1) + "%", icon: <Percent size={18} />, color: "purple" as const },
      { label: "Proveedores", value: proveedores.length.toString(), icon: <Truck size={18} />, color: "rose" as const },
    ];
  }, [allData, proveedores]);

  const handleSearch = () => {
    startTransition(async () => {
      if (viewMode === "masVendidos") {
        const res = await getProductosMasVendidos(15);
        setTopList(res);
      } else if (viewMode === "mayorIngreso") {
        const res = await getProductosMayorIngreso(15);
        setTopList(res);
      } else {
        const res = await getReporteProductos(categoriaId, proveedorId);
        setAllData(res);
      }
    });
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

  return (
    <div className="space-y-4">
      {/* View Mode Tabs */}
      <div className="print:hidden flex flex-wrap gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
        {VIEW_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)}
            className={
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all " +
              (viewMode === tab.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")
            }
          ><tab.icon size={14} />{tab.label}</button>
        ))}
      </div>

      {/* Filters */}
      {viewMode === "todos" && (
        <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Filter size={14} />Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Categoría</label>
              <select value={categoriaId || ""} onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="">Todas</option>
                {categorias.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
              </select>
            </div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Proveedor</label>
              <select value={proveedorId || ""} onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="">Todos</option>
                {proveedores.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
              </select>
            </div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1 block flex items-center gap-1"><Box size={12} /> Stock</label>
              <div className="flex flex-wrap gap-1">
                {(["todos", "sinStock", "stockBajo", "stockNormal"] as StockFilter[]).map((sf) => (
                  <button key={sf} onClick={() => setStockFilter(sf)}
                    className={
                      "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all " +
                      (stockFilter === sf ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200")
                    }
                  >{sf === "todos" ? "Todos" : sf === "sinStock" ? "Sin stock" : sf === "stockBajo" ? "Stock bajo" : "Normal"}</button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleSearch} disabled={isPending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
              </button>
              <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /></button>
            </div>
          </div>
        </div>
      )}

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Productos</p>
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
            <ChartWrapper title="Stock por Categoría" height={250}>
              <RePie>
                <Pie data={[]} dataKey="value" cx="50%" cy="50%" outerRadius={80} label>
                  <Cell fill={CHART_COLORS[0]} />
                </Pie>
              </RePie>
            </ChartWrapper>
            <ChartWrapper title="Top Proveedores (Valor Stock)" height={250}>
              <BarChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="valor" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartWrapper title="Rentabilidad por Producto" height={250}>
              <BarChart data={topList.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="cantidad" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>
            <ChartWrapper title="Precios vs Costo" height={250}>
              <BarChart data={allData.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 9 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="precioVenta" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="precioCompra" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>
          </div>
        </div>

        {/* Product list table (existing) */}
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
                  {viewMode === "todos" && (
                    <><th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Producto</th><th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Categoría</th><th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Proveedor</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">P.Compra</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">P.Venta</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Stock</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">St.Min</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Vendido</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Ingreso</th></>
                  )}
                  {(viewMode === "masVendidos" || viewMode === "mayorIngreso") && (
                    <><th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Producto</th><th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Categoría</th><th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">{viewMode === "masVendidos" ? "Cant. Vendida" : "Ingreso"}</th></>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                {(viewMode === "masVendidos" || viewMode === "mayorIngreso") && (
                  topList.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Presione &quot;Buscar&quot; para cargar.</td></tr>
                  ) : topList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white"><span className="text-xs text-slate-500 mr-2">#{idx + 1}</span>{item.nombre}</td>
                      <td className="px-4 py-3 text-slate-400">{item.categoria}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{viewMode === "masVendidos" ? item.cantidad + " uds." : formatCurrency(item.ingreso)}</td>
                    </tr>
                  ))
                )}
                {viewMode === "todos" && (data.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No se encontraron productos.</td></tr>
                ) : data.map((p) => {
                  const isStockBajo = p.cantidad > 0 && p.cantidad <= p.stockMinimo;
                  const isSinStock = p.cantidad === 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={"w-2 h-2 rounded-full " + (isSinStock ? "bg-red-500" : isStockBajo ? "bg-amber-500" : "bg-emerald-500")} /><span className={"font-semibold " + (isSinStock ? "text-red-300" : isStockBajo ? "text-amber-300" : "text-white")}>{p.nombre}</span></div></td>
                      <td className="px-4 py-3 text-slate-400">{p.categoria}</td>
                      <td className="px-4 py-3 text-slate-400">{p.proveedor}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(p.precioCompra)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(p.precioVenta)}</td>
                       <td className={"px-4 py-3 text-right font-bold " + (isSinStock ? "text-red-400" : isStockBajo ? "text-amber-400" : "text-white")}>{p.cantidad}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{p.stockMinimo}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{p.totalVendido}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(p.totalIngresado)}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Sub-pestañas */}
        <div className="report-section" data-section-id="data-sections" data-print-active={printSection === "data-sections" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("data-sections")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          {viewMode === "todos" && (
            <SubPestanasProductos categoriaId={categoriaId} proveedorId={proveedorId} />
          )}
        </div>
      </div>
    </div>
  );
}
