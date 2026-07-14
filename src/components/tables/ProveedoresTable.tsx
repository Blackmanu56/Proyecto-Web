"use client";

import React, { useState, useTransition } from "react";
import StatusFilter from "./StatusFilter";
import type { FilterStatus } from "./StatusFilter";
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

// ÔöÇÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

// ÔöÇÔöÇÔöÇ Status Badge ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Inactivo
    </span>
  );
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

  // Di├ílogo de Confirmaci├│n
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    provId: number;
    provName: string;
    type: "toggle" | "delete";
    isActive?: boolean;
    errorMsg?: string | null;
  }>({ open: false, provId: 0, provName: "", type: "toggle" });

  // ÔöÇÔöÇÔöÇ Search handler ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
    e.stopPropagation(); // Evitar abrir detalles
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

  // ÔöÇÔöÇÔöÇ Form submit ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

  // ÔöÇÔöÇÔöÇ Open Details/History modal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

  // ÔöÇÔöÇÔöÇ Actions handlers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
    e.stopPropagation(); // Evitar abrir detalles
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
    <div className="space-y-6">
      {/* ÔöÇÔöÇ Toolbar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="search-proveedores"
            type="text"
            placeholder="Buscar proveedores por nombre, CUIT, responsable o correo..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
          />
          {isPending && (
            <Loader2
              size={16}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin"
            />
          )}
        </div>

        {/* Filtro de estado Activo/Inactivo */}
        <StatusFilter value={filterStatus} onChange={setFilterStatus} />

        {/* Add supplier button */}
        <button
          id="btn-crear-proveedor"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-200 whitespace-nowrap"
        >
          <Plus size={16} />
          Nuevo Proveedor
        </button>
      </div>

      {/* ÔöÇÔöÇ Stats Cards ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Proveedores",
            value: proveedores.length,
            icon: <Building2 size={18} />,
            color: "indigo",
          },
          {
            label: "Activos",
            value: proveedores.filter((p) => p.activo).length,
            icon: <CheckCircle2 size={18} />,
            color: "emerald",
          },
          {
            label: "Inactivos (Baja)",
            value: proveedores.filter((p) => !p.activo).length,
            icon: <UserX size={18} />,
            color: "red",
          },
          {
            label: "Productos Asoc.",
            value: proveedores.reduce((acc, curr) => acc + curr._count.productos, 0),
            icon: <Package size={18} />,
            color: "sky",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl bg-slate-900/80 border border-slate-800 transition-all duration-200`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div
                className={`p-2.5 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-400`}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ÔöÇÔöÇ Table ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  CUIT
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Contacto Responsable
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Contacto
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Art├¡culos
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredProveedores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No se encontraron proveedores</p>
                    <p className="text-xs mt-1">
                      {searchQuery
                        ? "Intente con otros t├®rminos de b├║squeda"
                        : "Comience creando un nuevo proveedor"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProveedores.map((prov) => (
                  <tr
                    key={prov.id}
                    onClick={() => openDetailModal(prov)}
                    className={`group hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer ${
                      !prov.activo ? "opacity-60" : ""
                    }`}
                  >
                    {/* Proveedor info */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                            prov.activo
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : "bg-slate-800 text-slate-500 border border-slate-700"
                          }`}
                        >
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm leading-tight group-hover:text-indigo-400 transition-colors">
                            {prov.nombre}
                          </p>
                          {prov.direccion && (
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <MapPin size={10} className="text-slate-600" />
                              {prov.direccion}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CUIT */}
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-slate-300">
                        {prov.cuit}
                      </span>
                    </td>

                    {/* Contacto Responsable */}
                    <td className="py-3.5 px-5 hidden md:table-cell text-slate-300 font-medium">
                      {prov.contactoResponsable || (
                        <span className="text-slate-600 italic">No especificado</span>
                      )}
                    </td>

                    {/* Contact (Phone/Email) */}
                    <td className="py-3.5 px-5 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {prov.email && (
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Mail size={10} className="text-slate-500 shrink-0" />
                            {prov.email}
                          </p>
                        )}
                        {prov.telefono && (
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Phone size={10} className="text-slate-600 shrink-0" />
                            {prov.telefono}
                          </p>
                        )}
                        {!prov.email && !prov.telefono && (
                          <p className="text-xs text-slate-600 italic">Sin datos</p>
                        )}
                      </div>
                    </td>

                    {/* Articles count */}
                    <td className="py-3.5 px-5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400 font-semibold">
                        <Package size={10} />
                        {prov._count.productos}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      <EstadoBadge activo={prov.activo} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          id={`btn-edit-prov-${prov.id}`}
                          onClick={(e) => openEditModal(prov, e)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-all duration-200"
                          title="Editar proveedor"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          id={`btn-toggle-prov-${prov.id}`}
                          onClick={(e) => openConfirmDialog(prov, "toggle", e)}
                          className={`p-2 rounded-lg border transition-all duration-200 ${
                            prov.activo
                              ? "bg-slate-800 hover:bg-amber-500/10 border-slate-700 hover:border-amber-500/20 text-slate-400 hover:text-amber-400"
                              : "bg-slate-800 hover:bg-emerald-500/10 border-slate-700 hover:border-emerald-500/20 text-slate-400 hover:text-emerald-400"
                          }`}
                          title={prov.activo ? "Dar de baja" : "Reactivar proveedor"}
                        >
                          {prov.activo ? (
                            <UserX size={14} />
                          ) : (
                            <UserCheck size={14} />
                          )}
                        </button>
                        <button
                          id={`btn-delete-prov-${prov.id}`}
                          onClick={(e) => openConfirmDialog(prov, "delete", e)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition-all duration-200"
                          title="Eliminar del sistema"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ÔöÇÔöÇ Create/Edit Modal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10">
                  {editingProv ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingProv ? "Editar Proveedor" : "Nuevo Proveedor"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingProv
                      ? "Modifique los datos comerciales del proveedor"
                      : "Registre un nuevo proveedor de abastecimiento"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertTriangle size={14} className="shrink-0" />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <CheckCircle2 size={14} className="shrink-0" />
                  {editingProv
                    ? "Proveedor actualizado correctamente"
                    : "Proveedor registrado correctamente"}
                </div>
              )}

              {/* Nombre / Raz├│n Social */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Raz├│n Social / Empresa <span className="text-red-400">*</span>
                </label>
                <input
                  id="input-prov-nombre"
                  name="nombre"
                  type="text"
                  required
                  defaultValue={editingProv?.nombre || ""}
                  placeholder="Ej: Repuestos Posadas S.A."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                />
              </div>

              {/* CUIT + Contacto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    CUIT <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-prov-cuit"
                    name="cuit"
                    type="text"
                    required
                    defaultValue={editingProv?.cuit || ""}
                    placeholder="Ej: 30123456789"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Contacto Responsable
                  </label>
                  <input
                    id="input-prov-contacto"
                    name="contactoResponsable"
                    type="text"
                    defaultValue={editingProv?.contactoResponsable || ""}
                    placeholder="Ej: Ing. Jorge G├│mez"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Correo + Tel├®fono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Correo Electr├│nico
                  </label>
                  <input
                    id="input-prov-correo"
                    name="email"
                    type="email"
                    defaultValue={editingProv?.email || ""}
                    placeholder="ventas@proveedor.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Tel├®fono
                  </label>
                  <input
                    id="input-prov-telefono"
                    name="telefono"
                    type="text"
                    defaultValue={editingProv?.telefono || ""}
                    placeholder="Ej: 3764555888"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Direcci├│n */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Direcci├│n Comercial
                </label>
                <input
                  id="input-prov-direccion"
                  name="direccion"
                  type="text"
                  defaultValue={editingProv?.direccion || ""}
                  placeholder="Ej: Av. Uruguay 1234, Posadas, Misiones"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-proveedor"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Guardando...
                    </>
                  ) : editingProv ? (
                    "Guardar Cambios"
                  ) : (
                    "Registrar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÔöÇÔöÇ Detailed Info/Products/History Modal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      {detailModalOpen && selectedProv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDetailModal}
          />

          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Upper profile header */}
            <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-6 py-5 border-b border-slate-800/80 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 flex items-center justify-center">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {selectedProv.nombre}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-mono text-xs text-slate-500">
                      CUIT: {selectedProv.cuit}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    <EstadoBadge activo={selectedProv.activo} />
                  </div>
                </div>
              </div>
              <button
                onClick={closeDetailModal}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab selection */}
            <div className="flex border-b border-slate-800 bg-slate-950/20 px-4">
              {[
                { id: "info", label: "Ficha T├®cnica", icon: <Info size={14} /> },
                { id: "productos", label: "Productos del Cat├ílogo", icon: <Package size={14} /> },
                { id: "historial", label: "Historial de Abastecimiento", icon: <History size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold tracking-wide border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                      : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/20"
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
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <p className="text-sm font-medium">Consultando registros hist├│ricos...</p>
                </div>
              ) : (
                <>
                  {/* Ficha T├®cnica Tab */}
                  {activeTab === "info" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Informaci├│n de la Empresa
                        </h4>
                        <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Raz├│n Social</span>
                            <p className="text-sm font-semibold text-white">{selectedProv.nombre}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">CUIT Fiscal</span>
                            <p className="text-sm font-mono text-slate-300">{selectedProv.cuit}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Fecha de Registro</span>
                            <p className="text-sm text-slate-300 flex items-center gap-1.5 mt-0.5">
                              <Calendar size={13} className="text-slate-500" />
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
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Datos de Contacto
                        </h4>
                        <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Responsable Comercial</span>
                            <p className="text-sm font-semibold text-white">
                              {selectedProv.contactoResponsable || "No especificado"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Tel├®fono Directo</span>
                            <p className="text-sm text-indigo-400 font-semibold flex items-center gap-1.5 mt-0.5">
                              <Phone size={13} />
                              {selectedProv.telefono || "No especificado"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Correo Electr├│nico</span>
                            <p className="text-sm text-slate-300 flex items-center gap-1.5 mt-0.5">
                              <Mail size={13} className="text-slate-500" />
                              {selectedProv.email || "No especificado"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-600">Domicilio Fiscal</span>
                            <p className="text-sm text-slate-300 flex items-center gap-1.5 mt-0.5">
                              <MapPin size={13} className="text-slate-500 shrink-0" />
                              {selectedProv.direccion || "No especificado"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cat├ílogo de Productos Tab */}
                  {activeTab === "productos" && (
                    <div className="space-y-3">
                      {linkedProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-600 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                          <Package size={32} className="mx-auto mb-2 opacity-20" />
                          <p className="text-sm font-semibold">Sin productos asociados</p>
                          <p className="text-xs">No hay productos en inventario vinculados a este proveedor.</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/30">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-950/60 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-4">Producto</th>
                                <th className="py-2.5 px-4">Categor├¡a</th>
                                <th className="py-2.5 px-4 text-right">Precio Compra</th>
                                <th className="py-2.5 px-4 text-right">Precio Venta</th>
                                <th className="py-2.5 px-4 text-center">Stock</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {linkedProducts.map((prod) => (
                                <tr key={prod.id} className="hover:bg-slate-800/20">
                                  <td className="py-2.5 px-4 font-semibold text-white">{prod.nombre}</td>
                                  <td className="py-2.5 px-4 text-slate-400">{prod.categoria.nombre}</td>
                                  <td className="py-2.5 px-4 text-right text-slate-300 font-mono">${prod.precioCompra.toFixed(2)}</td>
                                  <td className="py-2.5 px-4 text-right text-indigo-400 font-mono font-semibold">${prod.precioVenta.toFixed(2)}</td>
                                  <td className="py-2.5 px-4 text-center">
                                    <span
                                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                        prod.cantidad <= prod.stockMinimo
                                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      }`}
                                    >
                                      {prod.cantidad}
                                    </span>
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
                        <div className="text-center py-12 text-slate-600 bg-slate-950/20 rounded-2xl border border-slate-800/50">
                          <History size={32} className="mx-auto mb-2 opacity-20" />
                          <p className="text-sm font-semibold">Sin compras registradas</p>
                          <p className="text-xs">No se registran transacciones de abastecimiento con este proveedor.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {purchaseHistory.map((compra) => (
                            <div
                              key={compra.id}
                              className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3"
                            >
                              {/* Purchase general info */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/60 text-[11px]">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-white bg-slate-800 px-2 py-0.5 rounded">
                                    Compra #{compra.id}
                                  </span>
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Calendar size={11} />
                                    {new Date(compra.fecha).toLocaleDateString("es-AR")} {new Date(compra.fecha).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Shield size={11} className="text-indigo-400" />
                                    Por: <strong className="text-slate-300 font-semibold">{compra.usuario.nombreCompleto}</strong>
                                  </span>
                                  <span className="text-indigo-400 font-bold font-mono text-xs">
                                    Total: ${compra.total.toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Purchase items list */}
                              <div className="space-y-1">
                                {compra.detalles.map((det) => (
                                  <div
                                    key={det.id}
                                    className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-slate-900/50"
                                  >
                                    <div className="text-slate-300 font-medium">{det.producto.nombre}</div>
                                    <div className="flex items-center gap-6 font-mono text-slate-500 text-[11px]">
                                      <span>
                                        {det.cantidad} uds ├ù ${det.costoUnitario.toFixed(2)}
                                      </span>
                                      <span className="text-slate-300 font-semibold">${det.subtotal.toFixed(2)}</span>
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
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Info size={13} className="text-indigo-500" />
                Doble clic en un proveedor para consultar su ficha anal├¡tica.
              </span>
              <span>
                Total Compras Consolidadas:{" "}
                <strong className="text-indigo-400 font-semibold font-mono">
                  {purchaseHistory.length}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ÔöÇÔöÇ Confirm Dialog ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
          />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 p-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`p-3 rounded-2xl border mb-4 ${
                  confirmDialog.type === "toggle"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
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

              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                {confirmDialog.type === "toggle"
                  ? confirmDialog.isActive
                    ? "Dar de Baja Proveedor"
                    : "Reactivar Proveedor"
                  : "Eliminar Proveedor"}
              </h3>

              <p className="text-xs text-slate-400 mt-2">
                ┬┐Est├í seguro de que desea{" "}
                {confirmDialog.type === "toggle"
                  ? confirmDialog.isActive
                    ? "dar de baja de forma l├│gica a"
                    : "reactivar a"
                  : "eliminar f├¡sicamente del sistema a"}{" "}
                <strong className="text-slate-200">{confirmDialog.provName}</strong>?
              </p>

              {confirmDialog.errorMsg && (
                <div className="flex items-start gap-2 p-3 mt-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-left text-[11px] leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{confirmDialog.errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 w-full mt-6">
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-prov-action"
                  onClick={
                    confirmDialog.type === "toggle"
                      ? handleToggleEstado
                      : handleEliminarReal
                  }
                  className={`py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                    confirmDialog.type === "toggle"
                      ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                      : "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
