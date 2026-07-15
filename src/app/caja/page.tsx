import React from "react";
import { getSession } from "@/lib/auth.server";
import { getCajaActiva, getHistorialCajas } from "@/actions/caja";
import CajaTerminal from "@/components/forms/CajaTerminal";
import { Coins } from "lucide-react";

export default async function CajaPage() {
  const session = await getSession();
  const userRole = session?.role || "ENCARGADO_VENTAS";

  // Carga de datos contables del servidor
  const [cajaActiva, historialCajas] = await Promise.all([
    getCajaActiva(),
    getHistorialCajas(),
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2.5 shrink-0 mb-1">
          <div className="p-1.5 bg-[var(--brand)]/10 rounded-lg text-[var(--brand)]">
            <Coins size={18} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg lg:text-xl font-black text-[var(--text)] tracking-tight uppercase">
            Control de Caja
          </h1>
        </div>

        {/* Terminal Operativo de Caja (Client Component) */}
        <div className="flex-1 min-h-0">
          <CajaTerminal
            cajaActiva={cajaActiva as any}
            historialCajas={historialCajas as any}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  );
}
