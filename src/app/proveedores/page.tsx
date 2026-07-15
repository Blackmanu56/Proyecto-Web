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
            No tiene permisos de Encargado de Stock para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Load initial data on the server
  const proveedores = await getProveedores("", false); // Get all suppliers including inactive

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2 shrink-0 mb-1">
          <div className="p-1.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <Truck size={16} />
          </div>
          <h1 className="text-base lg:text-lg font-extrabold text-[var(--text)] tracking-tight">
            Gestión de Proveedores
          </h1>
        </div>

        {/* Tabla Interactiva */}
        <div className="flex-1 min-h-0">
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
    </div>
  );
}
