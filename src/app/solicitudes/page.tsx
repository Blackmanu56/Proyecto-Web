import React from "react";
import { getSession } from "@/lib/auth.server";
import { getSolicitudesReposicion } from "@/actions/reposiciones";
import SolicitudesTable from "@/components/tables/SolicitudesTable";
import { ClipboardList } from "lucide-react";

export default async function SolicitudesPage() {
  const session = await getSession();

  if (session?.role !== "ADMINISTRADOR") {
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

  const result = await getSolicitudesReposicion();
  const solicitudes = result.success && "solicitudes" in result ? result.solicitudes : [];

  return (
    <div className="flex-1 bg-[var(--bg)] p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#047857]/10 text-[#059669]">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--text)] tracking-tight">
              Solicitudes de Reposición
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Aprobar o rechazar solicitudes de reposición de stock.
            </p>
          </div>
        </div>

        <SolicitudesTable solicitudes={solicitudes} />
      </div>
    </div>
  );
}
