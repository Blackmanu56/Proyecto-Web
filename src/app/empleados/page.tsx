import { createRole, getRolesCompletos, toggleRoleEstado, updateRole } from "@/actions/roles";
import { actualizarUsuario, crearUsuario, getRoles, getUsuarios, toggleEstadoUsuario } from "@/actions/usuarios";
import { subirFotoPerfil, eliminarFotoPerfil } from "@/actions/foto-perfil";
import { getSession } from "@/lib/auth.server";
import { parseRoleData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Server action wrappers that the client component can call
async function searchUsuarios(query: string, soloActivos: boolean) {
  "use server";
  return await getUsuarios(query, soloActivos);
}

async function createUsuario(formData: FormData): Promise<{ success?: boolean; error?: string; id?: number }> {
  "use server";
  return await crearUsuario(formData);
}

async function updateUsuario(id: number, formData: FormData) {
  "use server";
  return await actualizarUsuario(id, formData);
}

async function toggleUsuario(id: number) {
  "use server";
  return await toggleEstadoUsuario(id);
}

async function uploadUserPhoto(
  userId: number,
  formData: FormData
): Promise<{ success?: boolean; fotoUrl?: string; error?: string }> {
  "use server";
  return await subirFotoPerfil(userId, formData);
}

async function deleteUserPhoto(userId: number): Promise<{ success?: boolean; error?: string }> {
  "use server";
  return await eliminarFotoPerfil(userId);
}

// Role server action wrappers
async function refreshRoles() {
  "use server";
  return await getRolesCompletos();
}

async function handleCreateRole(data: { nombre: string; descripcion: string; permisos: string[] }) {
  "use server";
  return await createRole(data);
}

async function handleUpdateRole(id: number, data: { nombre: string; descripcion: string; permisos: string[] }) {
  "use server";
  return await updateRole(id, data);
}

async function handleToggleRoleEstado(id: number) {
  "use server";
  return await toggleRoleEstado(id);
}

// Client wrapper to handle tabs
import EmpleadosTabs from "./EmpleadosTabs";

export default async function EmpleadosPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  if (userRole !== "ADMINISTRADOR") {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Acceso Denegado</p>
          <p className="text-slate-500 text-sm mt-2">
            No tiene permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Fetch fresh permissions from DB (not from JWT which may be stale)
  const userRecord = await prisma.usuario.findUnique({
    where: { id: session!.userId },
    include: { rol: true },
  });
  const roleData = parseRoleData(userRecord?.rol?.permisos ?? null);
  const userPermissions = roleData.permisos;

  const [usuarios, roles, rolesCompletos] = await Promise.all([
    getUsuarios("", false),
    getRoles(),
    getRolesCompletos(),
  ]);

  return (
    <div className="module-shell bg-[var(--bg)]">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        <EmpleadosTabs
          initialUsers={usuarios as React.ComponentProps<typeof EmpleadosTabs>["initialUsers"]}
          roles={roles}
          rolesCompletos={rolesCompletos}
          userPermissions={userPermissions}
          onCreateUser={createUsuario}
          onUpdateUser={updateUsuario}
          onToggleEstado={toggleUsuario}
          onSearch={searchUsuarios}
          onUploadPhoto={uploadUserPhoto}
          onDeletePhoto={deleteUserPhoto}
          onCreateRole={handleCreateRole}
          onUpdateRole={handleUpdateRole}
          onToggleRoleEstado={handleToggleRoleEstado}
          onRefreshRoles={refreshRoles}
        />
      </div>
    </div>
  );
}
