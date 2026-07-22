import React from "react";
import { getSession } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import VentasTerminal from "@/components/forms/VentasTerminal";
import { ShoppingCart } from "lucide-react";

export default async function VentasPage() {
  const session = await getSession();

  // Carga de datos del servidor
  const [productos, clientes, usuario, favoritos, ventasPorProducto] = await Promise.all([
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
    // Favoritos del usuario actual
    session ? prisma.productoFavorito.findMany({
      where: { usuarioId: session.userId },
      select: { productoId: true },
    }) : [],
    // Cantidad de veces que cada producto fue vendido (agregado desde detalle_ventas)
    prisma.detalleVenta.groupBy({
      by: ["productoId"],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: "desc" } },
    }),
  ]);

  // Set de IDs de favoritos para lookup rápido (serializado como array para client component)
  const favoritoIds = favoritos.map(f => f.productoId);

  // Mapa productoId -> cantidad total vendida
  const ventasMap = new Map<number, number>();
  for (const v of ventasPorProducto) {
    ventasMap.set(v.productoId, v._sum.cantidad ?? 0);
  }

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2 shrink-0 mb-1">
          <div className="p-2 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <ShoppingCart size={20} />
          </div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text)] tracking-tight">
            Terminal de Ventas
          </h1>
        </div>

        {/* Terminal Interactivo (Client Component) */}
        <div className="flex-1 min-h-0">
          <VentasTerminal
            productos={productos as any}
            clientes={clientes as any}
            usuario={usuario}
            favoritoIds={favoritoIds}
            ventasPorProducto={Object.fromEntries(ventasMap)}
          />
        </div>
      </div>
    </div>
  );
}
