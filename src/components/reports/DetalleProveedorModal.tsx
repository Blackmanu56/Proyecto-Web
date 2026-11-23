"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ProveedorTablaRow, ProveedorProductoRow } from "@/actions/informes";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Search,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";

interface Props {
  proveedor: ProveedorTablaRow;
  repoInfo?: { aReponer: number; sinStock: number; stockBajo: number };
  valorCosto: number;
  onClose: () => void;
}

type SortKeyModal = "nombre" | "categoria" | "marca" | "cantidad" | "stockMinimo" | "estado";
type SortDir = "asc" | "desc";

const DEFAULT_SORT_DIR_MODAL: Record<SortKeyModal, SortDir> = {
  nombre: "asc",
  categoria: "asc",
  marca: "asc",
  cantidad: "desc",
  stockMinimo: "desc",
  estado: "asc",
};

// Helper para determinar el estado de stock
function estadoStock(cantidad: number, stockMinimo: number): { label: string; variant: "success" | "warning" | "danger" } {
  if (cantidad === 0) return { label: "Sin stock", variant: "danger" };
  if (cantidad <= stockMinimo) return { label: "Stock bajo", variant: "warning" };
  return { label: "Normal", variant: "success" };
}

export default function DetalleProveedorModal({
  proveedor,
  repoInfo,
  valorCosto,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKeyModal | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKeyModal) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR_MODAL[key]);
    } else {
      const defaultDir = DEFAULT_SORT_DIR_MODAL[key];
      if (sortDir === defaultDir) {
        setSortDir(defaultDir === "desc" ? "asc" : "desc");
      } else {
        setSortKey(null);
        setSortDir(defaultDir);
      }
    }
  };

  const renderSortIndicator = (key: SortKeyModal) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="text-[var(--text-muted)] opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[var(--brand)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--brand)]" />
    );
  };

  const productosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proveedor.productos;
    return proveedor.productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q)
    );
  }, [proveedor.productos, search]);

  const productosOrdenados = useMemo(() => {
    if (!sortKey) return productosFiltrados;
    return [...productosFiltrados].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nombre":
          cmp = a.nombre.localeCompare(b.nombre);
          break;
        case "categoria":
          cmp = a.categoria.localeCompare(b.categoria);
          break;
        case "marca":
          cmp = a.marca.localeCompare(b.marca);
          break;
        case "cantidad":
          cmp = a.cantidad - b.cantidad;
          break;
        case "stockMinimo":
          cmp = a.stockMinimo - b.stockMinimo;
          break;
        case "estado": {
          const estadoA = estadoStock(a.cantidad, a.stockMinimo).label;
          const estadoB = estadoStock(b.cantidad, b.stockMinimo).label;
          cmp = estadoA.localeCompare(estadoB);
          break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [productosFiltrados, sortKey, sortDir]);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0 pr-12">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center font-bold text-base uppercase shrink-0 ring-1 ring-[var(--brand)]/20">
              <Building size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-bold text-[var(--text)] truncate">
                  {proveedor.nombre}
                </DialogTitle>
                <Badge variant={proveedor.activo ? "success" : "danger"}>
                  {proveedor.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-[var(--text-muted)] font-mono">
                CUIT: {proveedor.cuit}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body scrollable con barra de desplazamiento */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* Ficha de Información de Contacto */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building size={14} className="text-[var(--brand)]" />
              Información de Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Phone size={12} /> Teléfono
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block">
                  {proveedor.telefono || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Mail size={12} /> Email
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block" title={proveedor.email || ""}>
                  {proveedor.email || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <MapPin size={12} /> Dirección
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block" title={proveedor.direccion || ""}>
                  {proveedor.direccion || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <User size={12} /> Contacto
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block" title={proveedor.contactoResponsable || ""}>
                  {proveedor.contactoResponsable || "—"}
                </span>
              </div>
            </div>

            {/* Acciones sugeridas */}
            {proveedor.acciones.length > 0 && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertCircle size={14} /> Acciones Sugeridas
                </span>
                {proveedor.acciones.map((a, idx) => (
                  <p key={idx} className="text-xs text-amber-300 font-medium pl-5">
                    • {a}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Productos Suministrados */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-[var(--brand)]" />
                Productos Suministrados ({proveedor.productos.length})
              </h3>
              {proveedor.productos.length > 5 && (
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
                <p className="text-xs text-[var(--text-secondary)] text-center py-6">
                  {proveedor.productos.length === 0
                    ? "Sin productos asociados a este proveedor."
                    : "No se encontraron productos coincidentes."}
                </p>
              ) : (
                <div className="overflow-x-auto max-h-64 scrollbar-thin">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] z-10">
                      <tr className="whitespace-nowrap">
                        <th onClick={() => handleSort("nombre")} className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center gap-1">
                            Producto
                            {renderSortIndicator("nombre")}
                          </span>
                        </th>
                        <th onClick={() => handleSort("categoria")} className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center gap-1">
                            Categoría
                            {renderSortIndicator("categoria")}
                          </span>
                        </th>
                        <th onClick={() => handleSort("marca")} className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center gap-1">
                            Marca
                            {renderSortIndicator("marca")}
                          </span>
                        </th>
                        <th onClick={() => handleSort("cantidad")} className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center justify-end gap-1">
                            Stock Actual
                            {renderSortIndicator("cantidad")}
                          </span>
                        </th>
                        <th onClick={() => handleSort("stockMinimo")} className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center justify-end gap-1">
                            Mínimo
                            {renderSortIndicator("stockMinimo")}
                          </span>
                        </th>
                        <th onClick={() => handleSort("estado")} className="px-3 py-2 text-center font-bold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text)] transition-colors">
                          <span className="inline-flex items-center justify-center gap-1">
                            Estado
                            {renderSortIndicator("estado")}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {productosOrdenados.map((p: ProveedorProductoRow) => {
                        const es = estadoStock(p.cantidad, p.stockMinimo);
                        return (
                          <tr key={p.nombre + p.codigo} className="hover:bg-[var(--border)]/30 transition-colors">
                            <td className="px-3 py-2 font-medium text-[var(--text)]">{p.nombre}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{p.categoria}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{p.marca}</td>
                            <td className="px-3 py-2 text-right font-bold text-[var(--text)] font-mono">{p.cantidad}</td>
                            <td className="px-3 py-2 text-right text-[var(--text-muted)] font-mono">{p.stockMinimo}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={es.variant}>{es.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer fijo abajo */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] flex justify-end shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
