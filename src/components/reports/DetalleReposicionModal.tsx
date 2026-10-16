"use client";

import React, { useState, useMemo } from "react";
import type { ProveedorReposicionRow } from "@/actions/informes";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Truck,
  Package,
  Search,
  AlertTriangle,
  AlertCircle,
  Boxes,
} from "lucide-react";

interface Props {
  proveedorNombre: string;
  productos: ProveedorReposicionRow[];
  aReponer: number;
  sinStock: number;
  stockBajo: number;
  onClose: () => void;
}

export default function DetalleReposicionModal({
  proveedorNombre,
  productos,
  aReponer,
  sinStock,
  stockBajo,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");

  const productosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.producto.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q)
    );
  }, [productos, search]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[var(--panel)] border border-[var(--border)] w-full max-w-3xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base uppercase shrink-0">
              <Truck size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--text)] truncate">
                Reposición — {proveedorNombre}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {aReponer} producto(s) por debajo del stock mínimo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-hover)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Ficha KPI de Reposición */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
              <p className="text-xs text-[var(--text-muted)] font-medium mb-1 flex items-center justify-center gap-1.5">
                <Boxes size={14} className="text-[var(--brand)]" />
                Total a Reponer
              </p>
              <p className="text-lg font-bold text-[var(--brand)]">{aReponer}</p>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
              <p className="text-xs text-[var(--text-muted)] font-medium mb-1 flex items-center justify-center gap-1.5">
                <AlertTriangle size={14} className="text-[var(--danger)]" />
                Sin Stock (Crítico)
              </p>
              <p className="text-lg font-bold text-[var(--danger)]">{sinStock}</p>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 text-center">
              <p className="text-xs text-[var(--text-muted)] font-medium mb-1 flex items-center justify-center gap-1.5">
                <AlertCircle size={14} className="text-amber-400" />
                Stock Bajo
              </p>
              <p className="text-lg font-bold text-amber-400">{stockBajo}</p>
            </div>
          </div>

          {/* Tabla de Productos a Reponer */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-[var(--brand)]" />
                Detalle de Productos a Reponer ({productos.length})
              </h3>
              {productos.length > 5 && (
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>
              )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              {productosFiltrados.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] text-center py-8">
                  {productos.length === 0
                    ? "No hay productos que requieran reposición para este proveedor."
                    : "No se encontraron productos coincidentes con la búsqueda."}
                </p>
              ) : (
                <div className="overflow-x-auto max-h-72 scrollbar-thin">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] z-10">
                      <tr className="whitespace-nowrap">
                        <th className="px-3 py-2.5 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Producto</th>
                        <th className="px-3 py-2.5 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Código</th>
                        <th className="px-3 py-2.5 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Categoría</th>
                        <th className="px-3 py-2.5 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Marca</th>
                        <th className="px-3 py-2.5 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock Actual</th>
                        <th className="px-3 py-2.5 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Mínimo</th>
                        <th className="px-3 py-2.5 text-right font-bold text-amber-400 uppercase tracking-wider">Déficit</th>
                        <th className="px-3 py-2.5 text-center font-bold text-[var(--text-muted)] uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {productosFiltrados.map((d) => (
                        <tr key={d.proveedorId + d.codigo + d.producto} className="hover:bg-[var(--border)]/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-[var(--text)]">{d.producto}</td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{d.codigo}</td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{d.categoria}</td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{d.marca}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-[var(--text)]">{d.stockActual}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">{d.stockMinimo}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-400">+{d.deficit}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant={d.estado === "Sin stock" ? "danger" : "warning"}>{d.estado}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--card)] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--border)] hover:bg-[var(--border-hover)] text-[var(--text)] text-xs font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
