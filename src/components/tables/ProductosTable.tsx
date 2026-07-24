"use client";

import React, { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createProducto,
  updateProducto,
  restarStock,
} from "@/actions/productos";
import { createCategoria, deleteCategoria, updateCategoria, toggleCategoriaActivo, getCategoriasWithCount, getCategorias, createMarca, updateMarca, toggleMarcaActivo, getMarcasWithCount, getMarcasActivas } from "@/actions/auxiliares";
import { formatCurrency } from "@/lib/utils";
import type { FilterStatus } from "./StatusFilter";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import DarBajaModal from "@/components/ui/DarBajaModal";
import ReactivarModal from "@/components/ui/ReactivarModal";
import HistorialModal from "@/components/ui/HistorialModal";
import AdminEntityModal from "@/components/ui/AdminEntityModal";
import RestarStockModal from "@/components/ui/RestarStockModal";
import {
  Plus,
  Search,
  Edit2,
  RotateCcw,
  AlertTriangle,
  FolderOpen,
  Package,
  CheckCircle,
  Truck,
  Layers,
  TrendingDown,
  MoreHorizontal,
  ArrowUpDown,
  Columns3,
  Tag,
  Trash2,
  X,
  Image as ImageIcon,
  DollarSign,
  BarChart3,
  Info,
} from "lucide-react";

/* ────────────────────── Types ────────────────────── */

interface Product {
  id: number;
  nombre: string;
  marca: string | null;
  marcaId: number | null;
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
  { key: "stockMinimo", label: "Stock Mínimo", sortable: true, sortField: "stockMinimo", defaultVisible: false, align: "center" },
  { key: "proveedor", label: "Proveedor", sortable: true, sortField: "proveedor", defaultVisible: false, align: "left" },
  { key: "estado", label: "Estado", sortable: false, defaultVisible: true, align: "center" },
  { key: "acciones", label: "Acciones", sortable: false, defaultVisible: true, align: "center" },
];

const COLUMN_VISIBILITY_KEY = "productos-column-visibility";

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

/* ────────────────────── Actions Dropdown ────────────────────── */

interface ActionsDropdownProps {
  product: Product;
  userRole: string;
  onEdit: (p: Product) => void;
  onDarBaja: (p: Product) => void;
  onReactivar: (p: Product) => void;
  onHistorial: (p: Product) => void;
  onRestarStock: (p: Product) => void;
}

function ActionsDropdown({ product, userRole, onEdit, onDarBaja, onReactivar, onHistorial, onRestarStock }: ActionsDropdownProps) {
  const canEdit = ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--border)]/60 text-[var(--text-secondary)] hover:text-[var(--text)] data-[state=open]:bg-[var(--border)] data-[state=open]:text-[var(--text)]"
          title="Acciones"
        >
          <MoreHorizontal size={18} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 w-56 bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] py-1.5"
        >
          {canEdit && (
            <DropdownMenu.Item
              onSelect={() => onEdit(product)}
              className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/60 flex items-center gap-2.5 transition-colors outline-none cursor-pointer"
            >
              <Edit2 size={16} className="text-[var(--text-secondary)]" />
              Editar
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => onHistorial(product)}
            className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/60 flex items-center gap-2.5 transition-colors outline-none cursor-pointer"
          >
            <Tag size={16} className="text-[var(--text-secondary)]" />
            Historial de estados
          </DropdownMenu.Item>
          {canEdit && product.activo && (
            <DropdownMenu.Item
              onSelect={() => onRestarStock(product)}
              className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--warning)] hover:bg-[var(--warning-light)]/20 flex items-center gap-2.5 transition-colors outline-none cursor-pointer"
            >
              <TrendingDown size={16} />
              Restar stock
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 border-t border-[var(--border)]/60" />
          {canEdit && product.activo && (
            <DropdownMenu.Item
              onSelect={() => onDarBaja(product)}
              className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)]/20 flex items-center gap-2.5 transition-colors outline-none cursor-pointer"
            >
              <AlertTriangle size={16} />
              Dar de baja
            </DropdownMenu.Item>
          )}
          {canEdit && !product.activo && (
            <DropdownMenu.Item
              onSelect={() => onReactivar(product)}
              className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--success)] hover:bg-[var(--success-light)]/20 flex items-center gap-2.5 transition-colors outline-none cursor-pointer"
            >
              <RotateCcw size={16} />
              Reactivar
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
  const [colVis, setColVis] = useState<Record<string, boolean>>(getDefaultColumnVisibility);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  /* ── Modals: form ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cantidadAReponer, setCantidadAReponer] = useState<number | "">("");

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
    }
  }, [isModalOpen]);

  /* ── Column visibility click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Load column visibility from localStorage after mount ── */
  useEffect(() => {
    setColVis(loadColumnVisibility());
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
    setCantidadAReponer("");
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(product.imagen || null);
    setMarcaValue(product.marca || "");
    setCategoriaValue(product.categoria.nombre);
    setIsModalOpen(true);
  }, []);

  const handleOpenAdd = useCallback(() => {
    setEditingProduct(null);
    setCantidadAReponer("");
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(null);
    setMarcaValue("");
    setCategoriaValue("");
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

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const formData = new FormData(e.currentTarget);
    // Inject combobox values as hidden fields
    formData.set("marca", marcaValue);
    const matchedCat = categorias.find(c => c.nombre === categoriaValue);
    formData.set("categoriaId", matchedCat ? String(matchedCat.id) : "");

    startTransition(async () => {
      let res;
      if (editingProduct) {
        res = await updateProducto(editingProduct.id, formData);
      } else {
        res = await createProducto(formData);
      }

      if (res.success) {
        setSuccessMsg(
          editingProduct
            ? "Producto actualizado exitosamente."
            : "Producto creado exitosamente."
        );
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg("");
        }, 1500);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Ocurrió un error inesperado.");
      }
    });
    }, [editingProduct, marcaValue, categoriaValue, categorias, router]);

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
  const vis = (key: string) => colVis[key] !== false;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ═══════════════ Header: stat cards ═══════════════ */}
      <div className="grid grid-cols-4 gap-3 shrink-0 mb-3">
        {/* Total Productos */}
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total de Productos</p>
            <p className="text-2xl font-extrabold text-[var(--text)]">{totalProductos}</p>
          </div>
          <div className="p-2.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <Package size={20} />
          </div>
        </div>

        {/* Stock Crítico */}
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Stock Crítico</p>
            <p className={`text-2xl font-extrabold ${stockCritico > 0 ? "text-[var(--warning)]" : "text-[var(--text)]"}`}>
              {stockCritico}
            </p>
          </div>
          <div className={`p-2.5 rounded-lg ${stockCritico > 0 ? "bg-[var(--warning-light)] text-[var(--warning)] animate-pulse" : "bg-[var(--border)] text-[var(--text-secondary)]"}`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Inactivos */}
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-2xl font-extrabold text-[var(--text)]">{inactivos}</p>
          </div>
          <div className="p-2.5 bg-[var(--border)] rounded-lg text-[var(--text-secondary)]">
            <FolderOpen size={20} />
          </div>
        </div>

        {/* Sin Stock */}
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Sin Stock</p>
            <p className={`text-2xl font-extrabold ${sinStock > 0 ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>
              {sinStock}
            </p>
          </div>
          <div className={`p-2.5 rounded-lg ${sinStock > 0 ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--border)] text-[var(--text-secondary)]"}`}>
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* ═══════════════ Table ═══════════════ */}
      <TableShell
        title="Inventario de Productos"
        searchPlaceholder="Buscar producto..."
        searchValue={search}
        onSearchChange={setSearch}
        isEmpty={sortedProducts.length === 0}
        emptyMessage={
          initialProducts.length === 0
            ? "No hay productos registrados."
            : "No se encontraron productos con los filtros aplicados."
        }
        emptyIcon={<Package size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {/* Categoría */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Categoría</label>
              <div className="relative">
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  className="pl-3 pr-7 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] appearance-none cursor-pointer min-w-[140px]"
                >
                  <option value="all">Todas</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Marca */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Marca</label>
              <div className="relative">
                <select
                  value={marcaFilter}
                  onChange={e => setMarcaFilter(e.target.value)}
                  className="pl-3 pr-7 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] appearance-none cursor-pointer min-w-[140px]"
                >
                  <option value="all">Todas</option>
                  {activeMarcas.map(m => (
                    <option key={m.id} value={m.nombre}>{m.nombre}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Estado */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Estado</label>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                  className="pl-3 pr-7 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] appearance-none cursor-pointer min-w-[130px]"
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Stock */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Stock</label>
              <div className="relative">
                <select
                  value={stockFilter}
                  onChange={e => setStockFilter(e.target.value as typeof stockFilter)}
                  className="pl-3 pr-7 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] appearance-none cursor-pointer min-w-[130px]"
                >
                  <option value="todos">Todos</option>
                  <option value="normal">Con stock</option>
                  <option value="poco">Poco stock</option>
                  <option value="sin">Sin stock</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Column visibility */}
            <div ref={colMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setColMenuOpen(!colMenuOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
                  colMenuOpen 
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]" 
                    : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--text)]"
                }`}
                title="Configurar columnas"
              >
                <Columns3 size={14} />
                <span>Columnas</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 z-50 mt-1 w-52 bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] py-1">
                  {COLUMNS.filter(c => c.key !== "acciones").map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--border)]/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={colVis[col.key] !== false}
                        onChange={() => toggleColVis(col.key)}
                        className="accent-[var(--brand)]"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Agregar dropdown */}
            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
              <div ref={addMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand)]/90 transition"
                >
                  <Plus size={14} />
                  Agregar
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {addMenuOpen && (
                  <div className="absolute right-0 z-50 mt-1 w-56 bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] py-1.5">
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); handleOpenAdd(); }}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/60 flex items-center gap-2.5 transition-colors"
                    >
                      <Package size={16} className="text-[var(--brand)]" />
                      Nuevo producto
                    </button>
                    <div className="my-1 border-t border-[var(--border)]/60" />
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); setAdminCatsOpen(true); }}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/60 flex items-center gap-2.5 transition-colors"
                    >
                      <Tag size={16} className="text-[var(--text-secondary)]" />
                      Administrar categorías
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); setAdminMarcasOpen(true); }}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/60 flex items-center gap-2.5 transition-colors"
                    >
                      <Layers size={16} className="text-[var(--text-secondary)]" />
                      Administrar marcas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      >
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-[var(--panel)]">
              <tr className="border-b-2 border-[var(--border)] text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                {COLUMNS.map(col => {
                  if (!vis(col.key)) return null;
                  return (
                    <th
                      key={col.key}
                      className={`py-3.5 px-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.sortable ? "cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors" : ""}`}
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
              {sortedProducts.map(p => {
                const isLowStock = p.activo && p.cantidad <= p.stockMinimo;
                const stockStatus = p.cantidad === 0 ? "danger" : isLowStock ? "warning" : "success";
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-[var(--panel)] transition duration-150 ${
                      isLowStock ? "bg-[var(--warning-light)]/5 hover:bg-[var(--warning-light)]/10" : ""
                    }`}
                  >
                    {vis("nombre") && (
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--border)] flex items-center justify-center">
                            {p.imagen ? (
                              <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={14} className="text-[var(--text-secondary)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text)] text-sm truncate" title={p.nombre}>{p.nombre}</p>
                            {p.marca && <p className="text-[11px] text-[var(--text-secondary)] truncate">{p.marca}</p>}
                          </div>
                        </div>
                      </td>
                    )}
                    {vis("marca") && (
                      <td className="py-3 px-4 text-sm text-[var(--text-muted)]">
                        {p.marca || <span className="italic text-[var(--text-secondary)]">—</span>}
                      </td>
                    )}
                    {vis("categoria") && (
                      <td className="py-3 px-4">
                        <Badge variant="default" size="sm">{p.categoria.nombre}</Badge>
                      </td>
                    )}
                    {vis("precioCompra") && (
                      <td className="py-3 px-4 text-right text-sm font-mono text-[var(--text-secondary)]">
                        {formatCurrency(p.precioCompra)}
                      </td>
                    )}
                    {vis("precioVenta") && (
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--brand)] text-sm">
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
                      <td className="py-3 px-4 text-center text-sm font-mono text-[var(--text-secondary)]">
                        {p.stockMinimo}
                      </td>
                    )}
                    {vis("proveedor") && (
                      <td className="py-3 px-4 text-sm text-[var(--text-muted)]">{p.proveedor.nombre}</td>
                    )}
                    {vis("estado") && (
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.activo ? "success" : "danger"} size="sm">
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    )}
                    {vis("acciones") && (
                      <td className="py-3 px-4 text-center">
                        <ActionsDropdown
                          product={p}
                          userRole={userRole}
                          onEdit={handleEdit}
                          onDarBaja={handleDarBaja}
                          onReactivar={handleReactivar}
                          onHistorial={handleHistorial}
                          onRestarStock={handleRestarStock}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TableShell>

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

          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto md:overflow-y-hidden px-4 py-3 space-y-2.5">

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
                  onCreateNew={(v) => { /* Brand is just a string, no server action needed */ }}
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
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
                  <>
                    <FormField label="Stock Actual" className="mb-0">
                      <Input type="number" value={editingProduct.cantidad} disabled placeholder="0" className="font-mono bg-[var(--bg)]/50 py-2" />
                    </FormField>
                    <FormField label="Cantidad a Reponer" className="mb-0">
                      <Input
                        type="number"
                        min="0"
                        value={cantidadAReponer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCantidadAReponer(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                        }}
                        placeholder="0"
                        className="font-mono py-2"
                      />
                    </FormField>
                    <FormField label="Nuevo Stock" className="mb-0">
                      <div className="relative">
                        <Input
                          name="cantidad"
                          type="number"
                          value={editingProduct.cantidad + (Number(cantidadAReponer) || 0)}
                          readOnly
                          placeholder="0"
                          className="font-mono font-bold bg-[var(--brand-light)]/40 text-[var(--brand)] border-[var(--brand)]/30 py-2"
                        />
                      </div>
                    </FormField>
                  </>
                ) : (
                  <FormField label="Stock Inicial" required className="mb-0">
                    <Input name="cantidad" type="number" required placeholder="0" className="font-mono py-2" />
                  </FormField>
                )}
              </div>
            </div>

            {/* ── Regla Transaccional (one line, no card) ── */}
            {editingProduct && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] py-1">
                <Info size={12} className="text-[var(--brand)]" />
                <span><strong>Regla:</strong> Al incrementar stock se registrará una reposición y la salida en Caja.</span>
              </div>
            )}

            {/* ── Alertas ── */}
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

          </form>

          {/* ── Footer fijo: Botones ── */}
          <div className="px-4 py-2.5 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" form={undefined} loading={isPending} disabled={isPending}
              onClick={(e) => { e.preventDefault(); (e.currentTarget.closest('dialog')?.querySelector('form') as HTMLFormElement)?.requestSubmit(); }}>
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
        icon={Tag}
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
    </div>
  );
}
