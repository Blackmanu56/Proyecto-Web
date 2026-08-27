"use client";

import React, { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  Boxes,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Truck,
  ListFilter,
  Search,
  Eraser,
  X,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import CrearPedidoModal from "@/components/ui/CrearPedidoModal";

/* ────────────────────── Types ────────────────────── */

interface Product {
  id: number;
  nombre: string;
  marca: string | null;
  codigo: string | null;
  imagen: string | null;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  categoria: { id: number; nombre: string };
  proveedor: { id: number; nombre: string };
}

interface PedidosTableProps {
  initialProducts: Product[];
  proveedores: { id: number; nombre: string }[];
  userRole: string;
  userId: number;
  canApprove?: boolean;
}

/* ────────────────────── Stock Filter Select ────────────────────── */

type StockFilterOption = {
  value: string;
  label: string;
  icon?: React.ElementType;
};

type StockFilterTone = {
  trigger: string;
  icon: string;
  content: string;
  itemFocus: string;
  selected: string;
  check: string;
  chevron: string;
};

const STOCK_TONE: StockFilterTone = {
  trigger: "border-[#F59E0B]/25 hover:border-[#F59E0B]/60 focus-visible:border-[#F59E0B] focus-visible:ring-[#F59E0B]/20 data-[state=open]:border-[#F59E0B]/70 data-[state=open]:ring-[#F59E0B]/20",
  icon: "bg-[#F59E0B]/15 text-[#FBBF24] ring-[#F59E0B]/20",
  content: "border-[#F59E0B]/30",
  itemFocus: "focus:bg-[#F59E0B]/10",
  selected: "data-[state=checked]:bg-[#F59E0B]/12 data-[state=checked]:text-[#FDE68A]",
  check: "text-[#FBBF24]",
  chevron: "text-[#FBBF24]",
};

const STOCK_OPTIONS: StockFilterOption[] = [
  { value: "todos", label: "Todos", icon: Boxes },
  { value: "normal", label: "Con stock", icon: PackageCheck },
  { value: "poco", label: "Poco stock", icon: AlertTriangle },
  { value: "sin", label: "Sin stock", icon: PackageX },
];

function StockFilterSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Stock
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 min-w-[160px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200",
            STOCK_TONE.trigger
          )}
        >
          <span className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg ring-1", STOCK_TONE.icon)}>
              <Boxes size={13} />
            </span>
            <SelectPrimitive.Value />
          </span>
          <SelectPrimitive.Icon asChild>
            <svg
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", STOCK_TONE.chevron)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[160px] overflow-hidden rounded-xl border bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)] animate-in fade-in-80",
              STOCK_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="space-y-1">
              {STOCK_OPTIONS.map((option) => {
                const OptionIcon = option.icon ?? Boxes;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text)] outline-none transition-colors",
                      STOCK_TONE.itemFocus,
                      STOCK_TONE.selected
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-md ring-1", STOCK_TONE.icon)}>
                        <OptionIcon size={12} />
                      </span>
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    </span>
                    <SelectPrimitive.ItemIndicator>
                      <span className={cn("text-xs font-bold", STOCK_TONE.check)}>✓</span>
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

/* ────────────────────── Proveedor Filter Select ────────────────────── */

type ProveedorTone = {
  trigger: string;
  icon: string;
  content: string;
  itemFocus: string;
  selected: string;
  check: string;
  chevron: string;
};

const PROVEEDOR_TONE: ProveedorTone = {
  trigger: "border-[#0284C7]/25 hover:border-[#0284C7]/60 focus-visible:border-[#0284C7] focus-visible:ring-[#0284C7]/20 data-[state=open]:border-[#0284C7]/70 data-[state=open]:ring-[#0284C7]/20",
  icon: "bg-[#0284C7]/15 text-[#38BDF8] ring-[#0284C7]/20",
  content: "border-[#0284C7]/30",
  itemFocus: "focus:bg-[#0284C7]/10",
  selected: "data-[state=checked]:bg-[#0284C7]/12 data-[state=checked]:text-[#BAE6FD]",
  check: "text-[#38BDF8]",
  chevron: "text-[#38BDF8]",
};

function ProveedorFilterSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { id: number; nombre: string }[];
}) {
  const selectedLabel =
    value === "all"
      ? "Todos"
      : options.find((p) => String(p.id) === value)?.nombre ?? "Todos";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Proveedor
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 min-w-[180px] max-w-[240px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200",
            PROVEEDOR_TONE.trigger
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", PROVEEDOR_TONE.icon)}>
              <Truck size={13} />
            </span>
            <span className="truncate">{selectedLabel}</span>
          </span>
          <SelectPrimitive.Icon asChild>
            <svg
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", PROVEEDOR_TONE.chevron)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 max-h-60 min-w-[180px] overflow-y-auto rounded-xl border bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)] animate-in fade-in-80",
              PROVEEDOR_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="space-y-1">
              <SelectPrimitive.Item
                value="all"
                className={cn(
                  "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text)] outline-none transition-colors",
                  PROVEEDOR_TONE.itemFocus,
                  PROVEEDOR_TONE.selected
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-md ring-1", PROVEEDOR_TONE.icon)}>
                    <ListFilter size={12} />
                  </span>
                  <SelectPrimitive.ItemText>Todos los proveedores</SelectPrimitive.ItemText>
                </span>
                <SelectPrimitive.ItemIndicator>
                  <span className={cn("text-xs font-bold", PROVEEDOR_TONE.check)}>✓</span>
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
              {options.map((prov) => (
                <SelectPrimitive.Item
                  key={prov.id}
                  value={String(prov.id)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text)] outline-none transition-colors",
                    PROVEEDOR_TONE.itemFocus,
                    PROVEEDOR_TONE.selected
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1", PROVEEDOR_TONE.icon)}>
                      <Truck size={12} />
                    </span>
                    <SelectPrimitive.ItemText className="truncate">{prov.nombre}</SelectPrimitive.ItemText>
                  </span>
                  <SelectPrimitive.ItemIndicator>
                    <span className={cn("text-xs font-bold", PROVEEDOR_TONE.check)}>✓</span>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

/* ────────────────────── Component ────────────────────── */

export default function PedidosTable({
  initialProducts,
  proveedores,
  canApprove,
}: PedidosTableProps) {
  const router = useRouter();

  /* ── Filtros ── */
  const [search, setSearch] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"todos" | "normal" | "poco" | "sin">("todos");

  /* ── Modal crear pedido ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const hasActiveFilters = search !== "" || proveedorFilter !== "all" || stockFilter !== "todos";

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setProveedorFilter("all");
    setStockFilter("todos");
  }, []);

  /* ── Productos filtrados (solo activos) ── */
  const products = useMemo(() => {
    return initialProducts.filter((p) => {
      if (!p.activo) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = p.nombre.toLowerCase().includes(q);
        const matchCategoria = p.categoria.nombre.toLowerCase().includes(q);
        const matchCodigo = p.codigo?.toLowerCase().includes(q) ?? false;
        const matchMarca = p.marca?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchCategoria && !matchCodigo && !matchMarca) return false;
      }
      if (proveedorFilter !== "all" && String(p.proveedor.id) !== proveedorFilter) {
        return false;
      }
      if (stockFilter !== "todos") {
        if (stockFilter === "normal" && p.cantidad <= p.stockMinimo) return false;
        if (stockFilter === "poco" && !(p.cantidad > 0 && p.cantidad <= p.stockMinimo)) return false;
        if (stockFilter === "sin" && p.cantidad !== 0) return false;
      }
      return true;
    });
  }, [initialProducts, search, proveedorFilter, stockFilter]);

  /* ── Derivar proveedores únicos ── */
  const proveedoresEnUso = useMemo(() => {
    const ids = new Set(initialProducts.filter((p) => p.activo).map((p) => p.proveedor.id));
    return proveedores.filter((prov) => ids.has(prov.id));
  }, [initialProducts, proveedores]);

  /* ── Helpers ── */
  const stockBadge = (cantidad: number, stockMinimo: number) => {
    if (cantidad === 0) return <Badge variant="danger" size="sm">Sin stock</Badge>;
    if (cantidad <= stockMinimo) return <Badge variant="warning" size="sm">{cantidad} uds</Badge>;
    return <Badge variant="success" size="sm">{cantidad} uds</Badge>;
  };

  const handleCrearPedido = useCallback((product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  /* ── Thead styles ── */
  const thBase = "sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6]";

  return (
    <div className="space-y-3.5 flex flex-col h-full min-h-0">
      {/* Top Bar: Centered Search + Filters */}
      <div className="shrink-0 flex items-end justify-center gap-3.5 bg-[var(--card)] p-3 min-h-[76px] rounded-2xl border border-[var(--border)] flex-wrap shadow-sm">
        {/* Search input */}
        <div className="flex flex-col gap-1 w-full sm:w-[320px] lg:w-[360px]">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Búsqueda de producto
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nombre, categoría, código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 hover:border-[var(--border-hover)] transition-all shadow-[var(--shadow-sm)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-md transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Botón Limpiar (al lado de la búsqueda) */}
        {hasActiveFilters && (
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="h-[14px]" />
            <button
              type="button"
              onClick={handleClearFilters}
              className="group flex h-10 min-w-[110px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] py-2 px-3 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 hover:bg-[var(--brand)]/10 hover:text-white focus-visible:border-[var(--brand)] active:scale-[0.98]"
              title="Limpiar filtros"
            >
              <Eraser size={13} className="text-[var(--brand)]" />
              <span>Limpiar</span>
            </button>
          </div>
        )}

        {/* Filters */}
        <ProveedorFilterSelect
          value={proveedorFilter}
          onValueChange={setProveedorFilter}
          options={proveedoresEnUso}
        />
        <StockFilterSelect
          value={stockFilter}
          onValueChange={(v) => setStockFilter(v as typeof stockFilter)}
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm border-collapse min-w-[760px] table-auto">
          <thead>
            <tr>
              <th className={`${thBase} w-[36%] text-left`}>PRODUCTO</th>
              <th className={`${thBase} w-[12%] text-center`}>STOCK ACTUAL</th>
              <th className={`${thBase} w-[22%] text-left`}>PROVEEDOR</th>
              <th className={`${thBase} w-[15%] text-right`}>PRECIO DE COMPRA</th>
              <th className={`${thBase} w-[15%] text-center`}>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-20 text-center text-[var(--text-muted)] text-sm">
                  No hay productos activos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[var(--border)]/40 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-9 w-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center overflow-hidden">
                        {product.imagen ? (
                          <Image src={product.imagen} alt={product.nombre} fill sizes="36px" className="object-contain p-1" />
                        ) : (
                          <Package size={16} className="text-[var(--text-secondary)] opacity-40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text)] truncate">{product.nombre}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">
                          {product.categoria.nombre}
                          {product.marca && ` · ${product.marca}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {stockBadge(product.cantidad, product.stockMinimo)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[var(--text-secondary)] truncate block">{product.proveedor.nombre}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
                    {formatCurrency(product.precioCompra)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleCrearPedido(product)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95",
                        "bg-[var(--brand)] hover:bg-[var(--brand)]/85 text-white"
                      )}
                    >
                      <ShoppingCart size={13} />
                      Crear pedido
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Pedido */}
      {selectedProduct && (
        <CrearPedidoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          producto={{
            id: selectedProduct.id,
            nombre: selectedProduct.nombre,
            imagen: selectedProduct.imagen,
            cantidad: selectedProduct.cantidad,
            precioCompra: selectedProduct.precioCompra,
            proveedorId: selectedProduct.proveedor.id,
            proveedorNombre: selectedProduct.proveedor.nombre,
          }}
          onSuccess={handleModalSuccess}
          canApprove={canApprove}
        />
      )}
    </div>
  );
}
