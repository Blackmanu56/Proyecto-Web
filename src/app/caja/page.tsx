import React from "react";
import { getSession } from "@/lib/auth.server";
import { getCajaActiva, getHistorialCajas } from "@/actions/caja";
import CajaTerminal from "@/components/forms/CajaTerminal";
import { Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function CajaPage() {
  const session = await getSession();
  const userRole = session?.role || "ENCARGADO_VENTAS";

  let currentUser = null;
  if (session?.userId) {
    currentUser = await prisma.usuario.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        nombreCompleto: true,
        fotoUrl: true,
        rol: { select: { id: true, nombre: true } },
      },
    });
  }

  const [cajaActiva, historialCajas] = await Promise.all([
    getCajaActiva(),
    getHistorialCajas(),
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <Coins size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Control de Caja
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Gestión y seguimiento de la caja registradora
          </p>
        </div>

        {/* Terminal Operativo de Caja (Client Component) */}
        <div className="flex-1 min-h-0">
          <CajaTerminal
            cajaActiva={cajaActiva as React.ComponentProps<typeof CajaTerminal>["cajaActiva"]}
            historialCajas={historialCajas as React.ComponentProps<typeof CajaTerminal>["historialCajas"]}
            userRole={userRole}
            user={currentUser as React.ComponentProps<typeof CajaTerminal>["user"]}
          />
        </div>
      </div>
    </div>
  );
}
