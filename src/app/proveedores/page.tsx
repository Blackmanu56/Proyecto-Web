import React from "react";
import { getSession } from "@/lib/auth.server";
import {
  getProveedores,
  crearProveedor,
  actualizarProveedor,
  toggleEstadoProveedor,
  eliminarProveedorReal,
  getHistorialAbastecimiento,
  getProveedorProductos,
} from "@/actions/proveedores";
import ProveedoresTable from "@/components/tables/ProveedoresTable";
import { Truck } from "lucide-react";

// Server action wrappers for the client component
async function searchProveedores(query: string, soloActivos: boolean) {
  "use server";
  return await getProveedores(query, soloActivos);
}

async function createProveedor(formData: FormData) {
  "use server";
  return await crearProveedor(formData);
}

async function updateProveedor(id: number, formData: FormData) {
  "use server";
  return await actualizarProveedor(id, formData);
}

async function toggleProveedor(id: number) {
  "use server";
  return await toggleEstadoProveedor(id);
}

async function deleteProveedor(id: number) {
  "use server";
  return await eliminarProveedorReal(id);
}

async function getProductos(id: number) {
  "use server";
  return await getProveedorProductos(id);
}

async function getHistorial(id: number) {
  "use server";
  return await getHistorialAbastecimiento(id);
}

export default async function ProveedoresPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Enforce role authorization (ADMINISTRADOR or ENCARGADO_STOCK)
  const allowedRoles = ["ADMINISTRADOR", "ENCARGADO_STOCK"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Acceso Denegado</p>
          <p className="text-slate-500 text-sm mt-2">
            No tiene permisos de Encargado de Stock para acceder a esta secci├│n.
          </p>
        </div>
      </div>
    );
  }

  // Load initial data on the server
  const proveedores = await getProveedores("", false); // Get all suppliers including inactive

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <Truck size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Gesti├│n de Proveedores
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                Administre los proveedores, consulte su cat├ílogo de productos y el historial de compras.
              </p>
            </div>
          </div>
        </div>

        {/* Proveedores Table (Client Component) */}
        <ProveedoresTable
          initialProveedores={proveedores as any}
          onCreateProveedor={createProveedor}
          onUpdateProveedor={updateProveedor}
          onToggleEstado={toggleProveedor}
          onEliminarReal={deleteProveedor}
          onSearch={searchProveedores}
          onGetProductos={getProductos}
          onGetHistorial={getHistorial}
        />
      </div>
    </div>
  );
}
