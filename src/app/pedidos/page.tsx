import React from "react";
import { getSession } from "@/lib/auth.server";
import { getProductos } from "@/actions/productos";
import { getProveedores } from "@/actions/auxiliares";
import { getSolicitudesReposicion } from "@/actions/reposiciones";
import PedidosTable from "@/components/tables/PedidosTable";
import { ClipboardList } from "lucide-react";

export default async function PedidosPage() {
  const session = await getSession();

  const userRole = session?.role || "ENCARGADO_STOCK";

  const allowedRoles = ["ADMINISTRADOR", "ENCARGADO_STOCK"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex-1 bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[var(--danger)] text-lg font-semibold">Acceso Denegado</p>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            No tiene permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  const [productos, proveedores, solicitudesResult] = await Promise.all([
    getProductos(),
    getProveedores(),
    getSolicitudesReposicion(
      userRole !== "ADMINISTRADOR" && session?.userId
        ? { solicitanteId: session.userId }
        : {}
    ),
  ]);

  const solicitudes =
    solicitudesResult.success && "solicitudes" in solicitudesResult
      ? (solicitudesResult as { success: true; solicitudes: React.ComponentProps<typeof PedidosTable>["solicitudes"] }).solicitudes
      : [];

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <ClipboardList size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Pedidos
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Gestión de necesidades de reposición de stock
          </p>
        </div>

        {/* Tabla */}
        <div className="flex-1 min-h-0">
          <PedidosTable
            initialProducts={productos as React.ComponentProps<typeof PedidosTable>["initialProducts"]}
            proveedores={proveedores as React.ComponentProps<typeof PedidosTable>["proveedores"]}
            userRole={userRole}
            solicitudes={solicitudes as React.ComponentProps<typeof PedidosTable>["solicitudes"]}
            userId={session?.userId ?? 0}
            canApprove={userRole === "ADMINISTRADOR"}
          />
        </div>
      </div>
    </div>
  );
}
