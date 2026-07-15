"use client";

import React, { useState, useTransition, useRef } from "react";
import type { FilterStatus } from "./StatusFilter";
import Avatar from "@/components/ui/Avatar";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { EmployeePanel } from "@/components/ui/employee-panel";
import {
  Plus,
  Edit3,
  UserX,
  UserCheck,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Users,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Trash2,
  Upload,
  ImageIcon,
  CheckCircle,
  Loader2,
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
  const config: Record<string, { variant: "danger" | "success" | "info" | "default"; icon: React.ReactNode }> = {
    ADMINISTRADOR: {
      variant: "danger",
      icon: <ShieldCheck size={12} />,
    },
    ENCARGADO_VENTAS: {
      variant: "success",
      icon: <Shield size={12} />,
    },
    ENCARGADO_STOCK: {
      variant: "info",
      icon: <ShieldAlert size={12} />,
    },
  };

  const style = config[rolNombre] || {
    variant: "default" as const,
    icon: <Shield size={12} />,
  };

  const displayName = rolNombre.replace(/_/g, " ");

  return (
    <Badge variant={style.variant} size="sm" className="gap-1.5">
      {style.icon}
      {displayName}
    </Badge>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────
function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <Badge variant={activo ? "success" : "danger"} size="sm">
      {activo ? "Activo" : "Baja"}
    </Badge>
  );
}

// ─── Permission List ──────────────────────────────────────────────
function PermisosRol({ rolNombre }: { rolNombre: string }) {
  const info = PERMISOS_POR_ROL[rolNombre];
  if (!info) return null;

  return (
    <div className="mt-4 p-4 rounded-[var(--radius-lg)] bg-border/50 border border-border">
      <p className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
        <Shield size={14} className="text-brand" />
        Permisos del Rol: <span className="text-brand">{info.label}</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {info.permisos.map((perm) => (
          <div
            key={perm}
            className="flex items-center gap-2 text-[11px] text-text-muted py-1 px-2 rounded-[var(--radius-md)] bg-bg/50"
          >
            <CheckCircle2 size={10} className="text-success shrink-0" />
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

  // EmployeePanel state
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false);
  const [selectedUserForPanel, setSelectedUserForPanel] = useState<UsuarioConRol | null>(null);

  // ─── Search handler ───────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    startTransition(async () => {
      const results = await onSearch(query, false);
      setUsers(results);
    });
  };

  // ─── EmployeePanel handler ────────────────────────────────────
  const openEmployeePanel = (user: UsuarioConRol) => {
    setSelectedUserForPanel(user);
    setEmployeePanelOpen(true);
  };

  const closeEmployeePanel = () => {
    setEmployeePanelOpen(false);
    setSelectedUserForPanel(null);
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
    const newFotoUrl = result.fotoUrl ?? null;
    setEditingUser((prev) =>
      prev ? { ...prev, fotoUrl: newFotoUrl } : prev
    );
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
    <div className="flex flex-col h-full min-h-0">
      {/* 1. Stats Cards — compacto */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-2">
        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Total Usuarios</p>
            <p className="text-lg font-extrabold text-text">{users.length}</p>
          </div>
          <div className="p-1.5 bg-brand-light rounded text-brand">
            <Users size={14} />
          </div>
        </div>

        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Activos</p>
            <p className="text-lg font-extrabold text-success">{users.filter((u) => u.activo).length}</p>
          </div>
          <div className="p-1.5 bg-success-light rounded text-success">
            <UserCheck size={14} />
          </div>
        </div>

        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-lg font-extrabold text-danger">{users.filter((u) => !u.activo).length}</p>
          </div>
          <div className="p-1.5 bg-danger-light rounded text-danger">
            <UserX size={14} />
          </div>
        </div>
      </div>

      {/* 2. TableShell */}
      <TableShell
        title="Gestión de Usuarios"
        searchPlaceholder="Buscar por nombre, DNI, usuario..."
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        isEmpty={filteredUsers.length === 0}
        emptyMessage="No se encontraron usuarios"
        emptyIcon={<Users size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <CheckCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="pl-7 pr-6 py-1.5 bg-bg border border-border rounded text-text text-[11px] focus:outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
            <button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand)] text-white rounded text-[11px] font-semibold hover:bg-[var(--brand)]/90 transition">
              <Plus size={12} />
              Nuevo
            </button>
          </div>
        }
      >
        <div className="overflow-auto max-h-[calc(100vh-22rem)]">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 bg-[var(--card)]">
              <tr className="border-b border-border text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
                <th className="py-2 px-4">Usuario</th>
                <th className="py-2 px-4">DNI</th>
                <th className="py-2 px-4 hidden md:table-cell">Contacto</th>
                <th className="py-2 px-4">Rol</th>
                <th className="py-2 px-4 text-center">Estado</th>
                <th className="py-2 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm text-text-muted">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => openEmployeePanel(user)}
                  className={`group hover:bg-border/30 transition-colors duration-150 cursor-pointer ${
                    !user.activo ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar
                        fotoUrl={user.fotoUrl}
                        nombreCompleto={user.nombreCompleto}
                        size="md"
                        activo={user.activo}
                      />
                      <div>
                        <p className="font-semibold text-text text-sm leading-tight">
                          {user.nombreCompleto}
                        </p>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <span className="font-mono text-xs text-text-muted">{user.dni}</span>
                  </td>
                  <td className="py-2 px-4 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {user.correo && (
                        <p className="text-xs text-text-muted">{user.correo}</p>
                      )}
                      {user.telefono && (
                        <p className="text-xs text-text-secondary">{user.telefono}</p>
                      )}
                      {!user.correo && !user.telefono && (
                        <p className="text-[11px] text-text-secondary italic">Sin datos</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <RolBadge rolNombre={user.rol.nombre} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <EstadoBadge activo={user.activo} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(user)}
                        title="Editar"
                      >
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            userId: user.id,
                            userName: user.nombreCompleto,
                            isActive: user.activo,
                          })
                        }
                        title={user.activo ? "Dar de baja" : "Reactivar"}
                        className={user.activo ? "hover:text-danger" : "hover:text-success"}
                      >
                        {user.activo ? <UserX size={14} /> : <UserCheck size={14} />}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-brand-light rounded-[var(--radius-md)] text-brand border border-brand/10">
                {editingUser ? <Edit3 size={18} /> : <Plus size={18} />}
              </div>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Modifique los datos del usuario seleccionado"
                : "Complete los datos para registrar un nuevo usuario"}
            </DialogDescription>
          </DialogHeader>

          {/* ── Photo Upload Section ──────────────────────────── */}
          <div className="p-5 border-b border-border">
            <p className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
              <Camera size={14} />
              Foto de Perfil
            </p>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative shrink-0">
                {photoPreviewUrl ? (
                  <div className="w-16 h-16 rounded-[var(--radius-lg)] overflow-hidden border border-brand/20">
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
                  <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-border border border-border flex items-center justify-center text-text-secondary">
                    <ImageIcon size={24} />
                  </div>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 rounded-[var(--radius-lg)] bg-black/50 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-brand" />
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={triggerFileInput}
                    disabled={photoUploading}
                  >
                    <Upload size={12} />
                    {selectedPhotoFile ? "Cambiar foto" : editingUser?.fotoUrl ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {(editingUser?.fotoUrl || photoPreviewUrl) && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={
                        photoPreviewUrl
                          ? () => {
                              setSelectedPhotoFile(null);
                              setPhotoPreviewUrl(null);
                            }
                          : () => handleDeletePhotoNow(editingUser!.id)
                      }
                      disabled={photoUploading}
                      className="hover:text-danger"
                    >
                      <Trash2 size={12} />
                      {photoPreviewUrl ? "Cancelar" : "Eliminar"}
                    </Button>
                  )}
                </div>
                {selectedPhotoFile && editingUser && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleUploadPhotoNow(editingUser.id)}
                    disabled={photoUploading}
                  >
                    <CheckCircle2 size={12} />
                    Guardar foto
                  </Button>
                )}
                <p className="text-[10px] text-text-secondary">
                  JPG, PNG o WEBP. Máx 5 MB.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Error/Success messages */}
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-danger-light border border-danger/20 text-danger text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-success-light border border-success/20 text-success text-xs">
                <CheckCircle2 size={14} className="shrink-0" />
                {editingUser
                  ? "Usuario actualizado correctamente"
                  : "Usuario creado correctamente"}
              </div>
            )}

            {/* Nombre completo */}
            <FormField label="Nombre Completo" required>
              <Input
                id="input-nombre"
                name="nombreCompleto"
                type="text"
                required
                defaultValue={editingUser?.nombreCompleto || ""}
                placeholder="Ej: Juan Carlos Pérez"
              />
            </FormField>

            {/* DNI + Username row */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="DNI" required>
                <Input
                  id="input-dni"
                  name="dni"
                  type="text"
                  required
                  defaultValue={editingUser?.dni || ""}
                  placeholder="Ej: 35123456"
                />
              </FormField>
              <FormField label="Usuario" required>
                <Input
                  id="input-username"
                  name="username"
                  type="text"
                  required
                  defaultValue={editingUser?.username || ""}
                  placeholder="Ej: jperez"
                />
              </FormField>
            </div>

            {/* Correo + Teléfono row */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Correo Electrónico">
                <Input
                  id="input-correo"
                  name="correo"
                  type="email"
                  defaultValue={editingUser?.correo || ""}
                  placeholder="correo@ejemplo.com"
                />
              </FormField>
              <FormField label="Teléfono">
                <Input
                  id="input-telefono"
                  name="telefono"
                  type="text"
                  defaultValue={editingUser?.telefono || ""}
                  placeholder="Ej: 3764123456"
                />
              </FormField>
            </div>

            {/* Password */}
            <FormField
              label="Contraseña"
              required={!editingUser}
              error={editingUser ? undefined : undefined}
            >
              <div className="relative">
                <Input
                  id="input-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required={!editingUser}
                  placeholder={
                    editingUser ? "••••••••" : "Mínimo 4 caracteres"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {editingUser && (
                <p className="text-[10px] text-text-secondary mt-1">
                  Dejar vacío para mantener la actual
                </p>
              )}
            </FormField>

            {/* Role selector */}
            <FormField label="Rol" required>
              <div className="relative">
                <select
                  id="select-rol"
                  value={selectedRolId}
                  onChange={(e) => setSelectedRolId(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-bg border border-border text-text text-sm appearance-none focus:outline-none focus:border-brand transition-all cursor-pointer"
                >
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                />
              </div>
            </FormField>

            {/* Role permissions preview */}
            <PermisosRol rolNombre={selectedRolNombre} />

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
                id="btn-submit-usuario"
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {editingUser ? "Guardar Cambios" : "Crear Usuario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-3 rounded-[var(--radius-lg)] mb-4 ${
                confirmDialog.isActive
                  ? "bg-danger-light text-danger"
                  : "bg-success-light text-success"
              }`}
            >
              {confirmDialog.isActive ? (
                <UserX size={28} />
              ) : (
                <UserCheck size={28} />
              )}
            </div>
            <h3 className="text-lg font-bold text-text">
              {confirmDialog.isActive
                ? "Dar de Baja"
                : "Reactivar Usuario"}
            </h3>
            <p className="text-sm text-text-muted mt-2">
              {confirmDialog.isActive ? (
                <>
                  ¿Está seguro de dar de baja a{" "}
                  <span className="font-semibold text-text">
                    {confirmDialog.userName}
                  </span>
                  ? El usuario no podrá acceder al sistema, pero su
                  información se conservará.
                </>
              ) : (
                <>
                  ¿Desea reactivar al usuario{" "}
                  <span className="font-semibold text-text">
                    {confirmDialog.userName}
                  </span>
                  ? Podrá volver a acceder al sistema con su rol asignado.
                </>
              )}
            </p>
            <div className="flex items-center gap-3 mt-6 w-full">
              <Button
                variant="secondary"
                onClick={() =>
                  setConfirmDialog({ ...confirmDialog, open: false })
                }
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirm-toggle"
                variant={confirmDialog.isActive ? "danger" : "success"}
                onClick={handleToggleEstado}
                className="flex-1"
              >
                {confirmDialog.isActive ? "Dar de Baja" : "Reactivar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Employee Panel */}
      <EmployeePanel
        isOpen={employeePanelOpen}
        onClose={closeEmployeePanel}
        user={selectedUserForPanel}
        onEdit={(user) => {
          closeEmployeePanel();
          openEditModal(user);
        }}
        onToggle={(userId) => {
          closeEmployeePanel();
          setConfirmDialog({
            open: true,
            userId,
            userName: selectedUserForPanel?.nombreCompleto || "",
            isActive: selectedUserForPanel?.activo || false,
          });
        }}
      />
    </div>
  );
}