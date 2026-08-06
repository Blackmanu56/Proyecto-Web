"use client";

import React, { useState, useEffect, useTransition } from "react";
import { getRentabilidadProductos, getReposicionProductos, getSinMovimientoProductos } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import { RefreshCw, TrendingUp, Package, Truck, Ban, Printer } from "lucide-react";
import DataTable from "@/components/ui/DataTable";

type SubTabId = "resumen" | "rentabilidad" | "reposicion" | "sinMovimiento";
type RentabilidadRow = Awaited<ReturnType<typeof getRentabilidadProductos>>["data"][number];
type ReposicionRow = Awaited<ReturnType<typeof getReposicionProductos>>["data"][number];
type SinMovimientoRow = Awaited<ReturnType<typeof getSinMovimientoProductos>>["data"][number];

const SUB_TABS: { id: SubTabId; label: string; icon: React.ReactNode }[] = [
  { id: "resumen", label: "Resumen", icon: <Package size={14} /> },
  { id: "rentabilidad", label: "Rentabilidad", icon: <TrendingUp size={14} /> },
  { id: "reposicion", label: "Reposición", icon: <Truck size={14} /> },
  { id: "sinMovimiento", label: "Sin Movimiento", icon: <Ban size={14} /> },
];

export default function SubPestanasProductos({ categoriaId, proveedorId }: { categoriaId?: number; proveedorId?: number }) {
  const [activeTab, setActiveTab] = useState<SubTabId>("resumen");
  const [isPending, startTransition] = useTransition();

  const [rentabilidad, setRentabilidad] = useState<RentabilidadRow[] | null>(null);
  const [reposicion, setReposicion] = useState<ReposicionRow[] | null>(null);
  const [sinMovimiento, setSinMovimiento] = useState<SinMovimientoRow[] | null>(null);
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
      <div className="flex flex-wrap gap-1 bg-panel border border-border rounded-xl p-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => loadTab(tab.id)}
            className={
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all " +
              (activeTab === tab.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-text-muted hover:text-text hover:bg-border/50")
            }
          >
            {tab.icon}{tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 print:hidden">
          {isPending && <RefreshCw size={14} className="animate-spin text-text-muted" />}
          <button onClick={() => setPrintSection(activeTab)}
            className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
            title="Imprimir esta sección">
            <Printer size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <RefreshCw size={20} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : (
        <>
          <div className="report-section" data-section-id={activeTab} data-print-active={printSection === activeTab || null}>
          {activeTab === "resumen" && (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-text-muted">
              <p>Seleccioná una subcategoría para ver los datos detallados.</p>
            </div>
          )}

          {activeTab === "rentabilidad" && rentabilidad && (
            <DataTable
              columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "P. Compra", accessor: (r: RentabilidadRow) => formatCurrency(r.precioCompra), className: "text-right" },
                { header: "P. Venta", accessor: (r: RentabilidadRow) => formatCurrency(r.precioVenta), className: "text-right" },
                { header: "Margen %", accessor: (r: RentabilidadRow) => r.margenPorc + "%", className: "text-right text-emerald-400" },
                { header: "Vendido", accessor: (r: RentabilidadRow) => r.vendido + " uds.", className: "text-right" },
              ]}
              data={rentabilidad}
              keyExtractor={(r: RentabilidadRow) => r.id}
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
                { header: "Sugerencia", accessor: (r: ReposicionRow) => r.sugerencia + " uds.", className: "text-right text-emerald-400" },
              ]}
              data={reposicion}
              keyExtractor={(r: ReposicionRow) => r.id}
              emptyMessage="No hay productos por reponer."
            />
          )}

          {activeTab === "sinMovimiento" && sinMovimiento && (
            <DataTable
              columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "Stock", accessor: "stockActual", className: "text-right" },
                { header: "P. Venta", accessor: (r: SinMovimientoRow) => formatCurrency(r.precioVenta), className: "text-right" },
                { header: "Últ. Venta", accessor: (r: SinMovimientoRow) => r.ultimaVenta || "\u2014" },
              ]}
              data={sinMovimiento}
              keyExtractor={(r: SinMovimientoRow) => r.id}
              emptyMessage="No hay productos sin movimiento."
            />
          )}
        </div>
        </>
      )}
    </div>
  );
}
