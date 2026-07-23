"use client";

import React, { useState, useTransition, useMemo, useCallback, useRef } from "react";
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
  Mail,
  Phone,
  Crown,
} from "lucide-react";
import { PERMISSIONS, parseRoleData } from "@/lib/permissions";

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
  activo?: boolean;
};

// ─── Sort ─────────────────────────────────────────────────────────
type SortField = "nombreCompleto" | "username" | "dni" | "correo" | "rol" | "activo";
type SortDir = "asc" | "desc" | null;

const TEXT_SORT_FIELDS = new Set<SortField>(["nombreCompleto", "username", "correo", "rol"]);

interface UsuariosTableProps {
  initialUsers: UsuarioConRol[];
  roles: RolOption[];
  userPermissions?: string[];
  onCreateUser: (formData: FormData) => Promise<{ success?: boolean; error?: string; id?: number }>;
  onUpdateUser: (id: number, formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onSearch: (query: string, soloActivos: boolean) => Promise<UsuarioConRol[]>;
  onUploadPhoto: (userId: number, formData: FormData) => Promise<{ success?: boolean; fotoUrl?: string; error?: string }>;
  onDeletePhoto: (userId: number) => Promise<{ success?: boolean; error?: string }>;
}

// ─── Role Permissions Map ─────────────────────────────────────────
function PermisosRol({ rolNombre }: { rolNombre: string }) {
  const roleData = parseRoleData(null);
  const moduleKey = rolNombre === "ADMINISTRADOR" ? "all" :
    rolNombre === "ENCARGADO_VENTAS" ? "ventas" : "productos";

  const description =
    rolNombre === "ADMINISTRADOR" ? "Acceso completo a todas las funcionalidades del sistema" :
    rolNombre === "ENCARGADO_VENTAS" ? "Gestión de Ventas, Caja y Clientes" :
    rolNombre === "ENCARGADO_STOCK" ? "Gestión de Inventario y Proveedores" : "";

  const permCount =
    rolNombre === "ADMINISTRADOR" ? 41 :
    rolNombre === "ENCARGADO_VENTAS" ? 21 :
    rolNombre === "ENCARGADO_STOCK" ? 16 : 0;

  const config: Record<string, { variant: "danger" | "success" | "info" | "default"; icon: React.ReactNode }> = {
    ADMINISTRADOR: { variant: "danger", icon: <ShieldCheck size={12} /> },
    ENCARGADO_VENTAS: { variant: "success", icon: <Shield size={12} /> },
    ENCARGADO_STOCK: { variant: "info", icon: <ShieldAlert size={12} /> },
  };

  const style = config[rolNombre] || { variant: "default" as const, icon: <Shield size={12} /> };

  return (
    <div className="p-3 rounded-[var(--radius-lg)] bg-border/50 border border-border">
      <p className="text-[10px] font-semibold text-text-muted mb-2 flex items-center gap-2">
        <Shield size={12} className="text-brand" />
        Permisos del Rol
      </p>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={style.variant} size="sm" className="gap-1.5">
          {style.icon}
          {rolNombre.replace(/_/g, " ")}
        </Badge>
        <span className="text-[10px] font-mono text-text-secondary">
          {permCount} permisos
        </span>
      </div>
      <p className="text-[10px] text-text-secondary">{description}</p>
    </div>
  );
}

// ─── Role Badge Component ─────────────────────────────────────────
function RolBadge({ rolNombre }: { rolNombre: string }) {
  const config: Record<string, { variant: "danger" | "success" | "info" | "default"; icon: React.ReactNode }> = {
    ADMINISTRADOR: { variant: "danger", icon: <ShieldCheck size={12} /> },
    ENCARGADO_VENTAS: { variant: "success", icon: <Shield size={12} /> },
    ENCARGADO_STOCK: { variant: "info", icon: <ShieldAlert size={12} /> },
  };

  const style = config[rolNombre] || { variant: "default" as const, icon: <Shield size={12} /> };
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

// ─── Main Component ───────────────────────────────────────────────
export default function UsuariosTable({
  initialUsers,
  roles,
  userPermissions = [],
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

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

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
    error: string | null;
  }>({ open: false, userId: 0, userName: "", isActive: true, error: null });

  // EmployeePanel state
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false);
  const [selectedUserForPanel, setSelectedUserForPanel] = useState<UsuarioConRol | null>(null);

  // Compute the primary admin: the user with ADMINISTRADOR role and lowest ID
  const primaryAdminId = useMemo(() => {
    const admins = users.filter(u => u.rol.nombre === "ADMINISTRADOR");
    if (admins.length === 0) return null;
    return admins.reduce((min, u) => (u.id < min.id ? u : min), admins[0]).id;
  }, [users]);

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

  // ─── Sort handlers ───────────────────────────────────────────
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

  // ─── Sorted users ──────────────────────────────────────────
  const sortedUsers = useMemo(() => {
    const result = [...filteredUsers];
    if (!sortField || !sortDir) return result;
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "nombreCompleto": cmp = a.nombreCompleto.localeCompare(b.nombreCompleto); break;
        case "username": cmp = a.username.localeCompare(b.username); break;
        case "dni": cmp = a.dni.localeCompare(b.dni); break;
        case "correo": cmp = (a.correo || "").localeCompare(b.correo || ""); break;
        case "rol": cmp = a.rol.nombre.localeCompare(b.rol.nombre); break;
        case "activo": cmp = (a.activo ? 0 : 1) - (b.activo ? 0 : 1); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [filteredUsers, sortField, sortDir]);

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
    setConfirmDialog({ ...confirmDialog, open: false, error: null });

    const result = await onToggleEstado(userId);
    if (result.success) {
      const results = await onSearch(searchQuery, false);
      setUsers(results);
    } else if (result.error) {
      // Re-open dialog with error
      setConfirmDialog({
        open: true,
        userId,
        userName: confirmDialog.userName,
        isActive: confirmDialog.isActive,
        error: result.error,
      });
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
      {/* 1. Stats Cards */}
      <div className="grid grid-cols-3 gap-4 shrink-0 mb-4">
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total Usuarios</p>
            <p className="text-2xl font-extrabold text-[var(--text)]">{users.length}</p>
          </div>
          <div className="p-2.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Activos</p>
            <p className="text-2xl font-extrabold text-[var(--success)]">{users.filter((u) => u.activo).length}</p>
          </div>
          <div className="p-2.5 bg-[var(--success-light)] rounded-lg text-[var(--success)]">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-2xl font-extrabold text-[var(--danger)]">{users.filter((u) => !u.activo).length}</p>
          </div>
          <div className="p-2.5 bg-[var(--danger-light)] rounded-lg text-[var(--danger)]">
            <UserX size={20} />
          </div>
        </div>
      </div>

      {/* 2. TableShell */}
      <TableShell
        title="Usuarios"
        searchPlaceholder="Buscar por nombre, DNI, usuario..."
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        isEmpty={sortedUsers.length === 0}
        emptyMessage="No se encontraron usuarios"
        emptyIcon={<Users size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Estado</label>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
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
            <button onClick={openCreateModal} className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand)]/90 transition">
              <Plus size={14} />
              Nuevo usuario
            </button>
          </div>
        }
      >
        <div className="overflow-auto max-h-[calc(100vh-22rem)]">
          <table className="w-full text-left border-collapse min-w-[700px]" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead className="sticky top-0 bg-[var(--panel)]">
              <tr className="border-b-2 border-[var(--border)] text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                <th
                  className="py-3.5 px-4 cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors"
                  onClick={() => handleSortCycle("nombreCompleto")}
                  title={getSortTooltip("nombreCompleto")}
                >
                  <div className="flex items-center gap-2">Usuario {renderSortIndicator("nombreCompleto")}</div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors"
                  onClick={() => handleSortCycle("dni")}
                  title={getSortTooltip("dni")}
                >
                  <div className="flex items-center gap-2">DNI {renderSortIndicator("dni")}</div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors"
                  onClick={() => handleSortCycle("correo")}
                  title={getSortTooltip("correo")}
                >
                  <div className="flex items-center gap-2">Contacto {renderSortIndicator("correo")}</div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors"
                  onClick={() => handleSortCycle("rol")}
                  title={getSortTooltip("rol")}
                >
                  <div className="flex items-center gap-2">Rol {renderSortIndicator("rol")}</div>
                </th>
                <th
                  className="py-3.5 px-4 text-center cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors"
                  onClick={() => handleSortCycle("activo")}
                  title={getSortTooltip("activo")}
                >
                  <div className="flex items-center justify-center gap-2">Estado {renderSortIndicator("activo")}</div>
                </th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-sm text-[var(--text-muted)]">
              {sortedUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => openEmployeePanel(user)}
                  className={`group hover:bg-[var(--panel)] transition-colors duration-150 cursor-pointer ${
                    !user.activo ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar
                        fotoUrl={user.fotoUrl}
                        nombreCompleto={user.nombreCompleto}
                        size="md"
                        activo={user.activo}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text)] text-sm leading-tight group-hover:text-[var(--brand)] transition-colors truncate">
                          {user.nombreCompleto}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-mono text-sm text-[var(--text-muted)]">{user.dni}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="space-y-1">
                      {user.correo && (
                        <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5">
                          <Mail size={12} className="text-[var(--text-secondary)] shrink-0" />
                          {user.correo}
                        </p>
                      )}
                      {user.telefono && (
                        <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
                          <Phone size={12} className="text-[var(--text-secondary)] shrink-0" />
                          {user.telefono}
                        </p>
                      )}
                      {!user.correo && !user.telefono && (
                        <p className="text-sm text-[var(--text-secondary)] italic">Sin datos</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <RolBadge rolNombre={user.rol.nombre} />
                      {user.id === primaryAdminId && (
                        <span
                          className="text-[var(--warning)] opacity-80 shrink-0"
                          title="Este es el administrador principal y no puede darse de baja"
                        >
                          <Crown size={14} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <EstadoBadge activo={user.activo} />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </Button>
                      {user.id === primaryAdminId ? (
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)]/40 cursor-not-allowed"
                          title="Este es el administrador principal del sistema y no puede darse de baja."
                        >
                          <UserX size={16} />
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDialog({
                              open: true,
                              userId: user.id,
                              userName: user.nombreCompleto,
                              isActive: user.activo,
                              error: null,
                            });
                          }}
                          title={user.activo ? "Cambiar estado" : "Cambiar estado"}
                          className={user.activo ? "hover:text-[var(--warning)]" : "hover:text-[var(--success)]"}
                        >
                          {user.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                        </Button>
                      )}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex items-center gap-4 p-4 border-b border-border">
            {/* Preview */}
            <div className="relative shrink-0">
              {photoPreviewUrl ? (
                <div className="w-14 h-14 rounded-[var(--radius-lg)] overflow-hidden border border-brand/20">
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
                  size="lg"
                  activo={editingUser.activo}
                />
              ) : (
                <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-border border border-border flex items-center justify-center text-text-secondary">
                  <ImageIcon size={20} />
                </div>
              )}
              {photoUploading && (
                <div className="absolute inset-0 rounded-[var(--radius-lg)] bg-black/50 flex items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-brand" />
                </div>
              )}
            </div>

            {/* Buttons & info */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={triggerFileInput}
                  disabled={photoUploading}
                >
                  <Upload size={12} />
                  {selectedPhotoFile ? "Cambiar" : editingUser?.fotoUrl ? "Cambiar" : "Subir foto"}
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
                {selectedPhotoFile && editingUser && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleUploadPhotoNow(editingUser.id)}
                    disabled={photoUploading}
                  >
                    <CheckCircle2 size={12} />
                    Guardar
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-text-secondary">
                JPG, PNG o WEBP. Máx 5 MB.
              </p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-3">
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

                {/* DNI */}
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

                {/* Username */}
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

                {/* Correo */}
                <FormField label="Correo Electrónico">
                  <Input
                    id="input-correo"
                    name="correo"
                    type="email"
                    defaultValue={editingUser?.correo || ""}
                    placeholder="correo@ejemplo.com"
                  />
                </FormField>

                {/* Teléfono */}
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

              {/* Right column */}
              <div className="space-y-3">
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
                      disabled={editingUser?.id === primaryAdminId}
                      className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-bg border border-border text-text text-sm appearance-none focus:outline-none focus:border-brand transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {roles.filter(r => r.activo !== false).map((rol) => (
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
                  {editingUser?.id === primaryAdminId && (
                    <p className="text-[10px] text-[var(--warning)] mt-1 flex items-center gap-1">
                      <Crown size={10} />
                      El administrador principal no puede cambiar su rol
                    </p>
                  )}
                </FormField>

                {/* Role permissions preview */}
                <PermisosRol rolNombre={selectedRolNombre} />
              </div>
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 bg-[var(--panel)] border-t border-[var(--border)] p-4 flex items-center justify-end gap-3 -mx-5 -mb-5 mt-4">
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
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open, error: null })}>
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
            {confirmDialog.error && (
              <div className="flex items-center gap-2 p-3 mt-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs w-full">
                <AlertTriangle size={14} className="shrink-0" />
                {confirmDialog.error}
              </div>
            )}
            <div className="flex items-center gap-3 mt-6 w-full">
              <Button
                variant="secondary"
                onClick={() =>
                  setConfirmDialog({ ...confirmDialog, open: false, error: null })
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
        isPrimaryAdmin={selectedUserForPanel?.id === primaryAdminId}
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
            error: null,
          });
        }}
        onUploadPhoto={onUploadPhoto}
        onPhotoUpdated={(newFotoUrl) => {
          setSelectedUserForPanel((prev) => prev ? { ...prev, fotoUrl: newFotoUrl } : prev);
          onSearch(searchQuery, false).then(setUsers);
        }}
      />
    </div>
  );
}