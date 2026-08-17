"use client";

import { createCategoria,createMarca,getCategorias,getCategoriasWithCount,getMarcasActivas,getMarcasWithCount,toggleCategoriaActivo,toggleMarcaActivo,updateCategoria,updateMarca } from "@/actions/auxiliares";
import { getCajaActiva } from "@/actions/caja";
import Image from "next/image";
import {
createProducto,
restarStock,
updateProducto,
} from "@/actions/productos";
import AdminEntityModal from "@/components/ui/AdminEntityModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DarBajaModal from "@/components/ui/DarBajaModal";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import HistorialModal from "@/components/ui/HistorialModal";
import { Input } from "@/components/ui/input";
import { PaymentDistribution, PaymentMethod } from "@/components/ui/PaymentDistribution";
import ReactivarModal from "@/components/ui/ReactivarModal";
import RestarStockModal from "@/components/ui/RestarStockModal";
import SolicitarReposicionModal from "@/components/ui/SolicitarReposicionModal";
import { TableShell } from "@/components/ui/table-shell";
import {
  getProductPurchaseCost,
  isProductPaymentDistributionIncomplete,
} from "@/lib/product-purchase-payments";
import { calcularEfectivoFisico } from "@/lib/caja-balance";
import { cn,formatCurrency } from "@/lib/utils";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  BarChart3,
  Check,
  CheckCircle,
  ChevronDown,
  CircleOff,
  Columns3,
  DollarSign,
  Edit2,
  GripVertical,
  FolderOpen,
  History,
  Layers,
  ListFilter,
  Package,
  PackageCheck,
  PackagePlus,
  PackageX,
  Plus,
  RotateCcw,
  ShieldCheck,
  Tag,
  TrendingDown,
  Truck,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import React,{ useCallback,useEffect,useRef,useState,useTransition } from "react";
import type { FilterStatus } from "./StatusFilter";

/* ────────────────────── Types ────────────────────── */

interface Product {
  id: number;
  nombre: string;
  marca: string | null;
  marcaId: number | null;
  codigo: string | null;
  imagen: string | null;
  descripcion?: string | null;
  observacion?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  categoria: { id: number; nombre: string };
  proveedor: { id: number; nombre: string };
}

interface ProductosTableProps {
  initialProducts: Product[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; cuit: string; nombre: string }[];
  userRole: string;
}

/* ────────────────────── Column definitions ────────────────────── */

type SortField = "nombre" | "marca" | "categoria" | "proveedor" | "precioCompra" | "precioVenta" | "stock" | "stockMinimo";
type SortDirection = "asc" | "desc" | null;

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  defaultVisible: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "nombre", label: "Nombre", sortable: true, sortField: "nombre", defaultVisible: true, align: "left" },
  { key: "marca", label: "Marca", sortable: true, sortField: "marca", defaultVisible: true, align: "left" },
  { key: "categoria", label: "Categoría", sortable: true, sortField: "categoria", defaultVisible: true, align: "left" },
  { key: "precioCompra", label: "Precio Compra", sortable: true, sortField: "precioCompra", defaultVisible: false, align: "right", className: "text-right" },
  { key: "precioVenta", label: "Precio Venta", sortable: true, sortField: "precioVenta", defaultVisible: true, align: "right", className: "text-right" },
  { key: "stock", label: "Stock", sortable: true, sortField: "stock", defaultVisible: true, align: "center" },
  { key: "proveedor", label: "Proveedor", sortable: true, sortField: "proveedor", defaultVisible: false, align: "left" },
  { key: "estado", label: "Estado", sortable: false, defaultVisible: true, align: "center" },
];

const COLUMN_WIDTH_CLASSES: Record<string, string> = {
  nombre: "w-[36%]",
  marca: "w-[7%]",
  categoria: "w-[8%]",
  precioCompra: "w-[8%]",
  precioVenta: "w-[8%]",
  stock: "w-[6%]",
  proveedor: "w-[10%]",
  estado: "w-[5%]",
};

const COLUMN_VISIBILITY_KEY = "productos-column-visibility";
const PRODUCT_FORM_ID = "producto-form";

type FilterOption = {
  value: string;
  label: string;
  icon?: React.ElementType;
};

type FilterTone = {
  trigger: string;
  icon: string;
  content: string;
  itemFocus: string;
  selected: string;
  check: string;
  chevron: string;
};

interface ProductFilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  triggerIcon: React.ElementType;
  tone: FilterTone;
  minWidth?: string;
}

function ProductFilterSelect({
  label,
  value,
  onValueChange,
  options,
  triggerIcon: TriggerIcon,
  tone,
  minWidth = "min-w-[140px]",
}: ProductFilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:ring-2",
            minWidth,
            tone.trigger
          )}
          aria-label={label}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", tone.icon)}>
              <TriggerIcon size={14} />
            </span>
            <SelectPrimitive.Value />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", tone.chevron)} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className={cn(
              "z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-white/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              tone.content
            )}
          >
            <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {options.map(option => {
                const OptionIcon = option.icon;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 pr-8 text-sm text-[var(--text)] outline-none transition-colors duration-150 whitespace-nowrap data-[state=checked]:font-bold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      tone.itemFocus,
                      tone.selected
                    )}
                  >
                    {OptionIcon && <OptionIcon size={14} className="shrink-0 opacity-85" />}
                    <SelectPrimitive.ItemText><span className="whitespace-nowrap">{option.label}</span></SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-5 w-5 items-center justify-center">
                      <Check size={14} className={tone.check} strokeWidth={2.6} />
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

function InfoCard({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-3", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
      <div className={cn("mt-2 text-base font-bold text-[var(--text)]", valueClassName)}>{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function getDefaultColumnVisibility(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  COLUMNS.forEach(c => { defaults[c.key] = c.defaultVisible; });
  return defaults;
}

function loadColumnVisibility(): Record<string, boolean> {
  if (typeof window === "undefined") return getDefaultColumnVisibility();
  try {
    const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return getDefaultColumnVisibility();
}

function saveColumnVisibility(vis: Record<string, boolean>) {
  try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(vis)); } catch { /* ignore */ }
}

/* ────────────────────── Combobox ────────────────────── */

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  onCreateNew?: (value: string) => void;
  disabled?: boolean;
}

function Combobox({ value, onChange, options, placeholder = "Buscar...", onCreateNew, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const showCreate = onCreateNew && query.trim() && !options.some(o => o.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setQuery(""); }}
        className="w-full flex items-center justify-between h-10 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-left transition-colors hover:border-border-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand disabled:opacity-50"
      >
        <span className={value ? "text-text" : "text-text-secondary"}>
          {value || placeholder}
        </span>
        <ArrowUpDown size={12} className="text-text-secondary flex-shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-panel border border-border rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-48 overflow-auto">
          <div className="p-1.5 border-b border-border/60">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-8 px-2 bg-bg border border-border rounded text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-brand"
            />
          </div>
          <div className="p-1">
            {filtered.length === 0 && !showCreate && (
              <p className="px-2 py-1.5 text-xs text-text-secondary">Sin resultados</p>
            )}
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                  value === opt ? "bg-brand/10 text-brand font-medium" : "text-text hover:bg-border/60"
                }`}
              >
                {opt}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onClick={() => {
                  onCreateNew(query.trim());
                  onChange(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-2 py-1.5 text-sm text-brand hover:bg-brand/10 rounded flex items-center gap-1.5 font-medium"
              >
                <Plus size={12} />
                Crear &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ────────────────────── Admin Categorías Modal ────────────────────── */

/* AdminCategoriasModal → migrado a AdminEntityModal */

/* AdminMarcasModal → migrado a AdminEntityModal */

/* ────────────────────── Main Component ────────────────────── */

export default function ProductosTable({
  initialProducts,
  categorias: initialCategorias,
  proveedores,
  userRole,
}: ProductosTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /* ── Filtros ── */
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [marcaFilter, setMarcaFilter] = useState("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("activos");
  const [stockFilter, setStockFilter] = useState<"todos" | "normal" | "poco" | "sin">("todos");

  /* ── Sorting ── */
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const sortDirRef = useRef<SortDirection>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sortDirRef.current = sortDir;
  }, [sortDir]);

  /* ── Column visibility ── */
  const [colVis, setColVis] = useState<Record<string, boolean>>(loadColumnVisibility);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  /* ── Modals: form ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [productPurchaseCost, setProductPurchaseCost] = useState(0);
  const distribucionIncompleta = isProductPaymentDistributionIncomplete(
    productPurchaseCost,
    payments
  );
  const [cajaBalance, setCajaBalance] = useState<number>(0);
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(true);

  /* ── Form combobox state ── */
  const [marcaValue, setMarcaValue] = useState("");
  const [categoriaValue, setCategoriaValue] = useState("");
  const [categorias, setCategorias] = useState(initialCategorias);
  const [activeMarcas, setActiveMarcas] = useState<{id: number; nombre: string}[]>([]);

  /* ── Modals: baja / reactivar / historial / admin categorías ── */
  const [bajaModal, setBajaModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [reactivarModal, setReactivarModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [historialModal, setHistorialModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [restarStockModal, setRestarStockModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [solicitarReposicionModal, setSolicitarReposicionModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adminCatsOpen, setAdminCatsOpen] = useState(false);
  const [adminMarcasOpen, setAdminMarcasOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  /* ── Unique brands from active marcas ── */
  const uniqueBrands = Array.from(new Set(activeMarcas.map(m => m.nombre))).sort();

  /* ── Fetch active marcas on mount and when modal opens ── */
  useEffect(() => {
    getMarcasActivas().then(setActiveMarcas);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      getMarcasActivas().then(setActiveMarcas);
      // Fetch caja balance for payment distribution
      getCajaActiva().then(caja => {
        if (caja) {
          const balance = calcularEfectivoFisico(
            caja.movimientos
          ).efectivoEsperado;
          setCajaBalance(balance);
          setCajaAbierta(true);
        } else {
          setCajaBalance(0);
          setCajaAbierta(false);
        }
      });
    }
  }, [isModalOpen]);

  /* Column visibility: close on outside click or Escape */
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColMenuOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);


  /* ── Add menu click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Handlers ── */
  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(product.imagen || null);
    setMarcaValue(product.marca || "");
    setCategoriaValue(product.categoria.nombre);
    setPayments([]);
    setProductPurchaseCost(0);
    setIsModalOpen(true);
  }, []);

  const handleOpenAdd = useCallback(() => {
    setEditingProduct(null);
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(null);
    setMarcaValue("");
    setCategoriaValue("");
    setPayments([]);
    setProductPurchaseCost(0);
    setIsModalOpen(true);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    const currentDir = sortDirRef.current;
    const currentField = sortField;

    if (currentField === field) {
      // Same field: cycle asc → desc → null
      if (currentDir === "asc") {
        setSortDir("desc");
      } else if (currentDir === "desc") {
        setSortDir(null);
        setSortField(null);
      } else {
        setSortDir("asc");
      }
    } else {
      // New field: start with asc
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField]);

  const toggleColVis = useCallback((key: string) => {
    setColVis(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveColumnVisibility(next);
      return next;
    });
  }, []);

  const handleDarBaja = useCallback((product: Product) => {
    setBajaModal({ open: true, product });
  }, []);

  const handleReactivar = useCallback((product: Product) => {
    setReactivarModal({ open: true, product });
  }, []);

  const handleHistorial = useCallback((product: Product) => {
    setHistorialModal({ open: true, product });
  }, []);

  const handleRestarStock = useCallback((product: Product) => {
    setRestarStockModal({ open: true, product });
  }, []);

  const handleProductRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>, product: Product) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button'], [role='menuitem']")) return;
    setSelectedProduct(product);
  }, []);

  const closeProductDrawer = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const runDrawerAction = useCallback((action: (product: Product) => void, product: Product) => {
    setSelectedProduct(null);
    action(product);
  }, []);

  const formatOptionalDate = (value?: Date | string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const formData = new FormData(e.currentTarget);
    // Inject combobox values as hidden fields
    formData.set("marca", marcaValue);
    const matchedCat = categorias.find(c => c.nombre === categoriaValue);
    formData.set("categoriaId", matchedCat ? String(matchedCat.id) : "");

    // Payment distribution validation — only for create (edit is edit-only, D4)
    if (!editingProduct) {
      const currentPurchaseCost = getProductPurchaseCost(formData, "create");
      if (isProductPaymentDistributionIncomplete(currentPurchaseCost, payments)) {
        setErrorMsg("Completá una distribución de pago válida antes de guardar.");
        return;
      }

      // Add payments data if available
      if (payments.length > 0) {
        const validPayments = payments.filter(p => p.monto > 0);
        if (validPayments.length > 0) {
          formData.set("pagos", JSON.stringify(validPayments));
        }
      }
    }

    startTransition(async () => {
      try {
        const res = editingProduct
          ? await updateProducto(editingProduct.id, formData)
          : await createProducto(formData);

        if (res.success) {
          setSuccessMsg(
            editingProduct
              ? "Producto actualizado exitosamente."
              : "Producto creado exitosamente."
          );
          setTimeout(() => {
            setIsModalOpen(false);
            setSuccessMsg("");
            setPayments([]);
          }, 1500);
          router.refresh();
        } else {
          setErrorMsg(res.error || "Ocurrió un error inesperado.");
        }
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
      }
    });
    }, [editingProduct, marcaValue, categoriaValue, categorias, payments, router]);

  const handleRefreshCategorias = useCallback(async () => {
    const cats = await getCategorias();
    setCategorias(cats);
  }, []);

  const handleRefreshMarcas = useCallback(async () => {
    const marcas = await getMarcasActivas();
    setActiveMarcas(marcas);
  }, []);

  /* ── Filtering ── */
  const filteredProducts = initialProducts.filter(p => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(search.toLowerCase())) ||
      p.proveedor.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.nombre.toLowerCase().includes(search.toLowerCase());

    const matchesCat = catFilter === "all" || p.categoria.id === Number(catFilter);

    const matchesMarca = marcaFilter === "all" || (p.marca && p.marca === marcaFilter);

    let matchesStatus = false;
    if (filterStatus === "todos") matchesStatus = true;
    else if (filterStatus === "activos") matchesStatus = p.activo;
    else if (filterStatus === "inactivos") matchesStatus = !p.activo;

    let matchesStock = false;
    if (stockFilter === "todos") matchesStock = true;
    else if (stockFilter === "normal") matchesStock = p.cantidad > p.stockMinimo;
    else if (stockFilter === "poco") matchesStock = p.cantidad > 0 && p.cantidad <= p.stockMinimo;
    else if (stockFilter === "sin") matchesStock = p.cantidad === 0;

    return matchesSearch && matchesCat && matchesMarca && matchesStatus && matchesStock;
  });

  /* ── Sorting ── */
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let cmp = 0;
    switch (sortField) {
      case "nombre":
        cmp = a.nombre.localeCompare(b.nombre);
        break;
      case "marca":
        cmp = (a.marca || "").localeCompare(b.marca || "");
        break;
      case "categoria":
        cmp = a.categoria.nombre.localeCompare(b.categoria.nombre);
        break;
      case "proveedor":
        cmp = a.proveedor.nombre.localeCompare(b.proveedor.nombre);
        break;
      case "precioCompra":
        cmp = a.precioCompra - b.precioCompra;
        break;
      case "precioVenta":
        cmp = a.precioVenta - b.precioVenta;
        break;
      case "stock":
        cmp = a.cantidad - b.cantidad;
        break;
      case "stockMinimo":
        cmp = a.stockMinimo - b.stockMinimo;
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  /* ── Stat counts ── */
  const totalProductos = initialProducts.filter(p => p.activo).length;
  const stockCritico = initialProducts.filter(p => p.activo && p.cantidad <= p.stockMinimo).length;
  const inactivos = initialProducts.filter(p => !p.activo).length;
  const sinStock = initialProducts.filter(p => p.cantidad === 0).length;
  const canManageProducts = ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole);

  /* ── Render helper: sort indicator ── */
  const TEXT_FIELDS = new Set<SortField>(["nombre", "marca", "categoria", "proveedor"]);

  const getSortTooltip = (field: SortField): string => {
    const isText = TEXT_FIELDS.has(field);
    if (sortField !== field || sortDir === null) return isText ? "Ordenar de A a Z" : "Ordenar de menor a mayor";
    if (sortDir === "asc") return isText ? "Ordenar de Z a A" : "Ordenar de mayor a menor";
    return "Quitar ordenamiento";
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    const isActive = sortField === field && sortDir !== null;
    const isText = TEXT_FIELDS.has(field);
    const color = isActive ? "text-[var(--brand)]" : "opacity-40";
    let label: string;
    if (!isActive) {
      label = isText ? "A–Z ↕" : "1–9 ↕";
    } else if (sortDir === "asc") {
      label = isText ? "A–Z ↑" : "1–9 ↑";
    } else {
      label = isText ? "Z–A ↓" : "1–9 ↓";
    }
    return <span className={`text-[9px] font-medium tracking-normal whitespace-nowrap ${color}`}>{label}</span>;
  };

  /* ── Check if a column is visible ── */
  const columnIcons: Record<string, React.ElementType> = {
    marca: Tag,
    categoria: Layers,
    precioCompra: DollarSign,
    precioVenta: DollarSign,
    stock: Package,
    stockMinimo: AlertTriangle,
    proveedor: Truck,
    estado: ShieldCheck,
  };

  const vis = (key: string) => {
    if (key === "stockMinimo") return false;
    return key === "nombre" || colVis[key] !== false;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ═══════════════ Header: stat cards ═══════════════ */}
      <div className="grid grid-cols-4 gap-3 shrink-0 mb-3">
        {/* Total Productos */}
        <div className="bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(59,130,246,0.03))] border border-[#3B82F6]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(59,130,246,0.12)]">
          <div>
            <p className="text-xs text-[#3B82F6] font-extrabold uppercase tracking-wider">Total de Productos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{totalProductos}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Productos registrados</p>
          </div>
          <div className="p-3 bg-[#3B82F6]/15 rounded-full text-[#3B82F6] ring-1 ring-[#3B82F6]/20">
            <Package size={28} />
          </div>
        </div>

        {/* Stock Critico */}
        <div className="bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(245,158,11,0.03))] border border-[#F59E0B]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(245,158,11,0.12)]">
          <div>
            <p className="text-xs text-[#F59E0B] font-extrabold uppercase tracking-wider">Stock Critico</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">
              {stockCritico}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Productos con stock bajo</p>
          </div>
          <div className="p-3 bg-[#F59E0B]/15 rounded-full text-[#F59E0B] ring-1 ring-[#F59E0B]/20">
            <AlertTriangle size={28} />
          </div>
        </div>

        {/* Inactivos */}
        <div className="bg-[linear-gradient(135deg,rgba(148,163,184,0.10),rgba(148,163,184,0.03))] border border-[#94A3B8]/30 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(148,163,184,0.10)]">
          <div>
            <p className="text-xs text-[#94A3B8] font-extrabold uppercase tracking-wider">Inactivos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{inactivos}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Productos deshabilitados</p>
          </div>
          <div className="p-3 bg-[#94A3B8]/15 rounded-full text-[#94A3B8] ring-1 ring-[#94A3B8]/20">
            <FolderOpen size={28} />
          </div>
        </div>

        {/* Sin Stock */}
        <div className="bg-[linear-gradient(135deg,rgba(239,68,68,0.10),rgba(239,68,68,0.03))] border border-[#EF4444]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(239,68,68,0.12)]">
          <div>
            <p className="text-xs text-[#EF4444] font-extrabold uppercase tracking-wider">Sin Stock</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">
              {sinStock}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Productos agotados</p>
          </div>
          <div className="p-3 bg-[#EF4444]/15 rounded-full text-[#EF4444] ring-1 ring-[#EF4444]/20">
            <Package size={28} />
          </div>
        </div>
      </div>

      {/* ═══════════════ Table ═══════════════ */}
      <TableShell
        title="Inventario de Productos"
        hideHeaderTitle
        searchLabel="Busqueda de producto"
        searchPlaceholder="Buscar producto por nombre, categoria o marca..."
        searchValue={search}
        onSearchChange={setSearch}
        centeredHeaderControls
        isEmpty={sortedProducts.length === 0}
        emptyMessage={
          initialProducts.length === 0
            ? "No hay productos registrados."
            : "No se encontraron productos con los filtros aplicados."
        }
        emptyIcon={<Package size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <ProductFilterSelect
              label="Categoria"
              value={catFilter}
              onValueChange={setCatFilter}
              triggerIcon={Layers}
              minWidth="min-w-[150px]"
              tone={{
                trigger: "border-[#3B82F6]/25 hover:border-[#3B82F6]/60 focus-visible:border-[#3B82F6] focus-visible:ring-[#3B82F6]/20 data-[state=open]:border-[#3B82F6]/70 data-[state=open]:ring-[#3B82F6]/20",
                icon: "bg-[#3B82F6]/15 text-[#60A5FA] ring-[#3B82F6]/20",
                content: "border-[#3B82F6]/30",
                itemFocus: "focus:bg-[#3B82F6]/10",
                selected: "data-[state=checked]:bg-[#3B82F6]/12 data-[state=checked]:text-[#BFDBFE]",
                check: "text-[#60A5FA]",
                chevron: "text-[#60A5FA]",
              }}
              options={[
                { value: "all", label: "Todas", icon: Layers },
                ...categorias.map(cat => ({ value: String(cat.id), label: cat.nombre, icon: Layers })),
              ]}
            />

            <ProductFilterSelect
              label="Marca"
              value={marcaFilter}
              onValueChange={setMarcaFilter}
              triggerIcon={Tag}
              minWidth="min-w-[150px]"
              tone={{
                trigger: "border-violet-500/25 hover:border-violet-400/60 focus-visible:border-violet-400 focus-visible:ring-violet-500/20 data-[state=open]:border-violet-400/70 data-[state=open]:ring-violet-500/20",
                icon: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
                content: "border-violet-500/30",
                itemFocus: "focus:bg-violet-500/10",
                selected: "data-[state=checked]:bg-violet-500/12 data-[state=checked]:text-violet-200",
                check: "text-violet-300",
                chevron: "text-violet-300",
              }}
              options={[
                { value: "all", label: "Todas", icon: Tag },
                ...activeMarcas.map(m => ({ value: m.nombre, label: m.nombre, icon: Tag })),
              ]}
            />

            <ProductFilterSelect
              label="Estado"
              value={filterStatus}
              onValueChange={value => setFilterStatus(value as FilterStatus)}
              triggerIcon={CheckCircle}
              minWidth="min-w-[140px]"
              tone={{
                trigger: "border-emerald-500/25 hover:border-emerald-400/60 focus-visible:border-emerald-400 focus-visible:ring-emerald-500/20 data-[state=open]:border-emerald-400/70 data-[state=open]:ring-emerald-500/20",
                icon: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
                content: "border-emerald-500/30",
                itemFocus: "focus:bg-emerald-500/10",
                selected: "data-[state=checked]:bg-emerald-500/12 data-[state=checked]:text-emerald-200",
                check: "text-emerald-300",
                chevron: "text-emerald-300",
              }}
              options={[
                { value: "todos", label: "Todos", icon: ListFilter },
                { value: "activos", label: "Activos", icon: CheckCircle },
                { value: "inactivos", label: "Inactivos", icon: CircleOff },
              ]}
            />

            <ProductFilterSelect
              label="Stock"
              value={stockFilter}
              onValueChange={value => setStockFilter(value as typeof stockFilter)}
              triggerIcon={Package}
              minWidth="min-w-[168px]"
              tone={{
                trigger: "border-[#F59E0B]/25 hover:border-[#F59E0B]/60 focus-visible:border-[#F59E0B] focus-visible:ring-[#F59E0B]/20 data-[state=open]:border-[#F59E0B]/70 data-[state=open]:ring-[#F59E0B]/20",
                icon: "bg-[#F59E0B]/15 text-[#FBBF24] ring-[#F59E0B]/20",
                content: "border-[#F59E0B]/30",
                itemFocus: "focus:bg-[#F59E0B]/10",
                selected: "data-[state=checked]:bg-[#F59E0B]/12 data-[state=checked]:text-[#FDE68A]",
                check: "text-[#FBBF24]",
                chevron: "text-[#FBBF24]",
              }}
              options={[
                { value: "todos", label: "Todos", icon: Boxes },
                { value: "normal", label: "Con stock", icon: PackageCheck },
                { value: "poco", label: "Poco stock", icon: AlertTriangle },
                { value: "sin", label: "Sin stock", icon: PackageX },
              ]}
            />

            {/* Column visibility */}
            <div ref={colMenuRef} className="relative flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Columnas</label>
              <button
                type="button"
                onClick={() => setColMenuOpen(!colMenuOpen)}
                className={`group flex h-10 min-w-[132px] items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold shadow-[var(--shadow-sm)] transition-all duration-200 ${
                  colMenuOpen
                    ? "bg-[var(--bg)] text-[var(--text)] border-[#3B82F6]/70 ring-2 ring-[#3B82F6]/20"
                    : "bg-[var(--bg)] border-[#3B82F6]/25 text-[var(--text)] hover:border-[#3B82F6]/60"
                }`}
                title="Configurar columnas"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#60A5FA] ring-1 ring-[#3B82F6]/20">
                    <Columns3 size={14} />
                  </span>
                  Todos
                </span>
                <svg className={`h-3.5 w-3.5 text-[#60A5FA] transition-transform duration-200 ${colMenuOpen ? "rotate-180" : "group-hover:translate-y-0.5"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#3B82F6]/30 bg-[var(--panel)] p-2 shadow-[var(--shadow-lg)] ring-1 ring-[#3B82F6]/10 animate-in fade-in-0 zoom-in-95 duration-150">
                  <div className="flex items-start gap-3 border-b border-[#3B82F6]/15 px-2.5 pb-3 pt-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3B82F6]/15 text-[#60A5FA] ring-1 ring-[#3B82F6]/20">
                      <Columns3 size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-[var(--text)]">Seleccionar columnas</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">Mostrar u ocultar columnas de la tabla.</p>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-2 pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                    {COLUMNS.filter(c => c.key !== "acciones" && c.key !== "nombre").map(col => {
                      const ColumnIcon = columnIcons[col.key] ?? Columns3;
                      const checked = colVis[col.key] !== false;
                      return (
                        <label
                          key={col.key}
                          className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--text)] transition-all duration-150 hover:bg-[#3B82F6]/8"
                        >
                          <GripVertical size={14} className="shrink-0 text-[var(--text-secondary)]/55 transition-colors group-hover:text-[#60A5FA]" />
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColVis(col.key)}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--border)] accent-[#3B82F6] transition-transform duration-150 hover:scale-110"
                          />
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.035] text-[var(--text-secondary)] ring-1 ring-white/5 transition-colors group-hover:bg-[#3B82F6]/12 group-hover:text-[#60A5FA]">
                            <ColumnIcon size={14} />
                          </span>
                          <span className={`min-w-0 flex-1 font-semibold transition-colors ${checked ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}`}>
                            {col.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#3B82F6]/15 px-2.5 pb-1 pt-3">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                      Los cambios se aplican automáticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Agregar dropdown */}
            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
              <div ref={addMenuRef} className="relative flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Acciones</label>
                <button
                  type="button"
                  onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className={`group flex h-10 min-w-[140px] items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20 ${
                    addMenuOpen
                      ? "bg-[var(--bg)] text-[var(--text)] border-[var(--brand)]/70 ring-2 ring-[var(--brand)]/20"
                      : "bg-[var(--bg)] border-[var(--brand)]/30 text-[var(--text)] hover:border-[var(--brand)]/60"
                  }`}
                  title="Agregar"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
                      <PackagePlus size={16} strokeWidth={2.5} />
                    </span>
                    Agregar
                  </span>
                  <svg className={`h-3.5 w-3.5 text-[var(--brand)] transition-transform duration-200 ${addMenuOpen ? "rotate-180" : "group-hover:translate-y-0.5"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {addMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--brand)]/30 bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-[var(--brand)]/10 animate-in fade-in-0 zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); handleOpenAdd(); }}
                      className="group/item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text)] outline-none transition-colors hover:bg-[var(--brand-light)]/12"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/15 transition-colors group-hover/item:bg-[var(--brand-light)]/80">
                        <Package size={15} />
                      </span>
                      <span className="font-semibold">Nuevo producto</span>
                    </button>
                    <div className="my-1 border-t border-[var(--border)]/60" />
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); setAdminCatsOpen(true); }}
                      className="group/item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text)] outline-none transition-colors hover:bg-[#3B82F6]/10"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/12 text-[#60A5FA] ring-1 ring-[#3B82F6]/15 transition-colors group-hover/item:bg-[#3B82F6]/18">
                        <Layers size={15} />
                      </span>
                      <span className="font-semibold">Administrar categorías</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); setAdminMarcasOpen(true); }}
                      className="group/item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text)] outline-none transition-colors hover:bg-violet-500/10"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/15 transition-colors group-hover/item:bg-violet-500/18">
                        <Tag size={15} />
                      </span>
                      <span className="font-semibold">Administrar marcas</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      >
        <div className="min-w-full">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left">
            <thead className="bg-[#17191f]">
              <tr className="bg-[#17191f] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6]">
                {COLUMNS.map(col => {
                  if (!vis(col.key)) return null;
                  return (
                    <th
                      key={col.key}
                      className={`sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] ${COLUMN_WIDTH_CLASSES[col.key] ?? ""} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.sortable ? "cursor-pointer select-none hover:text-white hover:bg-[#1b1e26] transition-colors" : ""}`}
                      onClick={col.sortable && col.sortField ? () => handleSort(col.sortField!) : undefined}
                      title={col.sortable && col.sortField ? getSortTooltip(col.sortField) : undefined}
                    >
                      <div className={`flex items-center gap-2 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
                        {col.label}
                        {col.sortable && col.sortField && <SortIndicator field={col.sortField} />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-[13px] text-[var(--text-muted)]">
              {sortedProducts.map((p, index) => {
                const isLowStock = p.activo && p.cantidad <= p.stockMinimo;
                const stockStatus = p.cantidad === 0 ? "danger" : isLowStock ? "warning" : "success";
                return (
                  <tr
                    key={p.id}
                    onClick={(e) => handleProductRowClick(e, p)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      selectedProduct?.id === p.id
                        ? "bg-[#3B82F6]/10 ring-1 ring-inset ring-[#3B82F6]/20"
                        : isLowStock
                          ? "bg-[var(--warning-light)]/5 hover:bg-[var(--warning-light)]/10"
                          : index % 2 === 0
                            ? "bg-[#1E2129]/45 hover:bg-white/[0.045]"
                            : "bg-[#20242E]/45 hover:bg-white/[0.045]"
                    }`}
                  >
                    {vis("nombre") && (
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-start gap-3">
                          <div className="relative w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--border)] flex items-center justify-center">
                            {p.imagen ? (
                              <Image
                                src={p.imagen}
                                alt={p.nombre}
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <Package size={14} className="text-[var(--text-secondary)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[var(--text)] text-sm leading-snug whitespace-normal break-words [overflow-wrap:anywhere]" title={p.nombre}>{p.nombre}</p>
                            {p.marca && <p className="text-[11px] text-[var(--text-secondary)] truncate">{p.marca}</p>}
                          </div>
                        </div>
                      </td>
                    )}
                    {vis("marca") && (
                      <td className="py-3 px-4 text-sm text-[var(--text-muted)] whitespace-normal break-words [overflow-wrap:anywhere]">
                        {p.marca || <span className="italic text-[var(--text-secondary)]">—</span>}
                      </td>
                    )}
                    {vis("categoria") && (
                      <td className="py-3 px-4">
                        <Badge variant="default" size="sm" className="border-[#3B82F6]/20 bg-[#3B82F6]/8 px-2.5 py-1 text-[11px] font-semibold leading-none text-[#C7D2FE] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">{p.categoria.nombre}</Badge>
                      </td>
                    )}
                    {vis("precioCompra") && (
                      <td className="py-3 px-4 text-right text-sm font-mono font-medium text-[#60A5FA]">
                        {formatCurrency(p.precioCompra)}
                      </td>
                    )}
                    {vis("precioVenta") && (
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#22D3EE] text-sm">
                        {formatCurrency(p.precioVenta)}
                      </td>
                    )}
                    {vis("stock") && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Badge variant={stockStatus} size="sm" className="font-mono text-[11px]">
                            {p.cantidad} u
                          </Badge>
                          {isLowStock && (
                            <span className="text-[10px] text-[var(--warning)] font-bold uppercase mt-0.5 flex items-center space-x-0.5 animate-pulse">
                              <AlertTriangle size={8} />
                              <span>Bajo!</span>
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {vis("stockMinimo") && (
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center rounded-full border border-slate-500/20 bg-slate-400/8 px-2.5 py-1 text-[11px] font-mono font-semibold leading-none text-slate-300">
                          {p.stockMinimo} u
                        </span>
                      </td>
                    )}
                    {vis("proveedor") && (
                      <td className="py-3 px-4 text-sm text-[var(--text-muted)] whitespace-normal break-words [overflow-wrap:anywhere]">{p.proveedor.nombre}</td>
                    )}
                    {vis("estado") && (
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.activo ? "success" : "danger"} size="sm">
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TableShell>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[80] bg-black/20 animate-in fade-in-0 duration-200"
          onClick={closeProductDrawer}
        >
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col overflow-hidden border-l border-[var(--brand)] bg-[var(--card)] shadow-[-18px_0_42px_rgba(0,0,0,0.38)] animate-in slide-in-from-right duration-200 sm:w-[410px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${selectedProduct.nombre}`}
          >
            <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 overflow-hidden text-base font-black leading-snug text-[var(--text)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                      {selectedProduct.nombre}
                    </h3>
                    <Badge variant={selectedProduct.activo ? "success" : "danger"} size="sm" className="mt-0.5 shrink-0">
                      {selectedProduct.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  {selectedProduct.codigo && (
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
                      Codigo: <span className="font-mono text-[var(--text-muted)]">{selectedProduct.codigo}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeProductDrawer}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-brand"
                  aria-label="Cerrar detalle"
                  title="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              <div className="h-[220px] rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 p-4">
                <div className="flex h-full gap-4">
                  <div className="relative h-full w-[42%] shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
                    {selectedProduct.imagen ? (
                      <Image
                        src={selectedProduct.imagen}
                        alt={selectedProduct.nombre}
                        fill
                        sizes="190px"
                        className="object-contain p-3"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
                        <Package size={52} className="opacity-50" />
                      </div>
                    )}
                  </div>
                  <div className="grid h-full min-w-0 flex-1 grid-rows-4 gap-3 py-1">
                    <InfoLine label="Marca" value={selectedProduct.marca || "Sin marca"} />
                    <InfoLine label="Categoria" value={selectedProduct.categoria.nombre} />
                    <InfoLine label="Proveedor" value={selectedProduct.proveedor.nombre} />
                    <InfoLine
                      label="Estado"
                      value={(
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedProduct.activo ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                          {selectedProduct.activo ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <InfoCard className="h-[84px]" label="Precio compra" value={formatCurrency(selectedProduct.precioCompra)} valueClassName="text-[#60A5FA]" />
                <InfoCard className="h-[84px]" label="Precio venta" value={formatCurrency(selectedProduct.precioVenta)} valueClassName="text-[#22D3EE]" />
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <InfoCard className="h-[84px]" label="Stock actual" value={`${selectedProduct.cantidad} unidades`} valueClassName="text-[var(--success)]" />
                <InfoCard className="h-[84px]" label="Stock minimo" value={`${selectedProduct.stockMinimo} unidades`} valueClassName="text-slate-300" />
              </div>

              {(() => {
                const createdDate = formatOptionalDate(selectedProduct.createdAt);
                const updatedDate = formatOptionalDate(selectedProduct.updatedAt);
                if (!selectedProduct.codigo && !createdDate && !updatedDate) return null;

                return (
                  <div className="mt-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-3">
                    {selectedProduct.codigo && (
                      <InfoLine label="Codigo" value={selectedProduct.codigo} />
                    )}
                    {(createdDate || updatedDate) && (
                      <div className={cn("grid grid-cols-2 gap-2.5", selectedProduct.codigo && "mt-3 border-t border-[var(--border)]/70 pt-3")}>
                        {createdDate && <InfoLine label="Fecha de creacion" value={createdDate} />}
                        {updatedDate && <InfoLine label="Ultima modificacion" value={updatedDate} />}
                      </div>
                    )}
                  </div>
                );
              })()}

              {(selectedProduct.descripcion || selectedProduct.observacion) && (
                <div className="mt-2.5 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3.5 py-3">
                  {selectedProduct.descripcion && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Descripcion</p>
                      <p className="mt-1 text-sm leading-snug text-[var(--text)]">{selectedProduct.descripcion}</p>
                    </div>
                  )}
                  {selectedProduct.observacion && (
                    <div className={cn(selectedProduct.descripcion && "border-t border-[var(--border)]/70 pt-2.5")}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Observacion</p>
                      <p className="mt-1 text-sm leading-snug text-[var(--text)]">{selectedProduct.observacion}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2">
                {canManageProducts && (
                  <button
                    type="button"
                    onClick={() => runDrawerAction(handleEdit, selectedProduct)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#3B82F6]/40 bg-[#2563EB] px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-[#3B82F6]"
                  >
                    <Edit2 size={15} />
                    Editar producto
                  </button>
                )}
                {canManageProducts && selectedProduct.activo && (
                  <button
                    type="button"
                    onClick={() => runDrawerAction(handleRestarStock, selectedProduct)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#B77900] px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#A16207] focus-visible:outline-2 focus-visible:outline-[#F59E0B]"
                  >
                    <TrendingDown size={15} />
                    Restar stock
                  </button>
                )}
                {canManageProducts && selectedProduct.activo && (
                  <button
                    type="button"
                    onClick={() => runDrawerAction((p) => setSolicitarReposicionModal({ open: true, product: p }), selectedProduct)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#059669]/40 bg-[#047857] px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#065F46] focus-visible:outline-2 focus-visible:outline-[#059669]"
                  >
                    <PackagePlus size={15} />
                    Solicitar reposición
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runDrawerAction(handleHistorial, selectedProduct)}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-bold text-[var(--text)] transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <History size={15} />
                  Historial de estados
                </button>
                {canManageProducts && (
                  <button
                    type="button"
                    onClick={() => runDrawerAction(selectedProduct.activo ? handleDarBaja : handleReactivar, selectedProduct)}
                    className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold text-white shadow-sm transition-colors focus-visible:outline-2 ${
                      selectedProduct.activo
                        ? "border-[var(--danger)]/40 bg-[#B91C1C] hover:bg-[#991B1B] focus-visible:outline-[var(--danger)]"
                        : "border-[var(--success)]/40 bg-[#15803D] hover:bg-[#166534] focus-visible:outline-[var(--success)]"
                    }`}
                  >
                    {selectedProduct.activo ? <AlertTriangle size={15} /> : <RotateCcw size={15} />}
                    {selectedProduct.activo ? "Dar de baja" : "Activar"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={closeProductDrawer}
                className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X size={14} />
                Cerrar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ═══════════════ MODAL: Agregar / Editar ═══════════════ */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[1300px] max-h-[calc(100vh-40px)] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 py-2.5 border-b border-[var(--border)]">
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--brand-light)] text-[var(--brand)]">
                <Package size={16} />
              </div>
              {editingProduct ? "Editar Repuesto" : "Agregar Nuevo Repuesto"}
            </DialogTitle>
            <DialogDescription>
              Complete la información técnica y comercial del producto.
            </DialogDescription>
          </DialogHeader>

          <form
            id={PRODUCT_FORM_ID}
            onSubmit={handleFormSubmit}
            onInput={(event) => {
              setProductPurchaseCost(
                getProductPurchaseCost(
                  new FormData(event.currentTarget),
                  editingProduct ? "edit" : "create"
                )
              );
            }}
            className="flex-1 overflow-y-auto md:overflow-y-hidden px-4 py-3 space-y-2.5"
          >

            {/* ── Nombre del Repuesto (full width) ── */}
            <FormField label="Nombre del Repuesto" required className="mb-0">
              <Input
                name="nombre"
                type="text"
                defaultValue={editingProduct?.nombre || ""}
                required
                placeholder="Ej: Aceite Motul 5100 15W-50 4T"
              />
            </FormField>

            {/* ── Row 1: Marca | Categoría | Proveedor ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Marca" className="mb-0">
                <input type="hidden" name="marca" value={marcaValue} />
                <Combobox
                  value={marcaValue}
                  onChange={setMarcaValue}
                  options={uniqueBrands}
                  placeholder="Buscar o crear marca..."
                  onCreateNew={() => { /* Brand is just a string, no server action needed */ }}
                />
              </FormField>
              <FormField label="Categoría" required className="mb-0">
                <Combobox
                  value={categoriaValue}
                  onChange={(v) => setCategoriaValue(v)}
                  options={categorias.map(c => c.nombre)}
                  placeholder="Buscar o crear categoría..."
                  onCreateNew={async (v) => {
                    try {
                      const cat = await createCategoria(v);
                      setCategorias(prev => {
                        if (prev.some(c => c.id === cat.id)) return prev;
                        return [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre));
                      });
                    } catch { /* ignore */ }
                  }}
                />
              </FormField>
              <FormField label="Proveedor" required className="mb-0">
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
                  <select
                    name="proveedorId"
                    defaultValue={editingProduct?.proveedor.id || ""}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </FormField>
            </div>

            {/* ── Row 2: Imagen | Precios+StockMin | Stock ── */}
            <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_1fr] gap-3">

              {/* Column 1 — Image */}
              <div className="flex flex-col items-center gap-2">
                {imagePreview ? (
                  <div className="w-[140px] h-[140px] rounded-[var(--radius-md)] overflow-hidden border-2 border-[var(--border)] bg-[var(--bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Preview del formulario: puede ser Blob URL generada con URL.createObjectURL, incompatible con next/image. */}
                    <img src={imagePreview} alt="Vista previa del producto" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-[140px] h-[140px] rounded-[var(--radius-md)] bg-[var(--border)] flex items-center justify-center border-2 border-dashed border-[var(--border-hover)]">
                    <Package size={32} className="text-[var(--text-secondary)]" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <label className="inline-flex items-center px-2.5 py-1 bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)]/20 rounded-[var(--radius-md)] text-[11px] font-semibold hover:bg-[var(--brand)]/20 cursor-pointer transition">
                    <span>Seleccionar</span>
                    <input
                      type="file"
                      name="imagenFile"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.size > 2 * 1024 * 1024) {
                          alert("La imagen no puede superar 2MB");
                          e.target.value = "";
                          return;
                        }
                        if (file) {
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        const fi = document.querySelector('input[name="imagenFile"]') as HTMLInputElement;
                        if (fi) fi.value = "";
                        const hi = document.querySelector('input[name="imagen"]') as HTMLInputElement;
                        if (hi) hi.value = "";
                      }}
                      className="inline-flex items-center px-2.5 py-1 bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20 rounded-[var(--radius-md)] text-[11px] font-semibold hover:bg-[var(--danger)]/20 transition"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <input type="hidden" name="imagen" value={editingProduct?.imagen || ""} />
                <p className="text-[10px] text-[var(--text-secondary)]">JPG, PNG o WebP. Max 2MB.</p>
              </div>

              {/* Column 2 — Precios + Stock Mínimo */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign size={12} className="text-[var(--brand)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Comercial</span>
                </div>
                <FormField label="Precio Compra" required className="mb-0">
                  <Input name="precioCompra" type="number" step="0.01" defaultValue={editingProduct?.precioCompra || ""} required placeholder="0.00" className="font-mono py-2" />
                </FormField>
                <FormField label="Precio Venta" required className="mb-0">
                  <Input name="precioVenta" type="number" step="0.01" defaultValue={editingProduct?.precioVenta || ""} required placeholder="0.00" className="font-mono py-2" />
                </FormField>
                {editingProduct ? (
                  <FormField label="Stock Mínimo" required className="mb-0">
                    <Input name="stockMinimo" type="number" defaultValue={editingProduct.stockMinimo ?? ""} required placeholder="0" className="font-mono py-2" />
                  </FormField>
                ) : (
                  <FormField label="Stock de Seguridad Mínimo" required className="mb-0">
                    <Input name="stockMinimo" type="number" required placeholder="0" className="font-mono py-2" />
                  </FormField>
                )}
              </div>

              {/* Column 3 — Stock */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 size={12} className="text-[var(--brand)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Stock</span>
                </div>
                {editingProduct ? (
                  <FormField label="Stock Actual" className="mb-0">
                    <Input type="number" value={editingProduct.cantidad} disabled placeholder="0" className="font-mono bg-[var(--bg)]/50 py-2" />
                  </FormField>
                ) : (
                  <>
                    <FormField label="Stock Inicial" required className="mb-0">
                      <Input name="cantidad" type="number" min="0" required placeholder="0" className="font-mono py-2" />
                    </FormField>
                    {/* Payment Distribution for Initial Stock */}
                    <div className="col-span-full">
                      <PaymentDistribution
                        total={productPurchaseCost}
                        onChange={setPayments}
                        cajaBalance={cajaBalance}
                        cajaAbierta={cajaAbierta}
                        disabled={isPending}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>

          {/* ── Alertas (siempre visibles, ancladas sobre el footer) ── */}
          <div className="shrink-0 px-4 pt-1.5 space-y-2">
            {errorMsg && (
              <div className="p-2 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center space-x-2">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-2 bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--success)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center space-x-2">
                <CheckCircle size={14} />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* ── Footer fijo: Botones ── */}
          <div className="px-4 py-2.5 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" form={PRODUCT_FORM_ID} loading={isPending} disabled={isPending || distribucionIncompleta}>
              {editingProduct ? "Guardar cambios" : "Agregar Repuesto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODALS: Baja / Reactivar / Historial / Admin Cats ═══════════════ */}
      {bajaModal.product && (
        <DarBajaModal
          open={bajaModal.open}
          onOpenChange={(open) => setBajaModal({ open, product: open ? bajaModal.product : null })}
          producto={{ id: bajaModal.product.id, nombre: bajaModal.product.nombre }}
          onSuccess={() => router.refresh()}
        />
      )}

      {reactivarModal.product && (
        <ReactivarModal
          open={reactivarModal.open}
          onOpenChange={(open) => setReactivarModal({ open, product: open ? reactivarModal.product : null })}
          producto={{ id: reactivarModal.product.id, nombre: reactivarModal.product.nombre }}
          onSuccess={() => router.refresh()}
        />
      )}

      {historialModal.product && (
        <HistorialModal
          open={historialModal.open}
          onOpenChange={(open) => setHistorialModal({ open, product: open ? historialModal.product : null })}
          productoId={historialModal.product.id}
          productoNombre={historialModal.product.nombre}
        />
      )}

      <AdminEntityModal
        open={adminCatsOpen}
        onOpenChange={setAdminCatsOpen}
        userRole={userRole}
        onRefresh={handleRefreshCategorias}
        icon={Layers}
        title="Administrar categorías"
        searchPlaceholder="Buscar categoría..."
        createPlaceholder="Nueva categoría..."
        entityName="categoría"
        entityNamePlural="categorías"
        loadData={getCategoriasWithCount}
        createItem={createCategoria}
        updateItem={updateCategoria}
        toggleItemActivo={toggleCategoriaActivo}
      />

      <AdminEntityModal
        open={adminMarcasOpen}
        onOpenChange={setAdminMarcasOpen}
        userRole={userRole}
        onRefresh={() => { router.refresh(); handleRefreshMarcas(); }}
        icon={Layers}
        title="Administrar marcas"
        searchPlaceholder="Buscar marca..."
        createPlaceholder="Nueva marca..."
        entityName="marca"
        entityNamePlural="marcas"
        loadData={getMarcasWithCount}
        createItem={createMarca}
        updateItem={updateMarca}
        toggleItemActivo={toggleMarcaActivo}
      />

      {restarStockModal.product && (
        <RestarStockModal
          open={restarStockModal.open}
          onOpenChange={(open) => setRestarStockModal({ open, product: open ? restarStockModal.product : null })}
          producto={{
            id: restarStockModal.product.id,
            nombre: restarStockModal.product.nombre,
            cantidad: restarStockModal.product.cantidad,
          }}
          onSuccess={() => router.refresh()}
          restarStockAction={restarStock}
        />
      )}

      {solicitarReposicionModal.product && (
        <SolicitarReposicionModal
          open={solicitarReposicionModal.open}
          onOpenChange={(open) => setSolicitarReposicionModal({ open, product: open ? solicitarReposicionModal.product : null })}
          producto={{
            id: solicitarReposicionModal.product.id,
            nombre: solicitarReposicionModal.product.nombre,
            cantidad: solicitarReposicionModal.product.cantidad,
            precioCompra: solicitarReposicionModal.product.precioCompra,
            proveedorId: solicitarReposicionModal.product.proveedor.id,
          }}
          cajaBalance={cajaBalance}
          cajaAbierta={cajaAbierta}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
