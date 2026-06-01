"use client";

import React, { useState, useTransition, useRef } from "react";
import StatusFilter from "./StatusFilter";
import type { FilterStatus } from "./StatusFilter";
import Avatar from "@/components/ui/Avatar";
import {
  Search,
  Plus,
  Edit3,
  UserX,
  UserCheck,
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Users,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Trash2,
  Upload,
  ImageIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
type UsuarioConRol = {
  id: number;
  username: string;
  nombreCompleto: string;
  dni: string;
  correo: string | null;
  telefono: string | null;
  fotoUrl: string | null;
  activo: boolean;
  creadoEn: Date;
  rol: {
    id: number;
    nombre: string;
  };
};

type RolOption = {
  id: number;
  nombre: string;
};

interface UsuariosTableProps {
  initialUsers: UsuarioConRol[];
  roles: RolOption[];
  onCreateUser: (formData: FormData) => Promise<{ success?: boolean; error?: string; id?: number }>;
  onUpdateUser: (id: number, formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onSearch: (query: string, soloActivos: boolean) => Promise<UsuarioConRol[]>;
  onUploadPhoto: (userId: number, formData: FormData) => Promise<{ success?: boolean; fotoUrl?: string; error?: string }>;
  onDeletePhoto: (userId: number) => Promise<{ success?: boolean; error?: string }>;
}

// ─── Role Permissions Map ─────────────────────────────────────────
const PERMISOS_POR_ROL: Record<string, { label: string; permisos: string[] }> = {
  ADMINISTRADOR: {
    label: "Acceso Completo",
    permisos: [
      "Dashboard",
      "Ventas",
      "Caja",
      "Cierre de caja",
      "Informes",
      "Productos",
      "Stock",
      "Proveedores",
      "Empleados",
      "Clientes",
    ],
  },
  ENCARGADO_VENTAS: {
    label: "Gestión de Ventas y Caja",
    permisos: [
      "Registrar ventas",
      "Gestionar cobros",
      "Abrir caja",
      "Cerrar caja",
      "Emitir comprobantes",
      "Consultar productos",
      "Consultar stock disponible",
      "Registrar clientes",
      "Ver historial de ventas",
      "Informes (solo del área designada)",
    ],
  },
  ENCARGADO_STOCK: {
    label: "Gestión de Inventario",
    permisos: [
      "Registrar entrada de productos",
      "Registrar salida de productos",
      "Actualizar stock",
      "Gestionar proveedores",
      "Consultar productos",
      "Controlar faltantes",
      "Generar alertas de bajo stock",
      "Consultar movimientos de stock",
      "Informes (solo del área designada)",
    ],
  },
};

// ─── Role Badge Component ─────────────────────────────────────────
function RolBadge({ rolNombre }: { rolNombre: string }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    ADMINISTRADOR: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      icon: <ShieldCheck size={12} />,
    },
    ENCARGADO_VENTAS: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      icon: <Shield size={12} />,
    },
    ENCARGADO_STOCK: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/20",
      icon: <ShieldAlert size={12} />,
    },
  };

  const style = config[rolNombre] || {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    icon: <Shield size={12} />,
  };

  const displayName = rolNombre.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide border ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon}
      {displayName}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────
function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Baja
    </span>
  );
}

// ─── Permission List ──────────────────────────────────────────────
function PermisosRol({ rolNombre }: { rolNombre: string }) {
  const info = PERMISOS_POR_ROL[rolNombre];
  if (!info) return null;

  return (
    <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Shield size={14} className="text-indigo-400" />
        Permisos del Rol: <span className="text-indigo-400">{info.label}</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {info.permisos.map((perm) => (
          <div
            key={perm}
            className="flex items-center gap-2 text-[11px] text-slate-400 py-1 px-2 rounded-lg bg-slate-900/50"
          >
            <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
            {perm}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function UsuariosTable({
  initialUsers,
  roles,
  onCreateUser,
  onUpdateUser,
  onToggleEstado,
  onSearch,
  onUploadPhoto,
  onDeletePhoto,
}: UsuariosTableProps) {
  const [users, setUsers] = useState<UsuarioConRol[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("activos");
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioConRol | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo state
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [selectedRolId, setSelectedRolId] = useState<number>(0);
  const [showPassword, setShowPassword] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: number;
    userName: string;
    isActive: boolean;
  }>({ open: false, userId: 0, userName: "", isActive: true });

  // ─── Search handler ───────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    startTransition(async () => {
      const results = await onSearch(query, false); // Siempre carga todos; filtro de estado se aplica client-side
      setUsers(results);
    });
  };

  // ─── Filtrado client-side por estado ─────────────────────────
  const filteredUsers = users.filter((u) => {
    if (filterStatus === "todos") return true;
    if (filterStatus === "activos") return u.activo;
    if (filterStatus === "inactivos") return !u.activo;
    return true;
  });

  // ─── Open modal ───────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingUser(null);
    setSelectedRolId(roles[0]?.id || 0);
    setFormError(null);
    setFormSuccess(false);
    setShowPassword(false);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setModalOpen(true);
  };

  const openEditModal = (user: UsuarioConRol) => {
    setEditingUser(user);
    setSelectedRolId(user.rol.id);
    setFormError(null);
    setFormSuccess(false);
    setShowPassword(false);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormError(null);
    setFormSuccess(false);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  // ─── Form submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("rolId", String(selectedRolId));

    let result;
    if (editingUser) {
      result = await onUpdateUser(editingUser.id, formData);
    } else {
      result = await onCreateUser(formData);
    }

    if (result.error) {
      setFormError(result.error);
      setIsSubmitting(false);
      return;
    }

    setFormSuccess(true);

    // Upload photo after create if a file was selected
    const createResult = result as { success?: boolean; error?: string; id?: number };
    if (!editingUser && createResult.id && selectedPhotoFile) {
      setFormSuccess(false);
      setFormError(null);
      const fd = new FormData();
      fd.set("foto", selectedPhotoFile);
      const photoResult = await onUploadPhoto(createResult.id, fd);
      if (photoResult.error) {
        // Photo upload failed, but user was created — show warning
        setFormError(`Usuario creado, pero no se pudo subir la foto: ${photoResult.error}`);
        setIsSubmitting(false);
        return;
      }
      setFormSuccess(true);
    }

    setIsSubmitting(false);

    // Refresh the list
    const results = await onSearch(searchQuery, false);
    setUsers(results);

    setTimeout(() => {
      closeModal();
    }, 800);
  };

  // ─── Toggle active status ────────────────────────────────────
  const handleToggleEstado = async () => {
    const { userId } = confirmDialog;
    setConfirmDialog({ ...confirmDialog, open: false });

    const result = await onToggleEstado(userId);
    if (result.success) {
      const results = await onSearch(searchQuery, false);
      setUsers(results);
    }
  };

  // ─── Photo handlers ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validate client-side
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        setFormError("Formato no permitido. Solo JPG, PNG y WEBP.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError("La imagen no puede superar los 5 MB.");
        return;
      }
      setSelectedPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const handleUploadPhotoNow = async (userId: number) => {
    if (!selectedPhotoFile) return;
    setPhotoUploading(true);
    setFormError(null);
    setFormSuccess(false);
    const fd = new FormData();
    fd.set("foto", selectedPhotoFile);
    const result = await onUploadPhoto(userId, fd);
    if (result.error) {
      setFormError(result.error);
      setPhotoUploading(false);
      return;
    }
    // Update editingUser so modal preview shows the new photo immediately
    const newFotoUrl = result.fotoUrl ?? null;
    setEditingUser((prev) =>
      prev ? { ...prev, fotoUrl: newFotoUrl } : prev
    );
    // Refresh user list
    const results = await onSearch(searchQuery, false);
    setUsers(results);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoUploading(false);
    setFormSuccess(true);
  };

  const handleDeletePhotoNow = async (userId: number) => {
    setPhotoUploading(true);
    setFormError(null);
    setFormSuccess(false);
    const result = await onDeletePhoto(userId);
    if (result.error) {
      setFormError(result.error);
      setPhotoUploading(false);
      return;
    }
    // Clear fotoUrl in editingUser so modal preview updates
    setEditingUser((prev) =>
      prev ? { ...prev, fotoUrl: null } : prev
    );
    const results = await onSearch(searchQuery, false);
    setUsers(results);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoUploading(false);
    setFormSuccess(true);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ─── Get selected role name ───────────────────────────────────
  const selectedRolNombre = roles.find((r) => r.id === selectedRolId)?.nombre || "";

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="search-usuarios"
            type="text"
            placeholder="Buscar por nombre, DNI, usuario o correo..."
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

        {/* Add user button */}
        <button
          id="btn-crear-usuario"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-200 whitespace-nowrap"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Usuarios",
            value: users.length,
            icon: <Users size={18} />,
            color: "indigo",
          },
          {
            label: "Activos",
            value: users.filter((u) => u.activo).length,
            icon: <UserCheck size={18} />,
            color: "emerald",
          },
          {
            label: "Dados de Baja",
            value: users.filter((u) => !u.activo).length,
            icon: <UserX size={18} />,
            color: "red",
          },
          {
            label: "Administradores",
            value: users.filter((u) => u.rol.nombre === "ADMINISTRADOR").length,
            icon: <ShieldCheck size={18} />,
            color: "amber",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-${stat.color}-500/20 transition-all duration-200`}
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

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  DNI
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Contacto
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rol
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500">
                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No se encontraron usuarios</p>
                    <p className="text-xs mt-1">
                      {searchQuery
                        ? "Intente con otros términos de búsqueda"
                        : "Comience creando un nuevo usuario"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`group hover:bg-slate-800/40 transition-colors duration-150 ${
                      !user.activo ? "opacity-60" : ""
                    }`}
                  >
                    {/* User info */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar
                          fotoUrl={user.fotoUrl}
                          nombreCompleto={user.nombreCompleto}
                          size="md"
                          activo={user.activo}
                        />
                        <div>
                          <p className="font-semibold text-white text-sm leading-tight">
                            {user.nombreCompleto}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* DNI */}
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-slate-300">
                        {user.dni}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-5 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {user.correo && (
                          <p className="text-xs text-slate-400">{user.correo}</p>
                        )}
                        {user.telefono && (
                          <p className="text-xs text-slate-500">{user.telefono}</p>
                        )}
                        {!user.correo && !user.telefono && (
                          <p className="text-xs text-slate-600 italic">Sin datos</p>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-5">
                      <RolBadge rolNombre={user.rol.nombre} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      <EstadoBadge activo={user.activo} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          id={`btn-edit-${user.id}`}
                          onClick={() => openEditModal(user)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-all duration-200"
                          title="Editar usuario"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          id={`btn-toggle-${user.id}`}
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              userId: user.id,
                              userName: user.nombreCompleto,
                              isActive: user.activo,
                            })
                          }
                          className={`p-2 rounded-lg border transition-all duration-200 ${
                            user.activo
                              ? "bg-slate-800 hover:bg-red-500/10 border-slate-700 hover:border-red-500/20 text-slate-400 hover:text-red-400"
                              : "bg-slate-800 hover:bg-emerald-500/10 border-slate-700 hover:border-emerald-500/20 text-slate-400 hover:text-emerald-400"
                          }`}
                          title={
                            user.activo ? "Dar de baja" : "Reactivar usuario"
                          }
                        >
                          {user.activo ? (
                            <UserX size={14} />
                          ) : (
                            <UserCheck size={14} />
                          )}
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

      {/* ── Create/Edit Modal ───────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10">
                  {editingUser ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingUser
                      ? "Modifique los datos del usuario seleccionado"
                      : "Complete los datos para registrar un nuevo usuario"}
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

            {/* ── Photo Upload Section ──────────────────────────── */}
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Camera size={14} />
                Foto de Perfil
              </p>
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="relative shrink-0">
                  {photoPreviewUrl ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-indigo-500/20">
                      <img
                        src={photoPreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : editingUser?.fotoUrl ? (
                    <Avatar
                      fotoUrl={editingUser.fotoUrl}
                      nombreCompleto={editingUser.nombreCompleto}
                      size="xl"
                      activo={editingUser.activo}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  {photoUploading && (
                    <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-indigo-400" />
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      disabled={photoUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/20 text-xs font-medium text-slate-300 hover:text-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={12} />
                      {selectedPhotoFile ? "Cambiar foto" : editingUser?.fotoUrl ? "Cambiar foto" : "Subir foto"}
                    </button>
                    {(editingUser?.fotoUrl || photoPreviewUrl) && (
                      <button
                        type="button"
                        onClick={
                          photoPreviewUrl
                            ? () => {
                                setSelectedPhotoFile(null);
                                setPhotoPreviewUrl(null);
                              }
                            : () => handleDeletePhotoNow(editingUser!.id)
                        }
                        disabled={photoUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/20 text-xs font-medium text-slate-400 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Eliminar foto"
                      >
                        <Trash2 size={12} />
                        {photoPreviewUrl ? "Cancelar" : "Eliminar"}
                      </button>
                    )}
                  </div>
                  {selectedPhotoFile && editingUser && (
                    <button
                      type="button"
                      onClick={() => handleUploadPhotoNow(editingUser.id)}
                      disabled={photoUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={12} />
                      Guardar foto
                    </button>
                  )}
                  <p className="text-[10px] text-slate-600">
                    JPG, PNG o WEBP. Máx 5 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Error/Success messages */}
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertTriangle size={14} className="shrink-0" />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <CheckCircle2 size={14} className="shrink-0" />
                  {editingUser
                    ? "Usuario actualizado correctamente"
                    : "Usuario creado correctamente"}
                </div>
              )}

              {/* Nombre completo */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nombre Completo <span className="text-red-400">*</span>
                </label>
                <input
                  id="input-nombre"
                  name="nombreCompleto"
                  type="text"
                  required
                  defaultValue={editingUser?.nombreCompleto || ""}
                  placeholder="Ej: Juan Carlos Pérez"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                />
              </div>

              {/* DNI + Username row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    DNI <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-dni"
                    name="dni"
                    type="text"
                    required
                    defaultValue={editingUser?.dni || ""}
                    placeholder="Ej: 35123456"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Usuario <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-username"
                    name="username"
                    type="text"
                    required
                    defaultValue={editingUser?.username || ""}
                    placeholder="Ej: jperez"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Correo + Teléfono row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    id="input-correo"
                    name="correo"
                    type="email"
                    defaultValue={editingUser?.correo || ""}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    id="input-telefono"
                    name="telefono"
                    type="text"
                    defaultValue={editingUser?.telefono || ""}
                    placeholder="Ej: 3764123456"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Contraseña{" "}
                  {!editingUser && <span className="text-red-400">*</span>}
                  {editingUser && (
                    <span className="text-slate-600 font-normal">
                      (dejar vacío para mantener la actual)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="input-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    placeholder={
                      editingUser ? "••••••••" : "Mínimo 4 caracteres"
                    }
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Rol <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-rol"
                    value={selectedRolId}
                    onChange={(e) => setSelectedRolId(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all cursor-pointer"
                  >
                    {roles.map((rol) => (
                      <option key={rol.id} value={rol.id}>
                        {rol.nombre.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
              </div>

              {/* Role permissions preview */}
              <PermisosRol rolNombre={selectedRolNombre} />

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
                  id="btn-submit-usuario"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Guardando...
                    </>
                  ) : editingUser ? (
                    "Guardar Cambios"
                  ) : (
                    "Crear Usuario"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog ──────────────────────────────────────── */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() =>
              setConfirmDialog({ ...confirmDialog, open: false })
            }
          />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 p-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`p-3 rounded-2xl mb-4 ${
                  confirmDialog.isActive
                    ? "bg-red-500/10 text-red-400"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {confirmDialog.isActive ? (
                  <UserX size={28} />
                ) : (
                  <UserCheck size={28} />
                )}
              </div>
              <h3 className="text-lg font-bold text-white">
                {confirmDialog.isActive
                  ? "Dar de Baja"
                  : "Reactivar Usuario"}
              </h3>
              <p className="text-sm text-slate-400 mt-2">
                {confirmDialog.isActive ? (
                  <>
                    ¿Está seguro de dar de baja a{" "}
                    <span className="font-semibold text-white">
                      {confirmDialog.userName}
                    </span>
                    ? El usuario no podrá acceder al sistema, pero su
                    información se conservará.
                  </>
                ) : (
                  <>
                    ¿Desea reactivar al usuario{" "}
                    <span className="font-semibold text-white">
                      {confirmDialog.userName}
                    </span>
                    ? Podrá volver a acceder al sistema con su rol asignado.
                  </>
                )}
              </p>
              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  onClick={() =>
                    setConfirmDialog({ ...confirmDialog, open: false })
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-toggle"
                  onClick={handleToggleEstado}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg ${
                    confirmDialog.isActive
                      ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  }`}
                >
                  {confirmDialog.isActive ? "Dar de Baja" : "Reactivar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
