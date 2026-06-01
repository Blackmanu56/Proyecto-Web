"use client";

import React, { useState, useTransition, useMemo } from "react";
import { getReporteProductos, getProductosMasVendidos, getProductosMayorIngreso } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  RefreshCw,
  Package,
  TrendingUp,
  DollarSign,
  Filter,
  Printer,
  Box,
} from "lucide-react";

interface Props {
  initialData: any[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
  userRole: string;
}

type ViewMode = "todos" | "masVendidos" | "mayorIngreso";
type StockFilter = "todos" | "sinStock" | "stockBajo" | "stockNormal";

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<{ size: number }> }[] = [
  { id: "todos", label: "Todos los Productos", icon: Package },
  { id: "masVendidos", label: "Más Vendidos", icon: TrendingUp },
  { id: "mayorIngreso", label: "Mayor Ingreso", icon: DollarSign },
];

const STOCK_FILTERS: { id: StockFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "sinStock", label: "Sin stock" },
  { id: "stockBajo", label: "Stock bajo" },
  { id: "stockNormal", label: "Stock normal" },
];

function applyStockFilter(productos: any[], filter: StockFilter): any[] {
  switch (filter) {
    case "sinStock":
      return productos.filter((p) => p.cantidad === 0);
    case "stockBajo":
      return productos.filter((p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo);
    case "stockNormal":
      return productos.filter((p) => p.cantidad > p.stockMinimo);
    default:
      return productos;
  }
}

export default function ProductosReport({ initialData, categorias, proveedores, userRole }: Props) {
  const [allData, setAllData] = useState(initialData); // raw unfiltered data
  const [viewMode, setViewMode] = useState<ViewMode>("todos");
  const [stockFilter, setStockFilter] = useState<StockFilter>("todos");
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [proveedorId, setProveedorId] = useState<number | undefined>(undefined);
  const [topList, setTopList] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    startTransition(async () => {
      if (viewMode === "masVendidos") {
        const res = await getProductosMasVendidos(15);
        setTopList(res);
      } else if (viewMode === "mayorIngreso") {
        const res = await getProductosMayorIngreso(15);
        setTopList(res);
      } else {
        // "todos": fetch all products (active + inactive), filter client-side
        const res = await getReporteProductos(categoriaId, proveedorId);
        setAllData(res);
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered data (client-side stock filter applied to allData)
  const data = useMemo(() => {
    if (viewMode !== "todos") return [];
    return applyStockFilter(allData, stockFilter);
  }, [allData, stockFilter, viewMode]);

  // Stats computed from FILTERED data (what the user sees)
  const totalEncontrados = data.length;
  const stockBajoCount = applyStockFilter(allData, "stockBajo").length;
  const sinStockCount = applyStockFilter(allData, "sinStock").length;
  const valorStock = allData.reduce((sum: number, p: any) => sum + p.cantidad * p.precioCompra, 0);

  return (
    <div className="space-y-4">
      {/* View Mode Tabs — hidden on print */}
      <div className="print:hidden flex flex-wrap gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setViewMode(tab.id); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              viewMode === tab.id
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters (only for "todos" mode — the other views use their own search) */}
      {viewMode === "todos" && (
        <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Filter size={14} />
            Filtros
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Categoría */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Categoría</label>
              <select
                value={categoriaId || ""}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            {/* Proveedor */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Proveedor</label>
              <select
                value={proveedorId || ""}
                onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            {/* Estado de stock */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block flex items-center gap-1">
                <Box size={12} /> Estado de stock
              </label>
              <div className="flex flex-wrap gap-1">
                {STOCK_FILTERS.map((sf) => (
                  <button
                    key={sf.id}
                    onClick={() => setStockFilter(sf.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                      stockFilter === sf.id
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Search button */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                {isPending ? "Buscando..." : "Buscar"}
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
              >
                <Printer size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print header */}
      <div className="hidden print:block text-center mb-6">
        <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
        <p className="text-sm">Informe de Productos</p>
        <hr className="my-2 border-gray-300" />
      </div>

      {/* Stats — only for "todos" mode */}
      {viewMode === "todos" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Total encontrados</p>
            <p className="text-2xl font-black text-white print:text-black mt-1">{totalEncontrados}</p>
          </div>
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Stock bajo</p>
            <p className={`text-2xl font-black mt-1 ${stockBajoCount > 0 ? "text-amber-400 print:text-amber-700" : "text-slate-500"}`}>
              {stockBajoCount}
            </p>
          </div>
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Sin stock</p>
            <p className={`text-2xl font-black mt-1 ${sinStockCount > 0 ? "text-red-400 print:text-red-700" : "text-slate-500"}`}>
              {sinStockCount}
            </p>
          </div>
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Valor en stock</p>
            <p className="text-2xl font-black text-emerald-400 print:text-green-700 mt-1">{formatCurrency(valorStock)}</p>
          </div>
        </div>
      )}

      {/* Table / List */}
      <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                {/* "todos" mode: full columns */}
                {viewMode === "todos" && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Proveedor</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">P. Compra</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">P. Venta</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Stock</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Stock Min</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Vendido</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Ingresos</th>
                  </>
                )}
                {/* Top list columns */}
                {(viewMode === "masVendidos" || viewMode === "mayorIngreso") && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Categoría</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">
                      {viewMode === "masVendidos" ? "Cant. Vendida" : "Ingreso Total"}
                    </th>
                    {viewMode === "mayorIngreso" && (
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Cantidad</th>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
              {/* Top lists */}
              {(viewMode === "masVendidos" || viewMode === "mayorIngreso") && (
                topList.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 print:text-gray-400">
                    Presione "Buscar" para cargar.
                  </td></tr>
                ) : (
                  topList.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30 print:hover:bg-white transition-colors">
                      <td className="px-4 py-3 font-semibold text-white print:text-black">
                        <span className="text-xs text-slate-500 print:text-gray-400 mr-2">#{idx + 1}</span>
                        {item.nombre}
                      </td>
                      <td className="px-4 py-3 text-slate-400 print:text-gray-600">{item.categoria}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">
                        {viewMode === "masVendidos" ? `${item.cantidad} uds.` : formatCurrency(item.ingreso)}
                      </td>
                      {viewMode === "mayorIngreso" && (
                        <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{item.cantidad} uds.</td>
                      )}
                    </tr>
                  ))
                )
              )}

              {/* Full product table */}
              {viewMode === "todos" && (
                data.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500 print:text-gray-400">
                    No se encontraron productos.
                  </td></tr>
                ) : (
                  data.map((p: any) => {
                    const isStockBajo = p.cantidad > 0 && p.cantidad <= p.stockMinimo;
                    const isSinStock = p.cantidad === 0;
                    const stockColor = isSinStock ? "text-red-400" : isStockBajo ? "text-amber-400" : "text-white";

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 print:hover:bg-white transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              isSinStock ? "bg-red-500" : isStockBajo ? "bg-amber-500" : "bg-emerald-500"
                            }`} />
                            <span className={`font-semibold ${isSinStock ? "text-red-300" : isStockBajo ? "text-amber-300" : "text-white"} print:text-black`}>
                              {p.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 print:text-gray-600">{p.categoria}</td>
                        <td className="px-4 py-3 text-slate-400 print:text-gray-600">{p.proveedor}</td>
                        <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{formatCurrency(p.precioCompra)}</td>
                        <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{formatCurrency(p.precioVenta)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${stockColor} print:text-black`}>
                          {p.cantidad}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 print:text-gray-600">{p.stockMinimo}</td>
                        <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{p.totalVendido}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">{formatCurrency(p.totalIngresado)}</td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
