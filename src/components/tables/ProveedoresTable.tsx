"use client";

import React, { useState, useTransition } from "react";
import StatusFilter from "./StatusFilter";
import type { FilterStatus } from "./StatusFilter";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  UserX,
  UserCheck,
  X,
  Shield,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Package,
  Calendar,
  DollarSign,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
} from "lucide-react";

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

interface ProveedoresTableProps {
  initialProveedores: ProveedorConDetalles[];
  onCreateProveedor: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onUpdateProveedor: (id: number, formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onEliminarReal: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onSearch: (query: string, soloActivos: boolean) => Promise<ProveedorConDetalles[]>;
  onGetProductos: (id: number) => Promise<any[]>;
  onGetHistorial: (id: number) => Promise<any[]>;
}

export default function ProveedoresTable({
  initialProveedores,
  onCreateProveedor,
  onUpdateProveedor,
  onToggleEstado,
  onEliminarReal,
  onSearch,
  onGetProductos,
  onGetHistorial,
}: ProveedoresTableProps) {
  const [proveedores, setProveedores] = useState<ProveedorConDetalles[]>(initialProveedores);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("activos");
  const [isPending, startTransition] = useTransition();

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

  // Diálogo de Confirmación
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    provId: number;
    provName: string;
    type: "toggle" | "delete";
    isActive?: boolean;
    errorMsg?: string | null;
  }>({ open: false, provId: 0, provName: "", type: "toggle" });

  // ─── Search handler ───────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    startTransition(async () => {
      const results = await onSearch(query, false);
      setProveedores(results);
    });
  };

  // Filtrado client-side por estado
  const filteredProveedores = proveedores.filter((p) => {
    if (filterStatus === "todos") return true;
    if (filterStatus === "activos") return p.activo;
    if (filterStatus === "inactivos") return !p.activo;
    return true;
  });

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

    // Refresh list
    const results = await onSearch(searchQuery, false);
    setProveedores(results);

    setTimeout(() => {
      closeModal();
    }, 800);
  };

  // ─── Open Details/History modal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedProv(null);
    setLinkedProducts([]);
    setPurchaseHistory([]);
  };

  // ─── Actions handlers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

  const handleEliminarReal = async () => {
    const { provId } = confirmDialog;
    const result = await onEliminarReal(provId);
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
    type: "toggle" | "delete",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setConfirmDialog({
      open: true,
      provId: prov.id,
      provName: prov.nombre,
      type,
      isActive: prov.activo,
      errorMsg: null,
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[
          {
            label: "Total Proveedores",
            value: proveedores.length,
            icon: <Building2 size={18} />,
            color: "brand",
          },
          {
            label: "Activos",
            value: proveedores.filter((p) => p.activo).length,
            icon: <CheckCircle2 size={18} />,
            color: "success",
          },
          {
            label: "Inactivos (Baja)",
            value: proveedores.filter((p) => !p.activo).length,
            icon: <UserX size={18} />,
            color: "danger",
          },
          {
            label: "Productos Asoc.",
            value: proveedores.reduce((acc, curr) => acc + curr._count.productos, 0),
            icon: <Package size={18} />,
            color: "info",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-[var(--radius-lg)] bg-card border border-border transition-all duration-200 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-text mt-1">{stat.value}</p>
              </div>
              <div
                className={`p-2.5 rounded-[var(--radius-md)] bg-${stat.color}-light text-${stat.color}`}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. TableShell */}
      <TableShell
        title="Gestión de Proveedores"
        searchPlaceholder="Buscar proveedores por nombre, CUIT, responsable o correo..."
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        isEmpty={filteredProveedores.length === 0}
        emptyMessage="No se encontraron proveedores"
        emptyIcon={<Building2 size={40} className="opacity-40" />}
        actions={
          <div className="flex items-center gap-3">
            <StatusFilter value={filterStatus} onChange={setFilterStatus} />
            <Button onClick={openCreateModal} leftIcon={<Plus size={16} />}>
              Nuevo Proveedor
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  CUIT
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider hidden md:table-cell">
                  Contacto Responsable
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider hidden sm:table-cell">
                  Contacto
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Artículos
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredProveedores.map((prov) => (
                <tr
                  key={prov.id}
                  onClick={() => openDetailModal(prov)}
                  className={`group hover:bg-border/30 transition-colors duration-150 cursor-pointer ${
                    !prov.activo ? "opacity-60" : ""
                  }`}
                >
                  {/* Proveedor info */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-xs font-bold shrink-0 ${
                          prov.activo
                            ? "bg-brand-light text-brand border border-brand/20"
                            : "bg-border text-text-secondary border border-border"
                        }`}
                      >
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-text text-sm leading-tight group-hover:text-brand transition-colors">
                          {prov.nombre}
                        </p>
                        {prov.direccion && (
                          <p className="text-[11px] text-text-secondary mt-0.5 flex items-center gap-1">
                            <MapPin size={10} className="text-text-secondary" />
                            {prov.direccion}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* CUIT */}
                  <td className="py-3.5 px-5">
                    <span className="font-mono text-xs text-text-muted">
                      {prov.cuit}
                    </span>
                  </td>

                  {/* Contacto Responsable */}
                  <td className="py-3.5 px-5 hidden md:table-cell text-text-muted font-medium">
                    {prov.contactoResponsable || (
                      <span className="text-text-secondary italic">No especificado</span>
                    )}
                  </td>

                  {/* Contact (Phone/Email) */}
                  <td className="py-3.5 px-5 hidden sm:table-cell">
                    <div className="space-y-0.5">
                      {prov.email && (
                        <p className="text-xs text-text-muted flex items-center gap-1.5">
                          <Mail size={10} className="text-text-secondary shrink-0" />
                          {prov.email}
                        </p>
                      )}
                      {prov.telefono && (
                        <p className="text-xs text-text-secondary flex items-center gap-1.5">
                          <Phone size={10} className="text-text-secondary shrink-0" />
                          {prov.telefono}
                        </p>
                      )}
                      {!prov.email && !prov.telefono && (
                        <p className="text-xs text-text-secondary italic">Sin datos</p>
                      )}
                    </div>
                  </td>

                  {/* Articles count */}
                  <td className="py-3.5 px-5 text-center">
                    <Badge variant="default" size="sm" className="font-mono">
                      <Package size={10} className="mr-1" />
                      {prov._count.productos}
                    </Badge>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-5 text-center">
                    <Badge variant={prov.activo ? "success" : "danger"} size="sm">
                      {prov.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center justify-center gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openEditModal(prov, e)}
                        title="Editar proveedor"
                      >
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openConfirmDialog(prov, "toggle", e)}
                        title={prov.activo ? "Dar de baja" : "Reactivar proveedor"}
                        className={prov.activo ? "hover:text-warning" : "hover:text-success"}
                      >
                        {prov.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openConfirmDialog(prov, "delete", e)}
                        title="Eliminar del sistema"
                        className="hover:text-danger"
                      >
                        <Trash2 size={14} />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-brand-light rounded-[var(--radius-md)] text-brand border border-brand/10">
                {editingProv ? <Edit3 size={18} /> : <Plus size={18} />}
              </div>
              {editingProv ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription>
              {editingProv
                ? "Modifique los datos comerciales del proveedor"
                : "Registre un nuevo proveedor de abastecimiento"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-danger-light border border-danger/20 text-danger text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-success-light border border-success/20 text-success text-xs">
                <CheckCircle2 size={14} className="shrink-0" />
                {editingProv
                  ? "Proveedor actualizado correctamente"
                  : "Proveedor registrado correctamente"}
              </div>
            )}

            {/* Nombre / Razón Social */}
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

            {/* CUIT + Contacto */}
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

            {/* Correo + Teléfono */}
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

            {/* Dirección */}
            <FormField label="Dirección Comercial">
              <Input
                id="input-prov-direccion"
                name="direccion"
                type="text"
                defaultValue={editingProv?.direccion || ""}
                placeholder="Ej: Av. Uruguay 1234, Posadas, Misiones"
              />
            </FormField>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedProv && (
            <>
              {/* Upper profile header */}
              <div className="bg-gradient-to-r from-bg to-panel px-6 py-5 border-b border-border flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-brand-light text-brand border border-brand/20 flex items-center justify-center">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text leading-tight">
                      {selectedProv.nombre}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-mono text-xs text-text-secondary">
                        CUIT: {selectedProv.cuit}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-border" />
                      <Badge variant={selectedProv.activo ? "success" : "danger"} size="sm">
                        {selectedProv.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab selection */}
              <div className="flex border-b border-border bg-panel/20 px-4">
                {[
                  { id: "info", label: "Ficha Técnica", icon: <Info size={14} /> },
                  { id: "productos", label: "Productos del Catálogo", icon: <Package size={14} /> },
                  { id: "historial", label: "Historial de Abastecimiento", icon: <History size={14} /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold tracking-wide border-b-2 transition-all ${
                      activeTab === tab.id
                        ? "border-brand text-brand bg-brand-light/5"
                        : "border-transparent text-text-secondary hover:text-text-muted hover:bg-border/20"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-6 max-h-[55vh] overflow-y-auto min-h-[300px]">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
                    <Loader2 size={32} className="text-brand animate-spin" />
                    <p className="text-sm font-medium">Consultando registros históricos...</p>
                  </div>
                ) : (
                  <>
                    {/* Ficha Técnica Tab */}
                    {activeTab === "info" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Información de la Empresa
                          </h4>
                          <div className="space-y-3 bg-bg p-4 rounded-[var(--radius-lg)] border border-border">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Razón Social</span>
                              <p className="text-sm font-semibold text-text">{selectedProv.nombre}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">CUIT Fiscal</span>
                              <p className="text-sm font-mono text-text-muted">{selectedProv.cuit}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Fecha de Registro</span>
                              <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
                                <Calendar size={13} className="text-text-secondary" />
                                {new Date(selectedProv.creadoEn).toLocaleDateString("es-AR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                            Datos de Contacto
                          </h4>
                          <div className="space-y-3 bg-bg p-4 rounded-[var(--radius-lg)] border border-border">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Responsable Comercial</span>
                              <p className="text-sm font-semibold text-text">
                                {selectedProv.contactoResponsable || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Teléfono Directo</span>
                              <p className="text-sm text-brand font-semibold flex items-center gap-1.5 mt-0.5">
                                <Phone size={13} />
                                {selectedProv.telefono || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Correo Electrónico</span>
                              <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
                                <Mail size={13} className="text-text-secondary" />
                                {selectedProv.email || "No especificado"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-secondary">Domicilio Fiscal</span>
                              <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
                                <MapPin size={13} className="text-text-secondary shrink-0" />
                                {selectedProv.direccion || "No especificado"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Catálogo de Productos Tab */}
                    {activeTab === "productos" && (
                      <div className="space-y-3">
                        {linkedProducts.length === 0 ? (
                          <div className="text-center py-12 text-text-secondary bg-bg/20 rounded-[var(--radius-lg)] border border-border/50">
                            <Package size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-semibold">Sin productos asociados</p>
                            <p className="text-xs">No hay productos en inventario vinculados a este proveedor.</p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg/30">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-bg/60 text-text-secondary uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                                <tr>
                                  <th className="py-2.5 px-4">Producto</th>
                                  <th className="py-2.5 px-4">Categoría</th>
                                  <th className="py-2.5 px-4 text-right">Precio Compra</th>
                                  <th className="py-2.5 px-4 text-right">Precio Venta</th>
                                  <th className="py-2.5 px-4 text-center">Stock</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {linkedProducts.map((prod) => (
                                  <tr key={prod.id} className="hover:bg-border/20">
                                    <td className="py-2.5 px-4 font-semibold text-text">{prod.nombre}</td>
                                    <td className="py-2.5 px-4 text-text-muted">{prod.categoria.nombre}</td>
                                    <td className="py-2.5 px-4 text-right text-text-muted font-mono">${prod.precioCompra.toFixed(2)}</td>
                                    <td className="py-2.5 px-4 text-right text-brand font-mono font-semibold">${prod.precioVenta.toFixed(2)}</td>
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

                    {/* Historial de Abastecimiento Tab */}
                    {activeTab === "historial" && (
                      <div className="space-y-4">
                        {purchaseHistory.length === 0 ? (
                          <div className="text-center py-12 text-text-secondary bg-bg/20 rounded-[var(--radius-lg)] border border-border/50">
                            <History size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-semibold">Sin compras registradas</p>
                            <p className="text-xs">No se registran transacciones de abastecimiento con este proveedor.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {purchaseHistory.map((compra) => (
                              <div
                                key={compra.id}
                                className="rounded-[var(--radius-lg)] border border-border bg-bg/40 p-4 space-y-3"
                              >
                                {/* Purchase general info */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60 text-[11px]">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-text bg-border px-2 py-0.5 rounded">
                                      Compra #{compra.id}
                                    </span>
                                    <span className="text-text-secondary flex items-center gap-1">
                                      <Calendar size={11} />
                                      {new Date(compra.fecha).toLocaleDateString("es-AR")} {new Date(compra.fecha).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-text-secondary flex items-center gap-1">
                                      <Shield size={11} className="text-brand" />
                                      Por: <strong className="text-text-muted font-semibold">{compra.usuario.nombreCompleto}</strong>
                                    </span>
                                    <span className="text-brand font-bold font-mono text-xs">
                                      Total: ${compra.total.toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                {/* Purchase items list */}
                                <div className="space-y-1">
                                  {compra.detalles.map((det) => (
                                    <div
                                      key={det.id}
                                      className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-border/50"
                                    >
                                      <div className="text-text-muted font-medium">{det.producto.nombre}</div>
                                      <div className="flex items-center gap-6 font-mono text-text-secondary text-[11px]">
                                        <span>
                                          {det.cantidad} uds × ${det.costoUnitario.toFixed(2)}
                                        </span>
                                        <span className="text-text-muted font-semibold">${det.subtotal.toFixed(2)}</span>
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

              {/* Bottom info banner */}
              <div className="bg-panel px-6 py-4 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Info size={13} className="text-brand" />
                  Doble clic en un proveedor para consultar su ficha analítica.
                </span>
                <span>
                  Total Compras Consolidadas:{" "}
                  <strong className="text-brand font-semibold font-mono">
                    {purchaseHistory.length}
                  </strong>
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-3 rounded-[var(--radius-lg)] border mb-4 ${
                confirmDialog.type === "toggle"
                  ? "bg-warning-light border-warning/20 text-warning"
                  : "bg-danger-light border-danger/20 text-danger"
              }`}
            >
              {confirmDialog.type === "toggle" ? (
                confirmDialog.isActive ? (
                  <UserX size={24} />
                ) : (
                  <UserCheck size={24} />
                )
              ) : (
                <Trash2 size={24} />
              )}
            </div>

            <h3 className="text-base font-bold text-text uppercase tracking-wide">
              {confirmDialog.type === "toggle"
                ? confirmDialog.isActive
                  ? "Dar de Baja Proveedor"
                  : "Reactivar Proveedor"
                : "Eliminar Proveedor"}
            </h3>

            <p className="text-xs text-text-muted mt-2">
              ¿Está seguro de que desea{" "}
              {confirmDialog.type === "toggle"
                ? confirmDialog.isActive
                  ? "dar de baja de forma lógica a"
                  : "reactivar a"
                : "eliminar físicamente del sistema a"}{" "}
              <strong className="text-text-muted">{confirmDialog.provName}</strong>?
            </p>

            {confirmDialog.errorMsg && (
              <div className="flex items-start gap-2 p-3 mt-3.5 rounded-[var(--radius-md)] bg-danger-light border border-danger/20 text-danger text-left text-[11px] leading-relaxed">
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
                variant={confirmDialog.type === "toggle" ? (confirmDialog.isActive ? "warning" : "success") : "danger"}
                onClick={
                  confirmDialog.type === "toggle"
                    ? handleToggleEstado
                    : handleEliminarReal
                }
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