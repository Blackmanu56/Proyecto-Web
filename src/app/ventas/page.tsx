import React from "react";
import { getSession } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import VentasTerminal from "@/components/forms/VentasTerminal";
import { ShoppingCart } from "lucide-react";

export default async function VentasPage() {
  const session = await getSession();

  // Carga de datos del servidor
  const [productos, clientes, usuario] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
    session ? prisma.usuario.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, nombreCompleto: true },
    }) : null,
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2 shrink-0 mb-1">
          <div className="p-1.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <ShoppingCart size={16} />
          </div>
          <h1 className="text-base lg:text-lg font-extrabold text-[var(--text)] tracking-tight">
            Terminal de Ventas
          </h1>
        </div>

        {/* Terminal Interactivo (Client Component) */}
        <div className="flex-1 min-h-0">
          <VentasTerminal productos={productos as any} clientes={clientes as any} usuario={usuario} />
        </div>
      </div>
    </div>
  );
}
