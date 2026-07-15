import React from "react";
import { getSession } from "@/lib/auth.server";
import { getClientes } from "@/actions/clientes";
import ClientesTable from "@/components/tables/ClientesTable";
import { Users } from "lucide-react";

export default async function ClientesPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Enforce role authorization (ADMINISTRADOR or ENCARGADO_VENTAS)
  const allowedRoles = ["ADMINISTRADOR", "ENCARGADO_VENTAS"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Acceso Denegado</p>
          <p className="text-slate-500 text-sm mt-2">
            No tiene permisos para acceder a la gestión de clientes.
          </p>
        </div>
      </div>
    );
  }

  // Carga inicial de datos desde el servidor (cargando tanto activos como inactivos)
  const clientes = await getClientes("", false);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2 shrink-0 mb-1">
          <div className="p-1.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <Users size={16} />
          </div>
          <h1 className="text-base lg:text-lg font-extrabold text-[var(--text)] tracking-tight">
            Gestión de Clientes
          </h1>
        </div>

        {/* Tabla Interactiva */}
        <div className="flex-1 min-h-0">
          <ClientesTable initialClientes={clientes} userRole={userRole} />
        </div>
      </div>
    </div>
  );
}
