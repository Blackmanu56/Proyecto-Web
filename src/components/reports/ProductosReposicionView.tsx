"use client";

import React, { useState, useMemo } from "react";
import type { ProveedorReposicionRow } from "@/actions/informes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DetalleReposicionModal from "./DetalleReposicionModal";
import {
  Search,
  Eye,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

interface Props {
  productos: ProveedorReposicionRow[];
  resumenProveedores: {
    proveedorId: number;
    proveedor: string;
    aReponer: number;
    sinStock: number;
    stockBajo: number;
  }[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
}

type ReposicionViewMode = "porProducto" | "porProveedor";
type EstadoFiltro = "todos" | "sinStock" | "stockBajo";

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const selectTriggerClass =
  "h-10 w-full bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

export default function ProductosReposicionView({
  productos,
  resumenProveedores,
  categorias,
  proveedores,
}: Props) {
  // Selector de vista
  const [viewMode, setViewMode] = useState<ReposicionViewMode>("porProducto");

  // Filtros de la vista "Por producto"
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFiltro>("todos");
  const [proveedorFilter, setProveedorFilter] = useState<string>("todos");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todas");

  // Paginación vista Por producto
  const [pageProd, setPageProd] = useState(1);
  const [pageSizeProd, setPageSizeProd] = useState(20);

  // Modal de Detalle por Proveedor
  const [selectedProveedor, setSelectedProveedor] = useState<{
    id: number;
    nombre: string;
    aReponer: number;
    sinStock: number;
    stockBajo: number;
  } | null>(null);

  // Filtrado vista "Por producto"
  const filteredProductos = useMemo(() => {
    return productos.filter((p) => {
      // 1. Buscador (por nombre de producto o código)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNombre = p.producto.toLowerCase().includes(q);
        const matchCodigo = p.codigo ? p.codigo.toLowerCase().includes(q) : false;
        if (!matchNombre && !matchCodigo) return false;
      }

      // 2. Estado (Sin stock / Stock bajo)
      if (estadoFilter === "sinStock" && p.stockActual !== 0) return false;
      if (estadoFilter === "stockBajo" && (p.stockActual === 0 || p.stockActual > p.stockMinimo)) return false;

      // 3. Proveedor (filtro por ID o nombre)
      if (proveedorFilter !== "todos") {
        const provMatch =
          p.proveedorId === Number(proveedorFilter) ||
          p.proveedor === proveedores.find((pr) => pr.id === Number(proveedorFilter))?.nombre;
        if (!provMatch) return false;
      }

      // 4. Categoría (filtro por nombre)
      if (categoriaFilter !== "todas") {
        const catNombre = categorias.find((c) => c.id === Number(categoriaFilter))?.nombre;
        if (catNombre && p.categoria !== catNombre) return false;
      }

      return true;
    });
  }, [productos, search, estadoFilter, proveedorFilter, categoriaFilter, categorias, proveedores]);

  // Ordenamiento vista "Por producto": primero Sin stock, luego déficit
  const sortedProductos = useMemo(() => {
    return [...filteredProductos].sort((a, b) => {
      // 0 unidades primero
      if (a.stockActual === 0 && b.stockActual > 0) return -1;
      if (a.stockActual > 0 && b.stockActual === 0) return 1;
      // luego por déficit
      return b.deficit - a.deficit;
    });
  }, [filteredProductos]);

  // Paginación Por producto
  const totalPagesProd = Math.max(1, Math.ceil(sortedProductos.length / pageSizeProd));
  const currentPageProd = Math.min(pageProd, totalPagesProd);
  const paginatedProductos = useMemo(() => {
    const start = (currentPageProd - 1) * pageSizeProd;
    return sortedProductos.slice(start, start + pageSizeProd);
  }, [sortedProductos, currentPageProd, pageSizeProd]);

  // Productos del proveedor seleccionado para el modal
  const productosModal = useMemo(() => {
    if (!selectedProveedor) return [];
    return productos.filter((p) => p.proveedorId === selectedProveedor.id);
  }, [selectedProveedor, productos]);

  const hasActiveFiltersProd =
    Boolean(search) ||
    estadoFilter !== "todos" ||
    proveedorFilter !== "todos" ||
    categoriaFilter !== "todas";

  const resetFiltersProd = () => {
    setSearch("");
    setEstadoFilter("todos");
    setProveedorFilter("todos");
    setCategoriaFilter("todas");
    setPageProd(1);
  };

  return (
    <div className="space-y-4">
      {/* 1. Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <h3 className={sectionHeaderClass}>Reposición de Stock</h3>
      </div>

      {/* 2. Contenedor principal integrado */}
      <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
        {/* Switch de vistas: Por producto | Por proveedor */}
        <div className="print:hidden p-4 border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setViewMode("porProducto");
                setPageProd(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === "porProducto"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Por producto
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("porProveedor");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === "porProveedor"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Por proveedor
            </button>
          </div>

          <span className="text-xs text-[var(--text-muted)] font-medium">
            {viewMode === "porProducto"
              ? `${productos.length} producto(s) a reponer`
              : `${resumenProveedores.length} proveedor(es) con pendientes`}
          </span>
        </div>

        {/* ── A. VISTA POR PRODUCTO (PREDETERMINADA) ── */}
        {viewMode === "porProducto" && (
          <div>
            {/* Filtros Por producto */}
            <div className="print:hidden p-4 border-b border-[var(--border)] bg-[var(--panel)]/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        setPageProd(1);
                      }}
                      className={inputClass + " pl-9"}
                    />
                  </div>
                </div>

                {/* Estado de Reposición */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Estado de stock
                  </label>
                  <Select
                    value={estadoFilter}
                    onValueChange={(v) => {
                      setEstadoFilter(v as EstadoFiltro);
                      setPageProd(1);
                    }}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Todos los pendientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los pendientes</SelectItem>
                      <SelectItem value="sinStock">Sin stock (crítico)</SelectItem>
                      <SelectItem value="stockBajo">Stock bajo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Proveedor */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Proveedor
                  </label>
                  <Select
                    value={proveedorFilter}
                    onValueChange={(v) => {
                      setProveedorFilter(v);
                      setPageProd(1);
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

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Categoría
                  </label>
                  <Select
                    value={categoriaFilter}
                    onValueChange={(v) => {
                      setCategoriaFilter(v);
                      setPageProd(1);
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
              </div>

              {/* Contador */}
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                <span>
                  Mostrando <strong>{filteredProductos.length}</strong> de <strong>{productos.length}</strong> productos que requieren reposición
                </span>
                {hasActiveFiltersProd && (
                  <button
                    type="button"
                    onClick={resetFiltersProd}
                    className="text-[var(--brand)] hover:underline font-semibold"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Tabla Por Producto */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                    <th className={tableCellHeader + " text-left"}>Producto</th>
                    <th className={tableCellHeader + " text-left"}>Categoría</th>
                    <th className={tableCellHeader + " text-left"}>Proveedor</th>
                    <th className={tableCellHeader + " text-right"}>Stock actual / Mín.</th>
                    <th className={tableCellHeader + " text-center"}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                  {paginatedProductos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        {productos.length === 0
                          ? "Todos los productos tienen existencias suficientes. Reposición al día."
                          : "No se encontraron productos que coincidan con los filtros."}
                      </td>
                    </tr>
                  ) : (
                    paginatedProductos.map((p, idx) => {
                      const isSinStock = p.stockActual === 0;
                      return (
                        <tr key={p.codigo ? `${p.codigo}-${idx}` : `${p.producto}-${idx}`} className="hover:bg-[var(--border)]/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSinStock ? "bg-red-500" : "bg-amber-500"
                                }`}
                              />
                              <div>
                                <div className={`font-semibold ${isSinStock ? "text-red-300" : "text-amber-300"}`}>
                                  {p.producto}
                                </div>
                                {p.codigo && p.codigo !== "-" && (
                                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                                    {p.codigo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{p.categoria}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{p.proveedor}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${isSinStock ? "text-red-400" : "text-amber-400"}`}>
                              {p.stockActual}
                            </span>{" "}
                            <span className="text-[var(--text-muted)]">/ {p.stockMinimo}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={isSinStock ? "danger" : "warning"}>
                              {p.estado}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Por Producto */}
            {sortedProductos.length > 0 && (
              <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--panel)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span>
                    Mostrando{" "}
                    <strong className="text-[var(--text)]">
                      {Math.min((currentPageProd - 1) * pageSizeProd + 1, sortedProductos.length)}
                    </strong>{" "}
                    a{" "}
                    <strong className="text-[var(--text)]">
                      {Math.min(currentPageProd * pageSizeProd, sortedProductos.length)}
                    </strong>{" "}
                    de <strong className="text-[var(--text)]">{sortedProductos.length}</strong> productos
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span>Filas por página:</span>
                    <select
                      value={pageSizeProd}
                      onChange={(e) => {
                        setPageSizeProd(Number(e.target.value));
                        setPageProd(1);
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
                      onClick={() => setPageProd(1)}
                      disabled={currentPageProd <= 1}
                      className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                      title="Primera página"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPageProd((p) => Math.max(1, p - 1))}
                      disabled={currentPageProd <= 1}
                      className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                      title="Página anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2">
                      Página {currentPageProd} de {totalPagesProd}
                    </span>
                    <button
                      onClick={() => setPageProd((p) => Math.min(totalPagesProd, p + 1))}
                      disabled={currentPageProd >= totalPagesProd}
                      className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-muted)]"
                      title="Página siguiente"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setPageProd(totalPagesProd)}
                      disabled={currentPageProd >= totalPagesProd}
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
        )}

        {/* ── B. VISTA POR PROVEEDOR ── */}
        {viewMode === "porProveedor" && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100 whitespace-nowrap">
                  <th className={tableCellHeader + " text-left"}>Proveedor</th>
                  <th className={tableCellHeader + " text-right"}>Productos a reponer</th>
                  <th className={tableCellHeader + " text-right"}>Sin stock</th>
                  <th className={tableCellHeader + " text-right"}>Stock bajo</th>
                  <th className={tableCellHeader + " text-center print:hidden"}>Det.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                {resumenProveedores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No hay productos por debajo del stock mínimo. Reposición al día.
                    </td>
                  </tr>
                ) : (
                  resumenProveedores.map((r) => (
                    <tr
                      key={r.proveedorId}
                      className="hover:bg-[var(--border)]/40 cursor-pointer transition-colors"
                      onClick={() =>
                        setSelectedProveedor({
                          id: r.proveedorId,
                          nombre: r.proveedor,
                          aReponer: r.aReponer,
                          sinStock: r.sinStock,
                          stockBajo: r.stockBajo,
                        })
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--text)]">{r.proveedor}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--brand)]">{r.aReponer}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400">{r.sinStock}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-400">{r.stockBajo}</td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProveedor({
                              id: r.proveedorId,
                              nombre: r.proveedor,
                              aReponer: r.aReponer,
                              sinStock: r.sinStock,
                              stockBajo: r.stockBajo,
                            });
                          }}
                          className="h-8 w-8 p-0 hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                          title="Ver detalle de reposición"
                        >
                          <Eye size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle de Reposición por Proveedor */}
      {selectedProveedor && (
        <DetalleReposicionModal
          proveedorNombre={selectedProveedor.nombre}
          productos={productosModal}
          aReponer={selectedProveedor.aReponer}
          sinStock={selectedProveedor.sinStock}
          stockBajo={selectedProveedor.stockBajo}
          onClose={() => setSelectedProveedor(null)}
        />
      )}
    </div>
  );
}
