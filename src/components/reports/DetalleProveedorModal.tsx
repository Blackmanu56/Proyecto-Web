"use client";

import React, { useState, useMemo } from "react";
import type { ProveedorTablaRow, ProveedorProductoRow } from "@/actions/informes";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Building,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Search,
  DollarSign,
  AlertCircle,
  Truck,
  Layers,
} from "lucide-react";

interface Props {
  proveedor: ProveedorTablaRow;
  repoInfo?: { aReponer: number; sinStock: number; stockBajo: number };
  valorCosto: number;
  onClose: () => void;
}

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

  const sinStockP = useMemo(
    () => proveedor.productos.filter((p) => p.cantidad === 0).length,
    [proveedor.productos]
  );
  const stockBajoP = useMemo(
    () => proveedor.productos.filter((p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo).length,
    [proveedor.productos]
  );
  const normalesP = useMemo(
    () => proveedor.productos.filter((p) => p.cantidad > p.stockMinimo).length,
    [proveedor.productos]
  );

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

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[var(--panel)] border border-[var(--border)] w-full max-w-3xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center font-bold text-base uppercase shrink-0">
              <Building size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[var(--text)] truncate">
                  {proveedor.nombre}
                </h2>
                <Badge variant={proveedor.activo ? "success" : "danger"}>
                  {proveedor.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">CUIT: {proveedor.cuit}</p>
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
          {/* Ficha de Información de Contacto */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building size={14} className="text-[var(--brand)]" />
              Información de Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Phone size={12} /> Teléfono
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block">
                  {proveedor.telefono || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Mail size={12} /> Email
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block">
                  {proveedor.email || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <MapPin size={12} /> Dirección
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block">
                  {proveedor.direccion || "—"}
                </span>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <User size={12} /> Contacto
                </span>
                <span className="text-xs font-bold text-[var(--text)] truncate block">
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

          {/* Resumen de Stock y Compras */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers size={14} className="text-[var(--brand)]" />
              Resumen de Stock y Compras
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">Suministrados</p>
                <p className="text-sm font-bold text-[var(--text)]">{proveedor.productos.length}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">Stock Normal</p>
                <p className="text-sm font-bold text-[var(--success)]">{normalesP}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">Stock Bajo</p>
                <p className="text-sm font-bold text-amber-400">{stockBajoP}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">Sin Stock</p>
                <p className="text-sm font-bold text-[var(--danger)]">{sinStockP}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">A Reponer</p>
                <p className="text-sm font-bold text-[var(--brand)]">{repoInfo?.aReponer ?? 0}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-0.5">Total Compras</p>
                <p className="text-sm font-bold text-[var(--text)]">{proveedor.totalCompras}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-muted)] block">Valor Inventario a Costo</span>
                  <span className="text-xs text-[var(--text-secondary)]">Stock actual valuado a costo</span>
                </div>
                <span className="text-sm font-bold text-[var(--text)]">{formatCurrency(valorCosto)}</span>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-muted)] block">Total Gastado en Compras</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Última compra: {proveedor.ultimaCompra ? formatDateShort(new Date(proveedor.ultimaCompra)) : "—"}
                  </span>
                </div>
                <span className="text-sm font-bold text-[var(--success)]">{formatCurrency(proveedor.totalGastado)}</span>
              </div>
            </div>
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
                        <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Producto</th>
                        <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Código</th>
                        <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Categoría</th>
                        <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Marca</th>
                        <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock Actual</th>
                        <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Mínimo</th>
                        <th className="px-3 py-2 text-center font-bold text-[var(--text-muted)] uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {productosFiltrados.map((p: ProveedorProductoRow) => {
                        const es = estadoStock(p.cantidad, p.stockMinimo);
                        return (
                          <tr key={p.nombre + p.codigo} className="hover:bg-[var(--border)]/30 transition-colors">
                            <td className="px-3 py-2 font-medium text-[var(--text)]">{p.nombre}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{p.codigo}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{p.categoria}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{p.marca}</td>
                            <td className="px-3 py-2 text-right font-bold text-[var(--text)]">{p.cantidad}</td>
                            <td className="px-3 py-2 text-right text-[var(--text-muted)]">{p.stockMinimo}</td>
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
