import React from "react";
import { getSession } from "@/lib/auth.server";
import { getDashboardData } from "@/actions/informes";
import DashboardClient from "@/components/layout/DashboardClient";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();

  // Carga de datos contables y analíticos del servidor
  const dashboardData = await getDashboardData();

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <LayoutDashboard size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Panel de Control (Dashboard)
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                SGI-Repuestos: Resumen en vivo de ventas del día, saldo en caja, alertas y proyecciones automáticas de stock.
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Interactivo con Recharts (Client Component) */}
        <DashboardClient data={dashboardData} />
      </div>
    </div>
  );
}
