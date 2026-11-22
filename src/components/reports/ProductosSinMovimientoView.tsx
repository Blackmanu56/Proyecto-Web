"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import type {
  ProductosSinMovimientoStats,
  ProductoSinVentaRow,
  ProductoNuncaVendidoRow,
} from "@/actions/informes";
import { getProductosSinMovimientoStats } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Search,
  RefreshCw,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

export default function ProductosSinMovimientoView() {
  const [dias, setDias] = useState<number>(90);
  const [modo, setModo] = useState<"recientes" | "nunca">("recientes");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<ProductosSinMovimientoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Cargar datos al cambiar los días
  useEffect(() => {
    setLoading(true);
    startTransition(async () => {
      const data = await getProductosSinMovimientoStats(dias);
      setStats(data);
      setLoading(false);
    });
  }, [dias]);

  // Filtrado por buscador
  const listaSinVentas = useMemo(() => {
    if (!stats) return [];
    if (!search.trim()) return stats.productosSinVentas;
    const q = search.trim().toLowerCase();
    return stats.productosSinVentas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        p.categoria.toLowerCase().includes(q) ||
        p.proveedor.toLowerCase().includes(q)
    );
  }, [stats, search]);

  const listaNuncaVendidos = useMemo(() => {
    if (!stats) return [];
    if (!search.trim()) return stats.productosNuncaVendidos;
    const q = search.trim().toLowerCase();
    return stats.productosNuncaVendidos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        p.categoria.toLowerCase().includes(q) ||
        p.proveedor.toLowerCase().includes(q)
    );
  }, [stats, search]);

  const listaActual = modo === "recientes" ? listaSinVentas : listaNuncaVendidos;
  const totalItems = listaActual.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return listaActual.slice(start, start + pageSize);
  }, [listaActual, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* 1. Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <h3 className={sectionHeaderClass}>
          {modo === "recientes"
            ? `Productos sin ventas en los últimos ${dias} días`
            : "Productos registrados que nunca se vendieron"}
        </h3>
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <RefreshCw size={13} className="animate-spin text-[var(--brand)]" />
            <span>Consultando historial...</span>
          </div>
        )}
      </div>

      {/* 2. Contenedor principal integrado */}
      <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
        {/* Controles: switch de modo + selector de días + buscador */}
        <div className="print:hidden p-4 border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)]/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Switch de modo: Sin ventas recientes / Nunca vendidos */}
            <div className="flex items-center gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setModo("recientes");
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  modo === "recientes"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Sin ventas recientes ({stats?.sinVentasRecientes ?? 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo("nunca");
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  modo === "nunca"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Nunca vendidos ({stats?.nuncaVendidos ?? 0})
              </button>
            </div>

            {/* Selector de días (solo en modo recientes) */}
            {modo === "recientes" && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--text-muted)]" />
                <span className="text-xs font-semibold text-[var(--text-muted)]">Período sin ventas:</span>
                <Select
                  value={String(dias)}
                  onValueChange={(v) => {
                    setDias(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs bg-[var(--card)] border border-[var(--border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="60">60 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                    <SelectItem value="180">180 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Buscador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Buscar producto
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o categoría..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
          </div>

          {/* Indicador de resultados */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
            <span>
              Mostrando <strong>{totalItems}</strong> productos
            </span>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="text-[var(--brand)] hover:underline font-semibold"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        </div>

        {/* 3. Tablas según el modo */}
        <div className="overflow-x-auto scrollbar-thin">
          {modo === "recientes" ? (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                  <th className={tableCellHeader + " text-left"}>Producto</th>
                  <th className={tableCellHeader + " text-left"}>Categoría</th>
                  <th className={tableCellHeader + " text-left"}>Proveedor</th>
                  <th className={tableCellHeader + " text-right"}>Stock actual</th>
                  <th className={tableCellHeader + " text-right"}>Precio venta</th>
                  <th className={tableCellHeader + " text-left"}>Última venta</th>
                  <th className={tableCellHeader + " text-right"}>Días sin vender</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      {loading
                        ? "Cargando productos..."
                        : search
                        ? "No se encontraron productos que coincidan con la búsqueda."
                        : `No hay productos con más de ${dias} días sin ventas registradas.`}
                    </td>
                  </tr>
                ) : (
                  (paginatedItems as ProductoSinVentaRow[]).map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--text)]">{p.nombre}</div>
                        {p.codigo && (
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">{p.codigo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.categoria}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.proveedor}</td>
                      <td className="px-4 py-3 text-right font-medium">{p.stockActual}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text)] font-mono">
                        {formatCurrency(p.precioVenta)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {p.ultimaVentaFormateada || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400">
                          {p.diasSinVenta} días
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                  <th className={tableCellHeader + " text-left"}>Producto</th>
                  <th className={tableCellHeader + " text-left"}>Categoría</th>
                  <th className={tableCellHeader + " text-left"}>Proveedor</th>
                  <th className={tableCellHeader + " text-right"}>Stock actual</th>
                  <th className={tableCellHeader + " text-right"}>Precio venta</th>
                  <th className={tableCellHeader + " text-left"}>Primer registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      {loading
                        ? "Cargando productos..."
                        : search
                        ? "No se encontraron productos que coincidan con la búsqueda."
                        : "No hay productos registrados que nunca se hayan vendido."}
                    </td>
                  </tr>
                ) : (
                  (paginatedItems as ProductoNuncaVendidoRow[]).map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--text)]">{p.nombre}</div>
                        {p.codigo && (
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">{p.codigo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.categoria}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.proveedor}</td>
                      <td className="px-4 py-3 text-right font-medium">{p.stockActual}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text)] font-mono">
                        {formatCurrency(p.precioVenta)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {p.primerMovimientoFormateado || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. Nota sobre altas recientes */}
        {stats && stats.creadosRecientemente > 0 && (
          <div className="px-4 py-2 bg-[var(--panel)]/30 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
            * Se han excluido <strong>{stats.creadosRecientemente}</strong> producto(s) creados recientemente en los últimos {dias} días para no clasificarlos erróneamente como inactivos.
          </div>
        )}

        {/* 5. Barra de paginación */}
        {totalItems > 0 && (
          <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{" "}
                <strong className="text-[var(--text)]">
                  {Math.min((currentPage - 1) * pageSize + 1, totalItems)}
                </strong>{" "}
                a{" "}
                <strong className="text-[var(--text)]">
                  {Math.min(currentPage * pageSize, totalItems)}
                </strong>{" "}
                de <strong className="text-[var(--text)]">{totalItems}</strong> productos
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Filas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Primera página"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Página anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Página siguiente"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Última página"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
