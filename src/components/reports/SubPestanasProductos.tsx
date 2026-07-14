"use client";

import React, { useState, useEffect, useTransition } from "react";
import { getRentabilidadProductos, getReposicionProductos, getSinMovimientoProductos } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import { RefreshCw, TrendingUp, Package, Truck, Ban, Printer } from "lucide-react";
import DataTable from "@/components/ui/DataTable";

type SubTabId = "resumen" | "rentabilidad" | "reposicion" | "sinMovimiento";

const SUB_TABS: { id: SubTabId; label: string; icon: React.ReactNode }[] = [
  { id: "resumen", label: "Resumen", icon: <Package size={14} /> },
  { id: "rentabilidad", label: "Rentabilidad", icon: <TrendingUp size={14} /> },
  { id: "reposicion", label: "Reposición", icon: <Truck size={14} /> },
  { id: "sinMovimiento", label: "Sin Movimiento", icon: <Ban size={14} /> },
];

export default function SubPestanasProductos({ categoriaId, proveedorId }: { categoriaId?: number; proveedorId?: number }) {
  const [activeTab, setActiveTab] = useState<SubTabId>("resumen");
  const [isPending, startTransition] = useTransition();

  const [rentabilidad, setRentabilidad] = useState<any[] | null>(null);
  const [reposicion, setReposicion] = useState<any[] | null>(null);
  const [sinMovimiento, setSinMovimiento] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [printSection, setPrintSection] = useState<string | null>(null);

  useEffect(() => {
    if (printSection) {
      setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
    }
  }, [printSection]);

  const loadTab = (tab: SubTabId) => {
    setActiveTab(tab);
    if (tab === "rentabilidad" && !rentabilidad) {
      setLoading(true);
      startTransition(async () => {
        const r = await getRentabilidadProductos({ categoriaId, proveedorId, page: 1 });
        setRentabilidad(r.data);
        setLoading(false);
      });
    } else if (tab === "reposicion" && !reposicion) {
      setLoading(true);
      startTransition(async () => {
        const r = await getReposicionProductos();
        setReposicion(r.data);
        setLoading(false);
      });
    } else if (tab === "sinMovimiento" && !sinMovimiento) {
      setLoading(true);
      startTransition(async () => {
        const r = await getSinMovimientoProductos({ categoriaId, proveedorId, page: 1 });
        setSinMovimiento(r.data);
        setLoading(false);
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => loadTab(tab.id)}
            className={
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all " +
              (activeTab === tab.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")
            }
          >
            {tab.icon}{tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 print:hidden">
          {isPending && <RefreshCw size={14} className="animate-spin text-slate-400" />}
          <button onClick={() => setPrintSection(activeTab)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
            title="Imprimir esta sección">
            <Printer size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : (
        <>
          <div className="report-section" data-section-id={activeTab} data-print-active={printSection === activeTab || null}>
          {activeTab === "resumen" && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center text-slate-400">
              <p>Seleccioná una subcategoría para ver los datos detallados.</p>
            </div>
          )}

          {activeTab === "rentabilidad" && rentabilidad && (
            <DataTable
              columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "P. Compra", accessor: (r: any) => formatCurrency(r.precioCompra), className: "text-right" },
                { header: "P. Venta", accessor: (r: any) => formatCurrency(r.precioVenta), className: "text-right" },
                { header: "Margen %", accessor: (r: any) => r.margenPorc + "%", className: "text-right text-emerald-400" },
                { header: "Vendido", accessor: (r: any) => r.vendido + " uds.", className: "text-right" },
              ]}
              data={rentabilidad}
              keyExtractor={(r: any) => r.id}
              emptyMessage="Sin datos de rentabilidad."
            />
          )}

          {activeTab === "reposicion" && reposicion && (
            <DataTable
              columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Stock", accessor: "stockActual", className: "text-right text-amber-400" },
                { header: "Stock Mín.", accessor: "stockMinimo", className: "text-right" },
                { header: "Proveedor", accessor: "proveedor" },
                { header: "Sugerencia", accessor: (r: any) => r.sugerencia + " uds.", className: "text-right text-emerald-400" },
              ]}
              data={reposicion}
              keyExtractor={(r: any) => r.id}
              emptyMessage="No hay productos por reponer."
            />
          )}

          {activeTab === "sinMovimiento" && sinMovimiento && (
            <DataTable
              columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "Stock", accessor: "stockActual", className: "text-right" },
                { header: "P. Venta", accessor: (r: any) => formatCurrency(r.precioVenta), className: "text-right" },
                { header: "Últ. Venta", accessor: (r: any) => r.ultimaVenta || "\u2014" },
              ]}
              data={sinMovimiento}
              keyExtractor={(r: any) => r.id}
              emptyMessage="No hay productos sin movimiento."
            />
          )}
        </div>
        </>
      )}
    </div>
  );
}
