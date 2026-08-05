"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { TableShell } from "@/components/ui/table-shell";
import { ToolbarSelect } from "@/components/ui/toolbar-select";
import { PERMISSIONS,getAllPermissions } from "@/lib/permissions";
import {
AlertTriangle,
CheckCircle2,
CircleOff,
ChevronDown,
ChevronRight,
Copy,
Edit3,
Plus,
Power,
PowerOff,
Shield,
ShieldCheck,
ShieldOff,
Users
} from "lucide-react";
import React,{ useState } from "react";

type RolCompleto = {
  id: number;
  nombre: string;
  activo: boolean;
  descripcion: string;
  permisos: string[];
  _count: { usuarios: number };
};

interface RolesTableProps {
  roles: RolCompleto[];
  onCreateRole: (data: { nombre: string; descripcion: string; permisos: string[] }) => Promise<{ success?: boolean; error?: string }>;
  onUpdateRole: (id: number, data: { nombre: string; descripcion: string; permisos: string[] }) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onRefresh: () => Promise<RolCompleto[]>;
  externalCreateModalOpen?: boolean;
  onExternalCreateModalClose?: () => void;
}

const MODULE_COLORS: Record<string, string> = {
  dashboard: "var(--info)",
  productos: "var(--success)",
  ventas: "var(--brand)",
  caja: "var(--warning)",
  clientes: "var(--info)",
  proveedores: "var(--success)",
  usuarios: "var(--danger)",
  informes: "var(--warning)",
};

function RolBadge({ activo }: { activo: boolean }) {
  return (
    <Badge variant={activo ? "success" : "danger"} size="sm" className="gap-1.5">
      {activo ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export default function RolesTable({
  roles: initialRoles,
  onCreateRole,
  onUpdateRole,
  onToggleEstado,
  onRefresh,
  externalCreateModalOpen,
  onExternalCreateModalClose,
}: RolesTableProps) {
  const [roles, setRoles] = useState<RolCompleto[]>(initialRoles);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "activos" | "inactivos">("todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RolCompleto | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formPermisos, setFormPermisos] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accordion state for permissions modules
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    role: RolCompleto | null;
    action: "toggle";
    error: string | null;
  }>({ open: false, role: null, action: "toggle", error: null });

  const [detailModal, setDetailModal] = useState<{ open: boolean; role: RolCompleto | null }>({
    open: false,
    role: null,
  });

  const filteredRoles = roles.filter(r => {
    if (filterStatus === "activos" && !r.activo) return false;
    if (filterStatus === "inactivos" && r.activo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPerms = getAllPermissions().length;

  const openCreateModal = () => {
    setEditingRole(null);
    setFormNombre("");
    setFormDescripcion("");
    setFormPermisos([]);
    setFormError(null);
    setFormSuccess(false);
    setExpandedModules({});
    setModalOpen(true);
  };

  const openEditModal = (role: RolCompleto) => {
    setEditingRole(role);
    setFormNombre(role.nombre);
    setFormDescripcion(role.descripcion);
    setFormPermisos([...role.permisos]);
    setFormError(null);
    setFormSuccess(false);
    // Expand all modules that have selected permissions
    const initialExpanded: Record<string, boolean> = {};
    Object.entries(PERMISSIONS).forEach(([key, mod]) => {
      initialExpanded[key] = mod.permissions.some(p => role.permisos.includes(p.key));
    });
    setExpandedModules(initialExpanded);
    setModalOpen(true);
  };

  const isModalOpen = modalOpen || externalCreateModalOpen;
  const roleForModal = externalCreateModalOpen ? null : editingRole;
  const isAdminRole = roleForModal?.nombre === "ADMINISTRADOR";

  const closeModal = () => {
    setModalOpen(false);
    setEditingRole(null);
    setFormError(null);
    setFormSuccess(false);
    if (externalCreateModalOpen) {
      onExternalCreateModalClose?.();
    }
  };

  const toggleModule = (moduleKey: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  const toggleAllModules = () => {
    const allExpanded = Object.keys(PERMISSIONS).every(k => expandedModules[k]);
    const newState: Record<string, boolean> = {};
    Object.keys(PERMISSIONS).forEach(k => { newState[k] = !allExpanded; });
    setExpandedModules(newState);
  };

  const togglePermission = (key: string) => {
    setFormPermisos(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const toggleModulePermissions = (moduleKey: string) => {
    const permissionModule = PERMISSIONS[moduleKey as keyof typeof PERMISSIONS];
    if (!permissionModule) return;
    const moduleKeys = permissionModule.permissions.map(p => p.key);
    const allSelected = moduleKeys.every(k => formPermisos.includes(k));

    if (allSelected) {
      setFormPermisos(prev => prev.filter(p => !moduleKeys.includes(p)));
    } else {
      setFormPermisos(prev => [...new Set([...prev, ...moduleKeys])]);
    }
  };

  const selectAllPermissions = () => {
    setFormPermisos(getAllPermissions());
  };

  const clearAllPermissions = () => {
    setFormPermisos([]);
  };

  const copyFromRole = (role: RolCompleto) => {
    setFormPermisos([...role.permisos]);
    setFormNombre(role.nombre + " (copia)");
    setFormDescripcion(role.descripcion ? `Copia de ${role.descripcion}` : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    const data = {
      nombre: formNombre,
      descripcion: formDescripcion,
      permisos: formPermisos,
    };

    let result;
    if (editingRole) {
      result = await onUpdateRole(editingRole.id, data);
    } else {
      result = await onCreateRole(data);
    }

    if (result.error) {
      setFormError(result.error);
      setIsSubmitting(false);
      return;
    }

    setFormSuccess(true);
    setIsSubmitting(false);

    const refreshed = await onRefresh();
    setRoles(refreshed);

    setTimeout(closeModal, 800);
  };

  const handleToggleEstado = async () => {
    if (!confirmDialog.role) return;
    const roleId = confirmDialog.role.id;

    const result = await onToggleEstado(roleId);
    if (result.error) {
      setConfirmDialog(prev => ({ ...prev, error: result.error! }));
      return;
    }

    setConfirmDialog({ open: false, role: null, action: "toggle", error: null });
    const refreshed = await onRefresh();
    setRoles(refreshed);
  };

  const getModulePermCount = (moduleKey: string): { selected: number; total: number } => {
    const permissionModule = PERMISSIONS[moduleKey as keyof typeof PERMISSIONS];
    if (!permissionModule) return { selected: 0, total: 0 };
    const total = permissionModule.permissions.length;
    const selected = permissionModule.permissions.filter(p => formPermisos.includes(p.key)).length;
    return { selected, total };
  };

  const getModuleCheckState = (moduleKey: string): "all" | "some" | "none" => {
    const { selected, total } = getModulePermCount(moduleKey);
    if (selected === total) return "all";
    if (selected > 0) return "some";
    return "none";
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 shrink-0 mb-3">
        <div className="bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(59,130,246,0.03))] border border-[#3B82F6]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(59,130,246,0.12)]">
          <div>
            <p className="text-xs text-[#3B82F6] font-extrabold uppercase tracking-wider">Total Roles</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{roles.length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Roles configurados</p>
          </div>
          <div className="p-3 bg-[#3B82F6]/15 rounded-full text-[#3B82F6] ring-1 ring-[#3B82F6]/20">
            <Shield size={28} />
          </div>
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.03))] border border-[#22C55E]/35 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(34,197,94,0.12)]">
          <div>
            <p className="text-xs text-[#22C55E] font-extrabold uppercase tracking-wider">Activos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{roles.filter(r => r.activo).length}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Roles habilitados</p>
          </div>
          <div className="p-3 bg-[#22C55E]/15 rounded-full text-[#22C55E] ring-1 ring-[#22C55E]/20">
            <ShieldCheck size={28} />
          </div>
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(139,92,246,0.10),rgba(139,92,246,0.03))] border border-[#8B5CF6]/30 p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(139,92,246,0.12)]">
          <div>
            <p className="text-xs text-[#A78BFA] font-extrabold uppercase tracking-wider">Permisos</p>
            <p className="text-3xl font-black text-[var(--text)] leading-none mt-1">{totalPerms}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">Permisos disponibles</p>
          </div>
          <div className="p-3 bg-[#8B5CF6]/15 rounded-full text-[#A78BFA] ring-1 ring-[#8B5CF6]/20">
            <CheckCircle2 size={28} />
          </div>
        </div>
      </div>

      <TableShell
        title="Roles"
        searchLabel="Busqueda de rol"
        searchPlaceholder="Buscar rol por nombre o descripcion..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        isEmpty={filteredRoles.length === 0}
        emptyMessage="No se encontraron roles"
        emptyIcon={<Shield size={32} className="opacity-40" />}
        centeredHeaderControls
        hideHeaderTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <ToolbarSelect
              label="Estado"
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}
              triggerIcon={ShieldCheck}
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
                { value: "todos", label: "Todos", icon: Shield },
                { value: "activos", label: "Activos", icon: ShieldCheck },
                { value: "inactivos", label: "Inactivos", icon: CircleOff },
              ]}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Acciones</label>
              <button
                onClick={openCreateModal}
                className="group flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20"
              >
                <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
                  <Shield size={14} strokeWidth={2.5} />
                  <Plus size={8} strokeWidth={3} className="absolute top-0 right-0" />
                </span>
                Nuevo Rol
              </button>
            </div>
          </div>
        }
      >
        <div className="min-w-full">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left min-w-[760px]">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead className="bg-[#17191f]">
              <tr className="bg-[#17191f] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6]">
                {[
                  "Rol",
                  "Descripcion",
                  "Permisos",
                  "Usuarios",
                  "Estado",
                  "Acciones",
                ].map((heading, index) => (
                  <th
                    key={heading}
                    className={`sticky top-0 z-40 bg-[#17191f] bg-clip-padding py-4 px-4 shadow-[inset_0_-1px_0_rgba(42,46,56,0.95),0_6px_12px_rgba(0,0,0,0.16)] ${index >= 2 ? "text-center" : ""}`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-[13px] text-[var(--text-muted)]">
              {filteredRoles.map((role, index) => (
                <tr
                  key={role.id}
                  className={`group transition-colors duration-150 ${index % 2 === 0 ? "bg-[#1E2129]/45 hover:bg-white/[0.045]" : "bg-[#20242E]/45 hover:bg-white/[0.045]"} ${
                    !role.activo ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ring-1 ${
                        role.nombre === "ADMINISTRADOR"
                          ? "bg-[var(--danger-light)] text-[var(--danger)] ring-[var(--danger)]/20"
                          : role.nombre === "ENCARGADO_VENTAS"
                          ? "bg-[var(--success-light)] text-[var(--success)] ring-[var(--success)]/20"
                          : "bg-[var(--info-light)] text-[var(--info)] ring-[var(--info)]/20"
                      }`}>
                        <Shield size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text)] text-sm leading-tight group-hover:text-[var(--brand)] transition-colors truncate">
                          {role.nombre.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {role.descripcion || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setDetailModal({ open: true, role })}
                      className="rounded-full border border-[var(--brand)]/25 bg-[var(--brand-light)]/20 px-2.5 py-1 text-xs font-mono font-bold text-[var(--brand)] transition hover:border-[var(--brand)]/60 hover:bg-[var(--brand-light)]/35"
                      title="Ver detalles"
                    >
                      {role.permisos.length}/{totalPerms}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users size={12} className="text-[var(--text-secondary)]" />
                      <span className="text-xs font-semibold text-[var(--text-muted)]">{role._count.usuarios}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <RolBadge activo={role.activo} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {role.nombre !== "ADMINISTRADOR" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(role)}
                          title="Editar"
                          className="transition-all duration-150 hover:bg-white/[0.06]"
                        >
                          <Edit3 size={16} />
                        </Button>
                      )}
                      {role.nombre !== "ADMINISTRADOR" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDialog({ open: true, role, action: "toggle", error: null })}
                          title={role.activo ? "Desactivar" : "Activar"}
                          className={`transition-all duration-150 hover:bg-white/[0.06] ${role.activo ? "hover:text-[var(--warning)]" : "hover:text-[var(--success)]"}`}
                        >
                          {role.activo ? <PowerOff size={16} /> : <Power size={16} />}
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

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="w-[90vw] max-w-[1400px] p-0 gap-0 overflow-hidden">
          {/* ── Fixed Header ── */}
          <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="p-2 bg-brand-light rounded-[var(--radius-md)] text-brand border border-brand/10">
                  {roleForModal ? <Edit3 size={18} /> : <Shield size={18} />}
                </div>
                {roleForModal ? "Editar Rol" : "Nuevo Rol"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {roleForModal
                  ? "Modifique los datos y permisos del rol"
                  : "Defina un nuevo rol con sus permisos"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Scrollable Body ── */}
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0" style={{ maxHeight: "calc(90vh - 8rem)" }}>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-[var(--radius-md)] bg-danger-light border border-danger/20 text-danger text-sm">
                  <AlertTriangle size={14} className="shrink-0" />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-[var(--radius-md)] bg-success-light border border-success/20 text-success text-sm">
                  <CheckCircle2 size={14} className="shrink-0" />
                  {roleForModal ? "Rol actualizado correctamente" : "Rol creado correctamente"}
                </div>
              )}

              <div className="flex gap-6">
                {/* ── Left Column (~30%): Role info ── */}
                <div className="w-[30%] shrink-0 space-y-4">
                  <FormField label="Nombre del Rol" required>
                    <Input
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Ej: SUPERVISOR"
                      required
                      className="text-sm"
                    />
                  </FormField>

                  <FormField label="Descripción">
                    <Input
                      value={formDescripcion}
                      onChange={(e) => setFormDescripcion(e.target.value)}
                      placeholder="Ej: Supervisión general"
                      className="text-sm"
                    />
                  </FormField>

                  {/* Edit mode: show role status */}
                  {roleForModal && (
                    <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Estado</p>
                      <RolBadge activo={roleForModal.activo} />
                    </div>
                  )}

                  {/* Copy from existing role */}
                  {!roleForModal && roles.length > 0 && (
                    <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                        Copiar permisos de un rol existente
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => copyFromRole(r)}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors"
                          >
                            <Copy size={10} />
                            {r.nombre.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Permission summary */}
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--brand-light)] border border-[var(--brand)]/15">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                      Resumen
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold text-[var(--brand)]">{formPermisos.length}</span>
                      <span className="text-sm text-[var(--text-secondary)]">/ {totalPerms} permisos</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {formPermisos.length === totalPerms
                        ? "Todos los permisos seleccionados"
                        : formPermisos.length === 0
                        ? "Sin permisos asignados"
                        : `${Math.round((formPermisos.length / totalPerms) * 100)}% del total`}
                    </p>
                  </div>
                </div>

                {/* ── Right Column (~70%): Permissions ── */}
                <div className="flex-1 min-w-0">
                  {isAdminRole && (
                    <div className="flex items-center gap-2 p-3 mb-3 rounded-[var(--radius-md)] bg-[var(--info-light)] border border-[var(--info)]/20 text-[var(--info)] text-sm font-semibold">
                      <ShieldCheck size={16} className="shrink-0" />
                      El rol Administrador tiene permisos fijos que no pueden modificarse
                    </div>
                  )}

                  {/* Controls bar */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--border)]">
                    <p className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                      <Shield size={16} className="text-[var(--brand)]" />
                      Permisos
                      <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg)] px-2 py-0.5 rounded">
                        {formPermisos.length} / {totalPerms}
                      </span>
                    </p>
                    {!isAdminRole && (
                      <div className="flex items-center gap-3 text-xs">
                        <button type="button" onClick={selectAllPermissions} className="font-semibold text-[var(--brand)] hover:underline">Todos</button>
                        <span className="text-[var(--border)]">|</span>
                        <button type="button" onClick={clearAllPermissions} className="font-semibold text-[var(--text-secondary)] hover:underline">Ninguno</button>
                        <span className="text-[var(--border)]">|</span>
                        <button type="button" onClick={toggleAllModules} className="font-semibold text-[var(--text-secondary)] hover:underline">
                          {Object.keys(PERMISSIONS).every(k => expandedModules[k]) ? "Contraer" : "Expandir"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Module accordions */}
                  <div className="space-y-2">
                    {Object.entries(PERMISSIONS).map(([moduleKey, module]) => {
                      const checkState = getModuleCheckState(moduleKey);
                      const { selected, total } = getModulePermCount(moduleKey);
                      const isExpanded = expandedModules[moduleKey];

                      return (
                        <div key={moduleKey} className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                          {/* Module header — compact accordion trigger */}
                          <div
                            className={`flex items-center gap-2.5 px-3 py-2 bg-[var(--panel)] transition-colors select-none ${
                              isAdminRole ? "cursor-default" : "cursor-pointer hover:bg-[var(--border)]/20"
                            }`}
                            onClick={() => !isAdminRole && toggleModule(moduleKey)}
                          >
                            <div className="shrink-0 text-[var(--text-secondary)]">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>

                            {/* Module checkbox */}
                            <div
                              className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                                checkState === "all"
                                  ? "bg-[var(--brand)] border-[var(--brand)]"
                                  : checkState === "some"
                                  ? "bg-[var(--brand)]/30 border-[var(--brand)]"
                                  : "border-[var(--border)] bg-[var(--bg)]"
                              } ${isAdminRole ? "opacity-60" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAdminRole) toggleModulePermissions(moduleKey);
                              }}
                            >
                              {checkState === "all" && <CheckCircle2 size={10} className="text-white" />}
                              {checkState === "some" && <div className="w-2 h-0.5 bg-[var(--brand)] rounded" />}
                            </div>

                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: MODULE_COLORS[moduleKey] || "var(--text-secondary)" }}
                            />

                            <span className="text-sm font-bold text-[var(--text)] flex-1">{module.label}</span>
                            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                              {selected}/{total}
                            </span>
                          </div>

                          {/* Permissions grid — 4 columns, compact */}
                          {isExpanded && (
                            <div className="px-3 py-2.5 grid grid-cols-4 gap-1.5 bg-[var(--bg)]/50 border-t border-[var(--border)]/50">
                              {module.permissions.map(perm => {
                                const isSelected = formPermisos.includes(perm.key);
                                return (
                                  <label
                                    key={perm.key}
                                    className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-[var(--radius-md)] transition-colors ${
                                      isAdminRole
                                        ? "opacity-70 cursor-default"
                                        : "cursor-pointer"
                                    } ${
                                      isSelected
                                        ? "bg-[var(--brand-light)] text-[var(--text)] border border-[var(--brand)]/20"
                                        : "bg-[var(--card)] text-[var(--text-muted)] border border-transparent hover:border-[var(--border)]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => !isAdminRole && togglePermission(perm.key)}
                                      className="sr-only"
                                      disabled={isAdminRole}
                                    />
                                    <div
                                      className={`w-3.5 h-3.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 ${
                                        isSelected
                                          ? "bg-[var(--brand)] border-[var(--brand)]"
                                          : "border-[var(--border)]"
                                      }`}
                                    >
                                      {isSelected && <CheckCircle2 size={8} className="text-white" />}
                                    </div>
                                    <span className="truncate">{perm.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Fixed Footer ── */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] flex items-center justify-end gap-3 shrink-0">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting} className="text-sm px-5 py-2.5">
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={isSubmitting} className="text-sm px-5 py-2.5">
                {roleForModal ? "Guardar Cambios" : "Crear Rol"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open, error: null })}
      >
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-3 rounded-[var(--radius-lg)] mb-4 ${
                confirmDialog.role?.activo
                  ? "bg-warning-light text-warning"
                  : "bg-success-light text-success"
              }`}
            >
              {confirmDialog.role?.activo ? <PowerOff size={28} /> : <Power size={28} />}
            </div>
            <h3 className="text-lg font-bold text-[var(--text)]">
              {confirmDialog.role?.activo
                ? "Desactivar Rol"
                : "Activar Rol"}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              {confirmDialog.role?.activo ? (
                <>
                  ¿Está seguro de desactivar el rol{" "}
                  <span className="font-semibold text-[var(--text)]">
                    {confirmDialog.role?.nombre.replace(/_/g, " ")}
                  </span>
                  ? Los usuarios con este rol podrían perder acceso a funcionalidades.
                </>
              ) : (
                <>
                  ¿Desea activar el rol{" "}
                  <span className="font-semibold text-[var(--text)]">
                    {confirmDialog.role?.nombre.replace(/_/g, " ")}
                  </span>
                  ?
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
                onClick={() => setConfirmDialog({ ...confirmDialog, open: false, error: null })}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant={confirmDialog.role?.activo ? "warning" : "success"}
                onClick={handleToggleEstado}
                className="flex-1"
              >
                {confirmDialog.role?.activo ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={detailModal.open}
        onOpenChange={(open) => setDetailModal({ ...detailModal, open })}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          <div className="bg-gradient-to-r from-[#111827] via-[#151923] to-[#10131a] px-6 py-5 border-b border-[var(--border)] shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
                  <Shield size={18} />
                </div>
                Permisos: {detailModal.role?.nombre.replace(/_/g, " ")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {detailModal.role?.descripcion || "Permisos asignados a este rol"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {detailModal.role && (
            <div className="space-y-3 overflow-y-auto p-6">
              {Object.entries(PERMISSIONS).map(([moduleKey, module]) => {
                const modulePerms = module.permissions.filter(p =>
                  detailModal.role!.permisos.includes(p.key)
                );
                if (modulePerms.length === 0) return null;

                return (
                  <div key={moduleKey} className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[#151922] shadow-[var(--shadow-sm)]">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-[#17191f] border-b border-[var(--border)]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: MODULE_COLORS[moduleKey] || "var(--text-secondary)" }}
                      />
                      <span className="text-xs font-bold text-[var(--text)]">{module.label}</span>
                      <Badge variant="info" size="sm">{modulePerms.length}</Badge>
                    </div>
                    <div className="px-3 py-3 grid grid-cols-2 gap-2">
                      {modulePerms.map(perm => (
                        <div
                          key={perm.key}
                          className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] py-1.5 px-2 rounded-[var(--radius-md)] bg-[var(--bg)]/60 hover:bg-white/[0.04] transition-colors"
                        >
                          <CheckCircle2 size={10} className="text-[var(--success)] shrink-0" />
                          {perm.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {detailModal.role.permisos.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">
                  Este rol no tiene permisos asignados
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

