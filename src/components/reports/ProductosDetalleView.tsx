"use client";

import React, { useState, useMemo } from "react";
import type { ReporteProducto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

interface Props {
  productos: ReporteProducto[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
}

type SortField = "nombre" | "precioVenta" | "precioCompra" | "cantidad";
type SortOrder = "asc" | "desc";
type StockFilter = "todos" | "normal" | "bajo" | "sinStock";
type EstadoFilter = "todos" | "activos" | "inactivos";

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const selectTriggerClass =
  "h-10 w-full bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

export default function ProductosDetalleView({
  productos,
  categorias,
  proveedores,
}: Props) {
  // Filtros
  const [search, setSearch] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("todas");
  const [proveedorId, setProveedorId] = useState<string>("todos");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [stockFilter, setStockFilter] = useState<StockFilter>("todos");

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>("nombre");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Filtrado combinable
  const filtered = useMemo(() => {
    return productos.filter((p) => {
      // 1. Buscador (nombre o código)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNombre = p.nombre.toLowerCase().includes(q);
        const matchCodigo = p.codigo ? p.codigo.toLowerCase().includes(q) : false;
        if (!matchNombre && !matchCodigo) return false;
      }

      // 2. Categoría
      if (categoriaId !== "todas") {
        if (p.categoriaId !== undefined) {
          if (p.categoriaId !== Number(categoriaId)) return false;
        } else {
          const catNombre = categorias.find((c) => c.id === Number(categoriaId))?.nombre;
          if (catNombre && p.categoria !== catNombre) return false;
        }
      }

      // 3. Proveedor
      if (proveedorId !== "todos") {
        if (p.proveedorId !== undefined) {
          if (p.proveedorId !== Number(proveedorId)) return false;
        } else {
          const provNombre = proveedores.find((pr) => pr.id === Number(proveedorId))?.nombre;
          if (provNombre && p.proveedor !== provNombre) return false;
        }
      }

      // 4. Estado administrativo (activo/inactivo)
      if (estadoFilter === "activos" && !p.activo) return false;
      if (estadoFilter === "inactivos" && p.activo) return false;

      // 5. Stock (normal / bajo / sinStock) - las alertas de reposición solo aplican a activos
      if (stockFilter === "sinStock" && (!p.activo || p.cantidad !== 0)) return false;
      if (stockFilter === "bajo" && (!p.activo || p.cantidad === 0 || p.cantidad > p.stockMinimo)) return false;
      if (stockFilter === "normal" && (!p.activo || p.cantidad <= p.stockMinimo)) return false;

      return true;
    });
  }, [productos, search, categoriaId, proveedorId, estadoFilter, stockFilter, categorias, proveedores]);

  // Ordenación
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "nombre":
          cmp = a.nombre.localeCompare(b.nombre);
          break;
        case "precioVenta":
          cmp = a.precioVenta - b.precioVenta;
          break;
        case "precioCompra":
          cmp = a.precioCompra - b.precioCompra;
          break;
        case "cantidad":
          cmp = a.cantidad - b.cantidad;
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortOrder]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const hasActiveFilters =
    Boolean(search) ||
    categoriaId !== "todas" ||
    proveedorId !== "todos" ||
    estadoFilter !== "todos" ||
    stockFilter !== "todos";

  const resetFilters = () => {
    setSearch("");
    setCategoriaId("todas");
    setProveedorId("todos");
    setEstadoFilter("todos");
    setStockFilter("todos");
    setPage(1);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-[var(--text-muted)] opacity-50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={12} className="text-[var(--brand)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--brand)]" />
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <h3 className={sectionHeaderClass}>Detalle de Productos</h3>
      </div>

      {/* 2. Contenedor integrado */}
      <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
        {/* Barra de filtros */}
        <div className="print:hidden p-4 border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)]/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Buscador */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Buscar producto
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Nombre o código..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Categoría
              </label>
              <Select
                value={categoriaId}
                onValueChange={(v) => {
                  setCategoriaId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Proveedor */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Proveedor
              </label>
              <Select
                value={proveedorId}
                onValueChange={(v) => {
                  setProveedorId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los proveedores</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Estado
              </label>
              <Select
                value={estadoFilter}
                onValueChange={(v) => {
                  setEstadoFilter(v as EstadoFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nivel de Stock */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Nivel de Stock
              </label>
              <Select
                value={stockFilter}
                onValueChange={(v) => {
                  setStockFilter(v as StockFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Todos los niveles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los niveles</SelectItem>
                  <SelectItem value="normal">Normal (suficiente)</SelectItem>
                  <SelectItem value="bajo">Bajo (por debajo del mínimo)</SelectItem>
                  <SelectItem value="sinStock">Sin stock (0 unidades)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador y limpiar filtros */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
            <span>
              Mostrando <strong>{filtered.length}</strong> de <strong>{productos.length}</strong> productos
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[var(--brand)] hover:underline font-semibold"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                <th
                  onClick={() => handleSort("nombre")}
                  aria-label="Ordenar por Producto"
                  title="Ordenar por Producto"
                  className={
                    "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                    tableCellHeader
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    Producto
                    {renderSortIndicator("nombre")}
                  </span>
                </th>
                <th className={"text-left " + tableCellHeader}>Categoría</th>
                <th className={"text-left " + tableCellHeader}>Proveedor</th>
                <th
                  onClick={() => handleSort("precioCompra")}
                  aria-label="Ordenar por Costo Unitario"
                  title="Ordenar por Costo Unitario"
                  className={
                    "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                    tableCellHeader
                  }
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Costo unitario
                    {renderSortIndicator("precioCompra")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("precioVenta")}
                  aria-label="Ordenar por Precio de Venta"
                  title="Ordenar por Precio de Venta"
                  className={
                    "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                    tableCellHeader
                  }
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Precio venta
                    {renderSortIndicator("precioVenta")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("cantidad")}
                  aria-label="Ordenar por Stock Actual"
                  title="Ordenar por Stock Actual"
                  className={
                    "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                    tableCellHeader
                  }
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Stock actual
                    {renderSortIndicator("cantidad")}
                  </span>
                </th>
                <th className={"text-center " + tableCellHeader}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No se encontraron productos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const isSinStock = p.activo && p.cantidad === 0;
                  const isStockBajo = p.activo && p.cantidad > 0 && p.cantidad <= p.stockMinimo;
                  return (
                    <tr key={p.id} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              !p.activo
                                ? "bg-gray-500/40"
                                : isSinStock
                                ? "bg-red-500"
                                : isStockBajo
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <div
                            className={`font-semibold ${
                              !p.activo
                                ? "text-[var(--text-muted)]"
                                : isSinStock
                                ? "text-red-300"
                                : isStockBajo
                                ? "text-amber-300"
                                : "text-white"
                            }`}
                          >
                            {p.nombre}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.categoria}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{p.proveedor}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                        {formatCurrency(p.precioCompra)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">
                        {formatCurrency(p.precioVenta)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span
                          className={
                            !p.activo
                              ? "text-[var(--text-muted)]"
                              : isSinStock
                              ? "text-red-400"
                              : isStockBajo
                              ? "text-amber-400"
                              : "text-white"
                          }
                        >
                          {p.cantidad}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.activo ? "success" : "danger"}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación */}
        {sorted.length > 0 && (
          <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{" "}
                <strong className="text-[var(--text)]">
                  {Math.min((currentPage - 1) * pageSize + 1, sorted.length)}
                </strong>{" "}
                a{" "}
                <strong className="text-[var(--text)]">
                  {Math.min(currentPage * pageSize, sorted.length)}
                </strong>{" "}
                de <strong className="text-[var(--text)]">{sorted.length}</strong> productos
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
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                  title="Primera página"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                  title="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                  title="Página siguiente"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                  title="Última página"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
