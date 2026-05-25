import React from "react";
import { getSession } from "@/lib/auth.server";
import { getUsuarios, getRoles, crearUsuario, actualizarUsuario, toggleEstadoUsuario } from "@/actions/usuarios";
import UsuariosTable from "@/components/tables/UsuariosTable";
import { Users } from "lucide-react";

// Server action wrappers that the client component can call
async function searchUsuarios(query: string, soloActivos: boolean) {
  "use server";
  return await getUsuarios(query, soloActivos);
}

async function createUsuario(formData: FormData) {
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

export default async function EmpleadosPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Only ADMINISTRADOR can access this page (enforced in middleware too)
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

  // Load data on the server
  const [usuarios, roles] = await Promise.all([
    getUsuarios("", false), // Get all users including inactive
    getRoles(),
  ]);

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <Users size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Gestión de Usuarios
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                Administre usuarios, roles y permisos del sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Users Table (Client Component) */}
        <UsuariosTable
          initialUsers={usuarios as any}
          roles={roles}
          onCreateUser={createUsuario}
          onUpdateUser={updateUsuario}
          onToggleEstado={toggleUsuario}
          onSearch={searchUsuarios}
        />
      </div>
    </div>
  );
}
