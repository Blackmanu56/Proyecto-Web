"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import CrearPedidoModal from "@/components/ui/CrearPedidoModal";
import SolicitudesStockTable from "@/components/tables/SolicitudesStockTable";
import type { SolicitudRow } from "@/components/tables/SolicitudesStockTable";
import { getSolicitudesStock } from "@/actions/solicitudes-stock";

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

type PedidosMainTab = "CREAR_PEDIDO" | "SOLICITUDES_STOCK";

interface PedidosTableProps {
  initialProducts: Product[];
  proveedores: { id: number; cuit: string; nombre: string }[];
  userRole: string;
  initialSolicitudesStock?: SolicitudRow[];
  userId: number;
  canApprove?: boolean;
  initialTab?: string;
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
            "group flex h-10 min-w-[168px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:ring-2",
            STOCK_TONE.trigger
          )}
          aria-label="Filtro de stock"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", STOCK_TONE.icon)}>
              <Package size={14} />
            </span>
            <SelectPrimitive.Value />
          </span>
          <SelectPrimitive.Icon asChild>
            <svg className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", STOCK_TONE.chevron)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className={cn(
              "z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-white/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              STOCK_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {STOCK_OPTIONS.map((option) => {
                const OptIcon = option.icon;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 pr-8 text-sm text-[var(--text)] outline-none transition-colors duration-150 whitespace-nowrap data-[state=checked]:font-bold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      STOCK_TONE.itemFocus,
                      STOCK_TONE.selected
                    )}
                  >
                    {OptIcon && <OptIcon size={14} className="shrink-0 opacity-85" />}
                    <SelectPrimitive.ItemText>
                      <span className="whitespace-nowrap">{option.label}</span>
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-5 w-5 items-center justify-center">
                      <svg className={cn("h-3.5 w-3.5", STOCK_TONE.check)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6 9 17l-5-5" /></svg>
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

const PROVEEDOR_TONE = {
  trigger: "border-[#3B82F6]/25 hover:border-[#3B82F6]/60 focus-visible:border-[#3B82F6] focus-visible:ring-[#3B82F6]/20 data-[state=open]:border-[#3B82F6]/70 data-[state=open]:ring-[#3B82F6]/20",
  icon: "bg-[#3B82F6]/15 text-[#60A5FA] ring-[#3B82F6]/20",
  content: "border-[#3B82F6]/30",
  itemFocus: "focus:bg-[#3B82F6]/10",
  selected: "data-[state=checked]:bg-[#3B82F6]/12 data-[state=checked]:text-[#93C5FD]",
  check: "text-[#60A5FA]",
  chevron: "text-[#60A5FA]",
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
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Proveedor
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 min-w-[260px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:ring-2",
            PROVEEDOR_TONE.trigger
          )}
          aria-label="Filtro de proveedor"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", PROVEEDOR_TONE.icon)}>
              <Truck size={14} />
            </span>
            <SelectPrimitive.Value />
          </span>
          <SelectPrimitive.Icon asChild>
            <svg className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", PROVEEDOR_TONE.chevron)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className={cn(
              "z-50 max-h-72 min-w-[240px] overflow-hidden rounded-2xl border bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-white/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              PROVEEDOR_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              <SelectPrimitive.Item
                value="all"
                className={cn(
                  "relative flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 pr-8 text-sm text-[var(--text)] outline-none transition-colors duration-150 whitespace-nowrap data-[state=checked]:font-bold",
                  PROVEEDOR_TONE.itemFocus,
                  PROVEEDOR_TONE.selected
                )}
              >
                <ListFilter size={14} className="shrink-0 opacity-85" />
                <SelectPrimitive.ItemText>
                  <span className="whitespace-nowrap">Todos los proveedores</span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-5 w-5 items-center justify-center">
                  <svg className={cn("h-3.5 w-3.5", PROVEEDOR_TONE.check)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6 9 17l-5-5" /></svg>
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
              {options.map((prov) => (
                <SelectPrimitive.Item
                  key={prov.id}
                  value={String(prov.id)}
                  className={cn(
                    "relative flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 pr-8 text-sm text-[var(--text)] outline-none transition-colors duration-150 whitespace-nowrap data-[state=checked]:font-bold",
                    PROVEEDOR_TONE.itemFocus,
                    PROVEEDOR_TONE.selected
                  )}
                >
                  <Truck size={14} className="shrink-0 opacity-85" />
                  <SelectPrimitive.ItemText>
                    <span className="whitespace-nowrap">{prov.nombre}</span>
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-5 w-5 items-center justify-center">
                    <svg className={cn("h-3.5 w-3.5", PROVEEDOR_TONE.check)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6 9 17l-5-5" /></svg>
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
  userRole,
  userId,
  initialSolicitudesStock = [],
  canApprove,
  initialTab,
}: PedidosTableProps) {
  const router = useRouter();

  /* ── Tab navigation ── */
  const [activeTab, setActiveTab] = useState<PedidosMainTab>(() => {
    if (initialTab === "solicitudes-stock" || initialTab === "SOLICITUDES_STOCK") {
      return "SOLICITUDES_STOCK";
    }
    return "CREAR_PEDIDO";
  });

  /* ── Filtros (crear pedido tab) ── */
  const [search, setSearch] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"todos" | "normal" | "poco" | "sin">("todos");

  /* ── Modal crear pedido ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  /* ── Solicitudes de stock state ── */
  const [solicitudesStock, setSolicitudesStock] = useState<SolicitudRow[]>(initialSolicitudesStock);

  /* ── Fetch solicitudes de stock ── */
  const fetchSolicitudesStock = useCallback(async () => {
    try {
      const result = await getSolicitudesStock({ pageSize: 50 });
      if ("data" in result) {
        setSolicitudesStock(result.data as SolicitudRow[]);
      }
    } catch (err) {
      console.error("Error fetching solicitudes de stock:", err);
    }
  }, []);

  /* ── Pending count for badge ── */
  const pendingCount = useMemo(() => {
    return solicitudesStock.filter((s) => s.estado === "PENDIENTE").length;
  }, [solicitudesStock]);

  /* ── Fetch on mount if empty or when switching ── */
  useEffect(() => {
    fetchSolicitudesStock();
  }, [fetchSolicitudesStock]);

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
    fetchSolicitudesStock();
  }, [router, fetchSolicitudesStock]);

  /* ── Thead styles ── */
  const thBase = "sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-wider font-bold text-[var(--text-muted)]";

  /* ── Render: Crear Pedido tab ── */
  const renderCrearPedido = () => (
    <div className="space-y-3.5 flex flex-col h-full min-h-0">
      {/* Top Bar: Search + Filters Centrado y Perfectamente Alineado */}
      <div className="shrink-0 flex items-center justify-center gap-3 bg-[var(--card)] p-3 rounded-2xl border border-[var(--border)] flex-wrap shadow-sm">
        {/* Search input with label */}
        <div className="flex flex-col gap-1 w-full sm:w-[340px] lg:w-[400px]">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Búsqueda de producto
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nombre, categoría, código o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#047857] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-md"
                title="Limpiar búsqueda"
              >
                <PackageX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-end gap-3 flex-wrap">
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
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm",
                        "bg-[#047857] hover:bg-[#065F46] text-white"
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
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Selector Principal de Vistas Centrado */}
      <div className="shrink-0 flex justify-center mb-3">
        <div className="flex gap-2 items-center p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] w-full max-w-3xl shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("CREAR_PEDIDO")}
            className={cn(
              "flex-1 py-2.5 px-6 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2",
              activeTab === "CREAR_PEDIDO"
                ? "bg-[#047857] text-white shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <ShoppingCart size={16} />
            <span>Crear pedido</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SOLICITUDES_STOCK")}
            className={cn(
              "flex-1 py-2.5 px-6 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2",
              activeTab === "SOLICITUDES_STOCK"
                ? "bg-[#047857] text-white shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <Boxes size={16} />
            <span>Solicitudes de stock</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-extrabold rounded-full bg-[#D97706] text-white shadow-sm ml-1">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "CREAR_PEDIDO" && renderCrearPedido()}
        {activeTab === "SOLICITUDES_STOCK" && (
          <SolicitudesStockTable
            solicitudes={solicitudesStock}
            onRefresh={fetchSolicitudesStock}
            currentUserId={userId}
            userRole={userRole}
          />
        )}
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

