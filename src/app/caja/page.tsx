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
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <Coins size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Control de Caja
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                Monitoree los ingresos, registre egresos manuales de gastos y realice arqueos y cierres diarios y mensuales.
              </p>
            </div>
          </div>
        </div>

        {/* Terminal Operativo de Caja (Client Component) */}
        <CajaTerminal
          cajaActiva={cajaActiva as any}
          historialCajas={historialCajas as any}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
