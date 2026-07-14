import React from "react";
import { getSession } from "@/lib/auth.server";
import { getClientes } from "@/actions/clientes";
import ClientesTable from "@/components/tables/ClientesTable";

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
    <div className="flex-1 bg p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <ClientesTable initialClientes={clientes} userRole={userRole} />
      </div>
    </div>
  );
}
