"use client";

import React, { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableShell } from "@/components/ui/table-shell";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Search,
  Package,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Boxes,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Truck,
  ListFilter,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import CrearPedidoModal from "@/components/ui/CrearPedidoModal";
import AprobarPedidoModal from "@/components/ui/AprobarPedidoModal";
import RechazarPedidoModal from "@/components/ui/RechazarPedidoModal";
import type { SolicitudItem } from "@/types/solicitud";

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

type PedidosTab = "CREAR_PEDIDO" | "PENDIENTE" | "APROBADA" | "RECHAZADA" | "TODAS";

interface PedidosTableProps {
  initialProducts: Product[];
  proveedores: { id: number; cuit: string; nombre: string }[];
  userRole: string;
  solicitudes: SolicitudItem[];
  userId: number;
  canApprove?: boolean;
}

/* ────────────────────── Helpers ────────────────────── */

const formatCurrencyLocal = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const estadoBadge = (estado: string) => {
  switch (estado) {
    case "PENDIENTE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B]">
          <Clock size={11} /> Pendiente
        </span>
      );
    case "APROBADA":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--success)]/15 text-[var(--success)]">
          <CheckCircle size={11} /> Aprobada
        </span>
      );
    case "RECHAZADA":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--danger)]/15 text-[var(--danger)]">
          <XCircle size={11} /> Rechazada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg)] text-[var(--text-secondary)]">
          {estado}
        </span>
      );
  }
};

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
            "group flex h-10 min-w-[180px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:ring-2",
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
              "z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-white/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
  solicitudes,
  canApprove,
}: PedidosTableProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMINISTRADOR";

  /* ── Filtros (crear pedido tab) ── */
  const [search, setSearch] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"todos" | "normal" | "poco" | "sin">("todos");

  /* ── Tab navigation ── */
  const [activeTab, setActiveTab] = useState<PedidosTab>("CREAR_PEDIDO");

  /* ── Modal crear pedido ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  /* ── Modal aprobar ── */
  const [aprobarModal, setAprobarModal] = useState<{
    open: boolean;
    solicitud: {
      id: number;
      producto: string;
      proveedor: string;
      cantidad: number;
      costoUnitario: number;
      total: number;
      origenPago: string;
      motivo?: string | null;
    } | null;
  }>({ open: false, solicitud: null });

  /* ── Modal rechazar ── */
  const [rechazarModal, setRechazarModal] = useState<{
    open: boolean;
    solicitudId: number;
    solicitudNombre: string;
  }>({ open: false, solicitudId: 0, solicitudNombre: "" });

  /* ── Derived solicitudes ── */
  const solicitudCounts = useMemo(
    () => ({
      PENDIENTE: solicitudes.filter((s) => s.estado === "PENDIENTE").length,
      APROBADA: solicitudes.filter((s) => s.estado === "APROBADA").length,
      RECHAZADA: solicitudes.filter((s) => s.estado === "RECHAZADA").length,
    }),
    [solicitudes]
  );

  const solicitudesByTab = useMemo(() => {
    if (activeTab === "CREAR_PEDIDO") return [];
    if (activeTab === "TODAS") return solicitudes;
    return solicitudes.filter((s) => s.estado === activeTab);
  }, [solicitudes, activeTab]);

  /* ── Tabs ── */
  const tabs: { id: PedidosTab; label: string; count: number }[] = useMemo(() => {
    const t: { id: PedidosTab; label: string; count: number }[] = [
      { id: "CREAR_PEDIDO", label: "Crear pedido", count: 0 },
    ];
    if (isAdmin) {
      t.push(
        { id: "PENDIENTE", label: "Pendientes", count: solicitudCounts.PENDIENTE },
        { id: "APROBADA", label: "Aprobadas", count: solicitudCounts.APROBADA },
        { id: "RECHAZADA", label: "Rechazadas", count: solicitudCounts.RECHAZADA },
        { id: "TODAS", label: "Todas", count: solicitudes.length }
      );
    } else {
      if (solicitudCounts.PENDIENTE > 0) t.push({ id: "PENDIENTE", label: "Pendientes", count: solicitudCounts.PENDIENTE });
      if (solicitudCounts.APROBADA > 0) t.push({ id: "APROBADA", label: "Aprobadas", count: solicitudCounts.APROBADA });
      if (solicitudCounts.RECHAZADA > 0) t.push({ id: "RECHAZADA", label: "Rechazadas", count: solicitudCounts.RECHAZADA });
      if (solicitudes.length > 0) t.push({ id: "TODAS", label: "Todas", count: solicitudes.length });
    }
    return t;
  }, [isAdmin, solicitudCounts, solicitudes.length]);

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

  const handleOpenAprobar = useCallback((s: SolicitudItem) => {
    setAprobarModal({
      open: true,
      solicitud: {
        id: s.id,
        producto: s.producto.nombre,
        proveedor: s.proveedor.nombre,
        cantidad: s.cantidad,
        costoUnitario: s.costoUnitario,
        total: s.total,
        origenPago: s.origenPago,
        motivo: s.motivo,
      },
    });
  }, []);

  const handleOpenRechazar = useCallback((s: SolicitudItem) => {
    setRechazarModal({
      open: true,
      solicitudId: s.id,
      solicitudNombre: s.producto.nombre,
    });
  }, []);

  const handleModalSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  /* ── Thead styles (matching ProductosTable) ── */
  const thBase = "sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)]";

  /* ── Render: Crear Pedido tab ── */
  const renderCrearPedido = () => (
    <TableShell
      title="Crear pedido"
      hideHeaderTitle
      searchLabel="Busqueda de producto"
      searchPlaceholder="Buscar por nombre, categoría, código o marca..."
      searchValue={search}
      onSearchChange={setSearch}
      centeredHeaderControls
      isEmpty={products.length === 0}
      emptyMessage="No hay productos activos que coincidan con los filtros."
      emptyIcon={<Package size={32} className="opacity-40" />}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <ProveedorFilterSelect
            value={proveedorFilter}
            onValueChange={setProveedorFilter}
            options={proveedoresEnUso}
          />
          <StockFilterSelect
            value={stockFilter}
            onValueChange={(v) => setStockFilter(v as typeof stockFilter)}
          />
          <span className="text-xs text-[var(--text-secondary)] ml-auto self-end mb-1">
            {products.length} producto{products.length !== 1 && "s"}
          </span>
        </div>
      }
    >
      <div className="min-w-full">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <thead className="bg-[#17191f]">
            <tr className="bg-[#17191f] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6]">
              <th className={`${thBase} w-[36%]`}>Producto</th>
              <th className={`${thBase} w-[6%] text-center`}>Stock</th>
              <th className={`${thBase} w-[14%]`}>Proveedor</th>
              <th className={`${thBase} w-[10%] text-right`}>Precio compra</th>
              <th className={`${thBase} w-[10%] text-center`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className={cn(
                  "border-b border-[var(--border)]/50 transition-colors",
                  "hover:bg-white/[0.02]"
                )}
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
                  <span className="text-[var(--text-secondary)]">{product.proveedor.nombre}</span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
                  {formatCurrency(product.precioCompra)}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleCrearPedido(product)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                      "border border-[#059669]/40 bg-[#047857] text-white",
                      "hover:bg-[#065F46] focus-visible:outline-2 focus-visible:outline-[#059669]"
                    )}
                  >
                    <ShoppingCart size={13} />
                    Crear pedido
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableShell>
  );

  /* ── Render: Solicitudes tab ── */
  const renderSolicitudes = () => (
    <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      {solicitudesByTab.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            No hay solicitudes {activeTab !== "TODAS" ? `con estado "${activeTab.toLowerCase()}"` : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudesByTab.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="relative h-9 w-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center overflow-hidden">
                    {"imagen" in s.producto && s.producto.imagen ? (
                      <Image src={s.producto.imagen} alt={s.producto.nombre} fill sizes="36px" className="object-contain p-1" />
                    ) : (
                      <Package size={16} className="text-[var(--text-secondary)] opacity-40" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text)]">{s.producto.nombre}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Proveedor: {s.proveedor.nombre} · Solicitante: {s.solicitante.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {estadoBadge(s.estado)}
                  <span className="text-xs text-[var(--text-secondary)]">#{s.id}</span>
                </div>
              </div>

              {/* Snapshot */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Cantidad</p>
                  <p className="font-mono font-semibold">{s.cantidad}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Costo Unit.</p>
                  <p className="font-mono font-semibold">{formatCurrencyLocal(s.costoUnitario)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Total</p>
                  <p className="font-mono font-bold text-[var(--brand)]">{formatCurrencyLocal(s.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Origen Pago</p>
                  <p className="font-semibold">{s.origenPago.replace(/_/g, " ")}</p>
                </div>
              </div>

              {/* Payment distribution */}
              {Array.isArray(s.pagos) && s.pagos.length > 0 && (
                <div className="p-2 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Distribución de pago</p>
                  <div className="flex flex-wrap gap-2">
                    {(s.pagos as Array<{ medio: string; monto: number; observacion?: string }>).map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs font-mono">
                        {p.medio.replace(/_/g, " ")}: {formatCurrencyLocal(p.monto)}
                        {p.observacion && <span className="text-[var(--text-secondary)] ml-1">({p.observacion})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivo / Respuesta */}
              {s.motivo && (
                <p className="text-xs text-[var(--text-secondary)]">
                  <strong>Motivo:</strong> {s.motivo}
                </p>
              )}
              {s.respuesta && (
                <p className="text-xs text-[var(--danger)]">
                  <strong>Respuesta:</strong> {s.respuesta}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Creada: {formatDate(s.createdAt)}
                  {s.resueltoEn && ` · Resuelta: ${formatDate(s.resueltoEn)}`}
                  {s.aprobador && ` · Aprobada por: ${s.aprobador.username}`}
                </p>

                {/* Admin actions on PENDIENTE */}
                {isAdmin && s.estado === "PENDIENTE" && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handleOpenAprobar(s)}
                      className="bg-[#047857] hover:bg-[#065F46] text-white text-xs px-3 py-1.5 h-auto"
                    >
                      <CheckCircle size={13} className="mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOpenRechazar(s)}
                      className="text-xs px-3 py-1.5 h-auto border-[var(--danger)]/40 text-[var(--danger)]"
                    >
                      <XCircle size={13} className="mr-1" />
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aprobar modal */}
      {aprobarModal.solicitud && (
        <AprobarPedidoModal
          open={aprobarModal.open}
          onOpenChange={(open) => setAprobarModal((prev) => ({ ...prev, open }))}
          solicitud={aprobarModal.solicitud}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Rechazar modal */}
      <RechazarPedidoModal
        open={rechazarModal.open}
        onOpenChange={(open) => setRechazarModal((prev) => ({ ...prev, open }))}
        solicitudId={rechazarModal.solicitudId}
        solicitudNombre={rechazarModal.solicitudNombre}
        onSuccess={handleModalSuccess}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 flex gap-2 flex-wrap items-center px-3 py-2 mb-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
              activeTab === tab.id
                ? "bg-[#047857] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text)]"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-[var(--border)] text-[var(--text-secondary)]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "CREAR_PEDIDO" ? renderCrearPedido() : renderSolicitudes()}
      </div>

      {/* Modals outside tabs */}
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
