"use client";

import RolesTable from "@/components/tables/RolesTable";
import UsuariosTable from "@/components/tables/UsuariosTable";
import { Shield,Users } from "lucide-react";
import { useState } from "react";

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
  rol: { id: number; nombre: string };
};

type RolOption = { id: number; nombre: string };

type RolCompleto = {
  id: number;
  nombre: string;
  activo: boolean;
  descripcion: string;
  permisos: string[];
  _count: { usuarios: number };
};

interface EmpleadosTabsProps {
  initialUsers: UsuarioConRol[];
  roles: RolOption[];
  rolesCompletos: RolCompleto[];
  userPermissions: string[];
  onCreateUser: (formData: FormData) => Promise<{ success?: boolean; error?: string; id?: number }>;
  onUpdateUser: (id: number, formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onToggleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onSearch: (query: string, soloActivos: boolean) => Promise<UsuarioConRol[]>;
  onUploadPhoto: (userId: number, formData: FormData) => Promise<{ success?: boolean; fotoUrl?: string; error?: string }>;
  onDeletePhoto: (userId: number) => Promise<{ success?: boolean; error?: string }>;
  onCreateRole: (data: { nombre: string; descripcion: string; permisos: string[] }) => Promise<{ success?: boolean; error?: string }>;
  onUpdateRole: (id: number, data: { nombre: string; descripcion: string; permisos: string[] }) => Promise<{ success?: boolean; error?: string }>;
  onToggleRoleEstado: (id: number) => Promise<{ success?: boolean; error?: string }>;
  onRefreshRoles: () => Promise<RolCompleto[]>;
}

export default function EmpleadosTabs({
  initialUsers,
  roles,
  rolesCompletos,
  userPermissions,
  onCreateUser,
  onUpdateUser,
  onToggleEstado,
  onSearch,
  onUploadPhoto,
  onDeletePhoto,
  onCreateRole,
  onUpdateRole,
  onToggleRoleEstado,
  onRefreshRoles,
}: EmpleadosTabsProps) {
  const [activeTab, setActiveTab] = useState<"usuarios" | "roles">("usuarios");
  const [currentRoles, setCurrentRoles] = useState<RolCompleto[]>(rolesCompletos);
  const [roleCreateModalOpen, setRoleCreateModalOpen] = useState(false);

  const handleRefreshRoles = async () => {
    const refreshed = await onRefreshRoles();
    setCurrentRoles(refreshed);
    return refreshed;
  };

  const hasRoleManagement = userPermissions.includes("usuarios.roles");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with tabs */}
      <div className="relative flex flex-col items-center justify-center shrink-0 mb-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
            {activeTab === "usuarios" ? <Users size={24} /> : <Shield size={24} />}
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
            {activeTab === "usuarios" ? "Gestión de Usuarios" : "Gestión de Roles"}
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          {activeTab === "usuarios" ? "Gestión y seguimiento de usuarios" : "Configuración de roles y permisos"}
        </p>

        {hasRoleManagement && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center bg-[var(--panel)] border border-[var(--border)] rounded-xl p-0.5 shadow-[var(--shadow-sm)]">
            <button
              onClick={() => setActiveTab("usuarios")}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                activeTab === "usuarios"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text)]"
              }`}
            >
              <Users size={14} />
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                activeTab === "roles"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text)]"
              }`}
            >
              <Shield size={14} />
              Roles
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "usuarios" ? (
          <UsuariosTable
            initialUsers={initialUsers}
            roles={roles}
            userPermissions={userPermissions}
            onCreateUser={onCreateUser}
            onUpdateUser={onUpdateUser}
            onToggleEstado={onToggleEstado}
            onSearch={onSearch}
            onUploadPhoto={onUploadPhoto}
            onDeletePhoto={onDeletePhoto}
          />
        ) : (
          <RolesTable
            roles={currentRoles}
            onCreateRole={onCreateRole}
            onUpdateRole={onUpdateRole}
            onToggleEstado={onToggleRoleEstado}
            onRefresh={handleRefreshRoles}
            externalCreateModalOpen={roleCreateModalOpen}
            onExternalCreateModalClose={() => setRoleCreateModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
