import React from "react";
import { getSession } from "@/lib/auth.server";
import { getSolicitudesUnificadas } from "@/actions/solicitudes";
import SolicitudesTable from "@/components/tables/SolicitudesTable";
import { FileCheck } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    filter?: string;
  }>;
}

const ALLOWED_ROLES = ["ADMINISTRADOR", "ENCARGADO_STOCK", "ENCARGADO_VENTAS"];

export const dynamic = "force-dynamic";

export default async function SolicitudesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const params = await searchParams;
  const userRole = session?.role;
  const userId = session?.userId;

  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className="flex-1 bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[var(--danger)] text-lg font-semibold">
            Acceso Denegado
          </p>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            No tiene permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  const result = await getSolicitudesUnificadas(userRole, userId);

  const solicitudes =
    result && "data" in result ? result.data ?? [] : [];

  const initialFilter = params.filter;

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <FileCheck size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Solicitudes
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Gestión unificada de solicitudes de stock y caja
          </p>
        </div>

        {/* Tabla */}
        <div className="flex-1 min-h-0">
          <React.Suspense fallback={null}>
            <SolicitudesTable
              solicitudes={solicitudes}
              userRole={userRole}
              userId={session?.userId ?? 0}
              initialFilter={initialFilter}
            />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
