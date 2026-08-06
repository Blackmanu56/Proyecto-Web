import React from "react";
import { getSession } from "@/lib/auth.server";
import { hasPermission } from "@/lib/auth-permissions";
import { getDashboardData } from "@/actions/informes";
import DashboardClient from "@/components/layout/DashboardClient";

function getFormattedDate(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("es-AR", { weekday: "long" });
  const day = now.toLocaleDateString("es-AR", { day: "numeric" });
  const month = now.toLocaleDateString("es-AR", { month: "long" });
  const year = now.toLocaleDateString("es-AR", { year: "numeric" });
  // Capitalize first letter of weekday and month
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalizedWeekday}, ${day} de ${capitalizedMonth} de ${year}`;
}

export default async function DashboardPage() {
  const session = await getSession();

  const dashboardData = await getDashboardData();
  const formattedDate = getFormattedDate();
  const canAccessCaja = await hasPermission("caja.ver", session);

  return (
    <div className="flex-1 bg-[var(--bg)] px-5 py-2">
      <div className="w-full">
        <DashboardClient
          data={dashboardData}
          userName={session?.username ?? "Usuario"}
          role={session?.role ?? "ADMINISTRADOR"}
          formattedDate={formattedDate}
          canAccessCaja={canAccessCaja}
        />
      </div>
    </div>
  );
}
