"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { TableShell } from "@/components/ui/table-shell";
import { ToolbarSelect } from "@/components/ui/toolbar-select";
import { formatDate,formatDateShort } from "@/lib/utils";
import {
AlertTriangle,
Building2,
Calendar,
CheckCircle2,
CircleOff,
Edit3,
History,
Info,
Loader2,
Mail,
MapPin,
Package,
Phone,
Plus,
Shield,
Truck,
UserCheck,
UserX
} from "lucide-react";
import React,{ useCallback,useMemo,useState,useTransition } from "react";
import type { FilterStatus } from "./StatusFilter";

// ─── Types ────────────────────────────────────────────────────────
type ProveedorConDetalles = {
  id: number;
  nombre: string;
  contactoResponsable: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  cuit: string;
  activo: boolean;
  creadoEn: Date;
  _count: {
    productos: number;
    compras: number;
  };
};

type ProductoVinculado = {
  id: number;
  nombre: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  categoria: {
    nombre: string;
  };
};

type CompraHistorial = {
  id: number;
  fecha: Date;
  total: number;
  usuario: {
    nombreCompleto: string;
    username: string;
  };
  detalles: {
    id: number;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
    producto: {
      nombre: string;
    };
  }[];
};

// ─── Sort ─────────────────────────────────────────────────────────
type SortField = "nombre" | "cuit" | "productos" | "activo";
type SortDir = "asc" | "desc" | null;

const TEXT_SORT_FIELDS = new Set<SortField>(["nombre", "cuit"]);

interface ProveedoresTableProps {
  initialProveedores: ProveedorConDetalles[];
  onCreateProveedor: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onUpdateProveedor: (id: number, formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onSearch: (query: string, soloActivos: boolean) => Promise<ProveedorConDetalles[]>;
  onGetProductos: (id: number) => Promise<ProductoVinculado[]>;
  onGetHistorial: (id: number) => Promise<CompraHistorial[]>;
}

export default function ProveedoresTable({
  initialProveedores,
  onCreateProveedor,
  onUpdateProveedor,
  onToggleEstado,
  onSearch,
  onGetProductos,
  onGetHistorial,
}: ProveedoresTableProps) {
  const [proveedores, setProveedores] = useState<ProveedorConDetalles[]>(initialProveedores);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("activos");

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [, startTransition] = useTransition();

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProv, setEditingProv] = useState<ProveedorConDetalles | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Detalles/Historial
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProv, setSelectedProv] = useState<ProveedorConDetalles | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "productos" | "historial">("info");
  const [linkedProducts, setLinkedProducts] = useState<ProductoVinculado[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<CompraHistorial[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Diálogo de Confirmación (solo toggle)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    provId: number;
    provName: string;
    isActive?: boolean;
    errorMsg?: string | null;
  }>({ open: false, provId: 0, provName: "" });

  // ─── Sort handlers ─────────────────────────────────────────────
  const handleSortCycle = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") setSortDir(null);
      else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField, sortDir]);

  const getSortTooltip = (field: SortField): string => {
    const isText = TEXT_SORT_FIELDS.has(field);
    if (sortField !== field || sortDir === null) return isText ? "Ordenar de A a Z" : "Ordenar de menor a mayor";
    if (sortDir === "asc") return isText ? "Ordenar de Z a A" : "Ordenar de mayor a menor";
    return "Quitar ordenamiento";
  };

  const renderSortIndicator = (field: SortField) => {
    const isActive = sortField === field && sortDir !== null;
    const isText = TEXT_SORT_FIELDS.has(field);
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

  // ─── Search handler ───────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    startTransition(async () => {
      const results = await onSearch(query, false);
      setProveedores(results);
    });
  };

  // Filtrado client-side por estado
  const filteredProveedores = useMemo(() => {
    return proveedores.filter((p) => {
      if (filterStatus === "todos") return true;
      if (filterStatus === "activos") return p.activo;
      if (filterStatus === "inactivos") return !p.activo;
      return true;
    });
  }, [proveedores, filterStatus]);

  // Sorting
  const sortedProveedores = useMemo(() => {
    const result = [...filteredProveedores];
    if (!sortField || !sortDir) return result;
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "nombre": cmp = a.nombre.localeCompare(b.nombre); break;
        case "cuit": cmp = a.cuit.localeCompare(b.cuit); break;
        case "productos": cmp = a._count.productos - b._count.productos; break;
        case "activo": cmp = (a.activo ? 0 : 1) - (b.activo ? 0 : 1); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [filteredProveedores, sortField, sortDir]);

  // Open Create/Edit modal
  const openCreateModal = () => {
    setEditingProv(null);
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const openEditModal = (prov: ProveedorConDetalles, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProv(prov);
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProv(null);
    setFormError(null);
    setFormSuccess(false);
  };

  // ─── Form submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    let result;
    if (editingProv) {
      result = await onUpdateProveedor(editingProv.id, formData);
    } else {
      result = await onCreateProveedor(formData);
    }

    if (result.error) {
      setFormError(result.error);
      setIsSubmitting(false);
      return;
    }

    setFormSuccess(true);
    setIsSubmitting(false);

    const results = await onSearch(searchQuery, false);
    setProveedores(results);

    setTimeout(() => {
      closeModal();
    }, 800);
  };

  // ─── Open Details/History modal ─────────────────────────────
  const openDetailModal = async (prov: ProveedorConDetalles) => {
    setSelectedProv(prov);
    setActiveTab("info");
    setDetailModalOpen(true);
    setLoadingDetails(true);
    setLinkedProducts([]);
    setPurchaseHistory([]);

    try {
      const [prods, history] = await Promise.all([
        onGetProductos(prov.id),
        onGetHistorial(prov.id),
      ]);
      setLinkedProducts(prods);
      setPurchaseHistory(history);
    } catch (err) {
      console.error("Error al cargar detalles del proveedor:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ─── Actions handlers ───────────────────────────────────────
  const handleToggleEstado = async () => {
    const { provId } = confirmDialog;
    const result = await onToggleEstado(provId);
    if (result.success) {
      setConfirmDialog({ ...confirmDialog, open: false });
      const results = await onSearch(searchQuery, false);
      setProveedores(results);
    } else {
      setConfirmDialog({ ...confirmDialog, errorMsg: result.error });
    }
  };

  const openConfirmDialog = (
    prov: ProveedorConDetalles,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setConfirmDialog({
      open: true,
      provId: prov.id,
      provName: prov.nombre,
      isActive: prov.activo,
      errorMsg: null,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1. Stats Cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0 mb-3">
        <div className="bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(59,130,246,0.03))] border border-[#3B82F6]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(59,130,246,0.12)]">
          <div>
            <p className="text-xs text-[#3B82F6] font-extrabold uppercase tracking-wider">Total Proveedores</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{proveedores.length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Proveedores registrados</p>
          </div>
          <div className="p-3 bg-[#3B82F6]/15 rounded-full text-[#3B82F6] ring-1 ring-[#3B82F6]/20">
            <Truck size={28} />
          </div>
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.03))] border border-[#22C55E]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(34,197,94,0.12)]">
          <div>
            <p className="text-xs text-[#22C55E] font-extrabold uppercase tracking-wider">Activos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{proveedores.filter((p) => p.activo).length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Proveedores habilitados</p>
          </div>
          <div className="p-3 bg-[#22C55E]/15 rounded-full text-[#22C55E] ring-1 ring-[#22C55E]/20">
            <UserCheck size={28} />
          </div>
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(148,163,184,0.10),rgba(148,163,184,0.03))] border border-[#94A3B8]/30 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(148,163,184,0.10)]">
          <div>
            <p className="text-xs text-[#94A3B8] font-extrabold uppercase tracking-wider">Inactivos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{proveedores.filter((p) => !p.activo).length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Proveedores dados de baja</p>
          </div>
          <div className="p-3 bg-[#94A3B8]/15 rounded-full text-[#94A3B8] ring-1 ring-[#94A3B8]/20">
            <UserX size={28} />
          </div>
        </div>
      </div>

      {/* 2. TableShell */}
      <TableShell
        title="Proveedores"
        hideHeaderTitle
        searchLabel="Busqueda de proveedor"
        searchPlaceholder="Buscar proveedor por nombre, CUIT o responsable..."
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        centeredHeaderControls
        isEmpty={sortedProveedores.length === 0}
        emptyMessage="No se encontraron proveedores"
        emptyIcon={<Building2 size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <ToolbarSelect
              label="Estado"
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as FilterStatus)}
              triggerIcon={CheckCircle2}
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
                { value: "todos", label: "Todos", icon: Building2 },
                { value: "activos", label: "Activos", icon: CheckCircle2 },
                { value: "inactivos", label: "Inactivos", icon: CircleOff },
              ]}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Acciones</label>
              <button onClick={openCreateModal} className="group flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20">
                <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
                  <Truck size={14} strokeWidth={2.5} />
                  <Plus size={8} strokeWidth={3} className="absolute top-0 right-0" />
                </span>
                Nuevo Proveedor
              </button>
            </div>
          </div>
        }
      >
        <div className="min-w-full">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left min-w-[700px]">
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead className="bg-[#17191f]">
              <tr className="bg-[#17191f] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6]">
                <th
                  className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] cursor-pointer select-none hover:text-white hover:bg-[#1b1e26] transition-colors"
                  onClick={() => handleSortCycle("nombre")}
                  title={getSortTooltip("nombre")}
                >
                  <div className="flex items-center gap-2">Proveedor {renderSortIndicator("nombre")}</div>
                </th>
                <th
                  className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] cursor-pointer select-none hover:text-white hover:bg-[#1b1e26] transition-colors"
                  onClick={() => handleSortCycle("cuit")}
                  title={getSortTooltip("cuit")}
                >
                  <div className="flex items-center gap-2">CUIT {renderSortIndicator("cuit")}</div>
                </th>
                <th className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] hidden md:table-cell">Contacto</th>
                <th
                  className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 text-center shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] cursor-pointer select-none hover:text-white hover:bg-[#1b1e26] transition-colors"
                  onClick={() => handleSortCycle("productos")}
                  title={getSortTooltip("productos")}
                >
                  <div className="flex items-center justify-center gap-2">Artículos {renderSortIndicator("productos")}</div>
                </th>
                <th
                  className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 text-center shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] cursor-pointer select-none hover:text-white hover:bg-[#1b1e26] transition-colors"
                  onClick={() => handleSortCycle("activo")}
                  title={getSortTooltip("activo")}
                >
                  <div className="flex items-center justify-center gap-2">Estado {renderSortIndicator("activo")}</div>
                </th>
                <th className="sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 text-center shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-[13px] text-[var(--text-muted)]">
              {sortedProveedores.map((prov, index) => (
                <tr
                  key={prov.id}
                  onClick={() => openDetailModal(prov)}
                  className={`group cursor-pointer transition-colors duration-150 ${index % 2 === 0 ? "bg-[#1E2129]/45 hover:bg-white/[0.045]" : "bg-[#20242E]/45 hover:bg-white/[0.045]"} ${
                    !prov.activo ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          prov.activo
                            ? "bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)]/20"
                            : "bg-[var(--border)] text-[var(--text-secondary)] border border-[var(--border)]"
                        }`}
                      >
                        <Truck size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text)] text-sm leading-tight group-hover:text-[var(--brand)] transition-colors truncate">
                          {prov.nombre}
                        </p>
                        {prov.direccion && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1 truncate">
                            <MapPin size={9} className="text-[var(--text-secondary)] shrink-0" />
                            {prov.direccion}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-[var(--text-muted)]">{prov.cuit}</span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {prov.email && (
                        <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                          <Mail size={10} className="text-[var(--text-secondary)] shrink-0" />
                          {prov.email}
                        </p>
                      )}
                      {prov.telefono && (
                        <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                          <Phone size={10} className="text-[var(--text-secondary)] shrink-0" />
                          {prov.telefono}
                        </p>
                      )}
                      {!prov.email && !prov.telefono && (
                        <p className="text-[11px] text-[var(--text-secondary)] italic">Sin datos</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-[var(--text)]">
                    {prov._count.productos}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={prov.activo ? "success" : "danger"} size="sm">
                      {prov.activo ? "Activo" : "Baja"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openEditModal(prov, e)}
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openConfirmDialog(prov, e)}
                        title="Cambiar estado"
                        className={prov.activo ? "hover:text-[var(--warning)]" : "hover:text-[var(--success)]"}
                      >
                        {prov.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>

      {/* 3. Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#12151d] to-[#181c25] px-6 py-5 border-b border-[var(--border)]">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="p-2 bg-[var(--brand-light)] rounded-[var(--radius-md)] text-[var(--brand)] border border-[var(--brand)]/10">
                {editingProv ? <Edit3 size={18} /> : <Truck size={18} />}
              </div>
              {editingProv ? "Editar Proveedor" : "Nuevo Proveedor"}
              </DialogTitle>
              <DialogDescription className="text-sm">
              {editingProv
                ? "Modifique los datos comerciales del proveedor"
                : "Registre un nuevo proveedor de abastecimiento"}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 bg-[linear-gradient(180deg,rgba(17,20,28,0.98),rgba(14,16,22,0.98))]">
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--success)] text-xs">
                <CheckCircle2 size={14} className="shrink-0" />
                {editingProv
                  ? "Proveedor actualizado correctamente"
                  : "Proveedor registrado correctamente"}
              </div>
            )}

            <FormField label="Razón Social / Empresa" required>
              <Input
                id="input-prov-nombre"
                name="nombre"
                type="text"
                required
                defaultValue={editingProv?.nombre || ""}
                placeholder="Ej: Repuestos Posadas S.A."
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="CUIT" required>
                <Input
                  id="input-prov-cuit"
                  name="cuit"
                  type="text"
                  required
                  defaultValue={editingProv?.cuit || ""}
                  placeholder="Ej: 30123456789"
                />
              </FormField>
              <FormField label="Contacto Responsable">
                <Input
                  id="input-prov-contacto"
                  name="contactoResponsable"
                  type="text"
                  defaultValue={editingProv?.contactoResponsable || ""}
                  placeholder="Ej: Ing. Jorge Gómez"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Correo Electrónico">
                <Input
                  id="input-prov-correo"
                  name="email"
                  type="email"
                  defaultValue={editingProv?.email || ""}
                  placeholder="ventas@proveedor.com"
                />
              </FormField>
              <FormField label="Teléfono">
                <Input
                  id="input-prov-telefono"
                  name="telefono"
                  type="text"
                  defaultValue={editingProv?.telefono || ""}
                  placeholder="Ej: 3764555888"
                />
              </FormField>
            </div>

            <FormField label="Dirección Comercial">
              <Input
                id="input-prov-direccion"
                name="direccion"
                type="text"
                defaultValue={editingProv?.direccion || ""}
                placeholder="Ej: Av. Uruguay 1234, Posadas, Misiones"
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                id="btn-submit-proveedor"
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {editingProv ? "Guardar Cambios" : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Detailed Info/Products/History Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {selectedProv && (
            <>
              <div className="bg-gradient-to-r from-[#111827] via-[#151923] to-[#10131a] px-6 py-5 border-b border-[var(--border)] flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)]/20 flex items-center justify-center shadow-[0_10px_28px_rgba(59,130,246,0.14)]">
                    <Truck size={26} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text)] leading-tight">
                      {selectedProv.nombre}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-mono text-xs text-[var(--text-secondary)]">
                        CUIT: {selectedProv.cuit}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--border)]" />
                      <Badge variant={selectedProv.activo ? "success" : "danger"} size="sm">
                        {selectedProv.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex border-b border-[var(--border)] bg-[#17191f] px-4">
                {[
                  { id: "info", label: "Ficha Técnica", icon: <Info size={14} /> },
                  { id: "productos", label: "Productos del Catálogo", icon: <Package size={14} /> },
                  { id: "historial", label: "Historial de Abastecimiento", icon: <History size={14} /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold tracking-wide border-b-2 transition-all ${
                      activeTab === tab.id
                        ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand-light)]/5"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--border)]/20"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 max-h-[62vh] overflow-y-auto min-h-[420px]">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)] gap-3">
                    <Loader2 size={32} className="text-[var(--brand)] animate-spin" />
                    <p className="text-sm font-medium">Consultando registros históricos...</p>
                  </div>
                ) : (
                  <>
                    {activeTab === "info" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            Información de la Empresa
                          </h4>
                          <div className="space-y-3 bg-[#151922] p-4 rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)]">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Razón Social</span>
                              <p className="text-sm font-semibold text-[var(--text)]">{selectedProv.nombre}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">CUIT Fiscal</span>
                              <p className="text-sm font-mono text-[var(--text-muted)]">{selectedProv.cuit}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Fecha de Registro</span>
                              <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                                <Calendar size={13} className="text-[var(--text-secondary)]" />
                                {formatDateShort(selectedProv.creadoEn)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            Datos de Contacto
                          </h4>
                          <div className="space-y-3 bg-[#151922] p-4 rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)]">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Responsable Comercial</span>
                              <p className="text-sm font-semibold text-[var(--text)]">
                                {selectedProv.contactoResponsable || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Teléfono Directo</span>
                              <p className="text-sm text-[var(--brand)] font-semibold flex items-center gap-1.5 mt-0.5">
                                <Phone size={13} />
                                {selectedProv.telefono || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Correo Electrónico</span>
                              <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                                <Mail size={13} className="text-[var(--text-secondary)]" />
                                {selectedProv.email || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Domicilio Fiscal</span>
                              <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                                <MapPin size={13} className="text-[var(--text-secondary)] shrink-0" />
                                {selectedProv.direccion || "No especificado"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "productos" && (
                      <div className="space-y-3">
                        {linkedProducts.length === 0 ? (
                          <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg)]/20 rounded-[var(--radius-lg)] border border-[var(--border)]/50">
                            <Package size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-semibold">Sin productos asociados</p>
                            <p className="text-xs">No hay productos en inventario vinculados a este proveedor.</p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]/30">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[var(--bg)]/60 text-[var(--text-secondary)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--border)]">
                                <tr>
                                  <th className="py-2.5 px-4">Producto</th>
                                  <th className="py-2.5 px-4">Categoría</th>
                                  <th className="py-2.5 px-4 text-right">Precio Compra</th>
                                  <th className="py-2.5 px-4 text-right">Precio Venta</th>
                                  <th className="py-2.5 px-4 text-center">Stock</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]/50">
                                {linkedProducts.map((prod) => (
                                  <tr key={prod.id} className="hover:bg-[var(--border)]/20">
                                    <td className="py-2.5 px-4 font-semibold text-[var(--text)]">{prod.nombre}</td>
                                    <td className="py-2.5 px-4 text-[var(--text-muted)]">{prod.categoria.nombre}</td>
                                    <td className="py-2.5 px-4 text-right text-[var(--text-muted)] font-mono">${prod.precioCompra.toFixed(2)}</td>
                                    <td className="py-2.5 px-4 text-right text-[var(--brand)] font-mono font-semibold">${prod.precioVenta.toFixed(2)}</td>
                                    <td className="py-2.5 px-4 text-center">
                                      <Badge
                                        variant={prod.cantidad <= prod.stockMinimo ? "danger" : "success"}
                                        size="sm"
                                        className="font-mono"
                                      >
                                        {prod.cantidad}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "historial" && (
                      <div className="space-y-4">
                        {purchaseHistory.length === 0 ? (
                          <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg)]/20 rounded-[var(--radius-lg)] border border-[var(--border)]/50">
                            <History size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-semibold">Sin compras registradas</p>
                            <p className="text-xs">No se registran transacciones de abastecimiento con este proveedor.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {purchaseHistory.map((compra) => (
                              <div
                                key={compra.id}
                                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]/40 p-4 space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/60 text-[11px]">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-[var(--text)] bg-[var(--border)] px-2 py-0.5 rounded">
                                      Compra #{compra.id}
                                    </span>
                                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                                      <Calendar size={11} />
                                      {formatDate(compra.fecha)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                                      <Shield size={11} className="text-[var(--brand)]" />
                                      Por: <strong className="text-[var(--text-muted)] font-semibold">{compra.usuario.nombreCompleto}</strong>
                                    </span>
                                    <span className="text-[var(--brand)] font-bold font-mono text-xs">
                                      Total: ${compra.total.toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  {compra.detalles.map((det) => (
                                    <div
                                      key={det.id}
                                      className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-[var(--border)]/50"
                                    >
                                      <div className="text-[var(--text-muted)] font-medium">{det.producto.nombre}</div>
                                      <div className="flex items-center gap-6 font-mono text-[var(--text-secondary)] text-[11px]">
                                        <span>
                                          {det.cantidad} uds × ${det.costoUnitario.toFixed(2)}
                                        </span>
                                        <span className="text-[var(--text-muted)] font-semibold">${det.subtotal.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="bg-[var(--panel)] px-6 py-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Info size={13} className="text-[var(--brand)]" />
                  Doble clic en un proveedor para consultar su ficha analítica.
                </span>
                <span>
                  Total Compras Consolidadas:{" "}
                  <strong className="text-[var(--brand)] font-semibold font-mono">
                    {purchaseHistory.length}
                  </strong>
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Confirm Dialog — solo toggle */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-[var(--radius-lg)] border mb-4 bg-[var(--warning-light)] border-[var(--warning)]/20 text-[var(--warning)]">
              {confirmDialog.isActive ? (
                <UserX size={24} />
              ) : (
                <UserCheck size={24} />
              )}
            </div>

            <h3 className="text-base font-bold text-[var(--text)] uppercase tracking-wide">
              {confirmDialog.isActive
                ? "Dar de Baja Proveedor"
                : "Reactivar Proveedor"}
            </h3>

            <p className="text-xs text-[var(--text-muted)] mt-2">
              ¿Está seguro de que desea{" "}
              {confirmDialog.isActive
                ? "dar de baja de forma lógica a"
                : "reactivar a"}{" "}
              <strong className="text-[var(--text-muted)]">{confirmDialog.provName}</strong>?
            </p>

            {confirmDialog.errorMsg && (
              <div className="flex items-start gap-2 p-3 mt-3.5 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-left text-[11px] leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{confirmDialog.errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <Button
                variant="secondary"
                onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirm-prov-action"
                variant={confirmDialog.isActive ? "warning" : "success"}
                onClick={handleToggleEstado}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
