"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { ReporteProducto, ReposicionProductosData } from "@/actions/informes";
import { getReposicionProductosData } from "@/actions/informes";
import { formatDate } from "@/lib/utils";
import ProductosAnalisisView from "./ProductosAnalisisView";
import ProductosDetalleView from "./ProductosDetalleView";
import ProductosReposicionView from "./ProductosReposicionView";
import ProductosSinMovimientoView from "./ProductosSinMovimientoView";
import { RefreshCw } from "lucide-react";

interface Props {
  initialData: ReporteProducto[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
  userRole?: string;
}

type SubViewId = "analisis" | "detalle" | "reposicion" | "sin_movimiento";

export default function ProductosReport({
  initialData,
  categorias,
  proveedores,
}: Props) {
  const [activeSubView, setActiveSubView] = useState<SubViewId>("analisis");
  const [productos] = useState<ReporteProducto[]>(initialData);

  // Datos de reposición
  const [reposicionData, setReposicionData] = useState<ReposicionProductosData>({
    resumenProveedores: [],
    productos: [],
    totalProductosAReponer: 0,
    totalProveedoresPendientes: 0,
  });
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [repoLoaded, setRepoLoaded] = useState(false);
  const [, startTransition] = useTransition();

  // Carga diferida de reposición al activarse
  useEffect(() => {
    if (!repoLoaded && activeSubView === "reposicion") {
      setLoadingRepo(true);
      startTransition(async () => {
        const data = await getReposicionProductosData();
        setReposicionData(data);
        setLoadingRepo(false);
        setRepoLoaded(true);
      });
    }
  }, [repoLoaded, activeSubView]);

  return (
    <div className="space-y-4">
      {/* Selector de sub-vista idéntico al resto de los informes */}
      <div className="print:hidden flex flex-wrap gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-1">
        {(["analisis", "detalle", "reposicion", "sin_movimiento"] as SubViewId[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setActiveSubView(v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubView === v
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            {v === "analisis"
              ? "Análisis"
              : v === "detalle"
              ? "Detalle de productos"
              : v === "reposicion"
              ? "Reposición"
              : "Productos sin movimiento"}
          </button>
        ))}

        {loadingRepo && activeSubView === "reposicion" && (
          <div className="ml-auto flex items-center gap-1.5 px-3 text-xs text-[var(--text-muted)]">
            <RefreshCw size={13} className="animate-spin text-[var(--brand)]" />
            <span>Actualizando reposición...</span>
          </div>
        )}
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">
            Informe de Productos —{" "}
            {activeSubView === "analisis"
              ? "Análisis"
              : activeSubView === "detalle"
              ? "Detalle de Productos"
              : activeSubView === "reposicion"
              ? "Reposición"
              : "Productos sin Movimiento"}
          </p>
          <p className="text-xs text-gray-500">Generado: {formatDate(new Date())}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* Contenido según submódulo activo */}
        {activeSubView === "analisis" && (
          <ProductosAnalisisView
            productos={productos}
            categorias={categorias}
          />
        )}

        {activeSubView === "detalle" && (
          <ProductosDetalleView
            productos={productos}
            categorias={categorias}
            proveedores={proveedores}
          />
        )}

        {activeSubView === "reposicion" && (
          <ProductosReposicionView
            productos={reposicionData.productos}
            resumenProveedores={reposicionData.resumenProveedores}
            categorias={categorias}
            proveedores={proveedores}
          />
        )}

        {activeSubView === "sin_movimiento" && (
          <ProductosSinMovimientoView />
        )}
      </div>
    </div>
  );
}
