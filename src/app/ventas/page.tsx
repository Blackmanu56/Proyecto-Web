import React from "react";
import { getSession } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import VentasTerminal from "@/components/forms/VentasTerminal";
import { ShoppingCart } from "lucide-react";

export default async function VentasPage() {
  const session = await getSession();

  // Carga de datos del servidor
  const [productos, clientes] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/10">
              <ShoppingCart size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Terminal de Ventas
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                Registre facturas de ventas, controle el stock en tiempo real y emita tickets de cobro.
              </p>
            </div>
          </div>
        </div>

        {/* Terminal Interactivo (Client Component) */}
        <VentasTerminal productos={productos as any} clientes={clientes} />
      </div>
    </div>
  );
}
