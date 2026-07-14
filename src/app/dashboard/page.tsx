import React from "react";
import { getSession } from "@/lib/auth.server";
import { getDashboardData } from "@/actions/informes";
import DashboardClient from "@/components/layout/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();

  // Carga de datos contables y analíticos del servidor
  const dashboardData = await getDashboardData();

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Resumen de ventas, caja y stock.
          </p>
        </div>

        {/* Dashboard Interactivo con Recharts (Client Component) */}
        <DashboardClient data={dashboardData} />
      </div>
    </div>
  );
}
