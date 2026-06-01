"use server";

import { prisma } from "@/lib/prisma";

/**
 * Obtener listado de categorías para comboboxes
 */
export async function getCategorias() {
  try {
    return await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getCategorias:", error);
    return [];
  }
}

/**
 * Obtener listado de proveedores para comboboxes
 */
export async function getProveedores() {
  try {
    return await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getProveedores:", error);
    return [];
  }
}

/**
 * Obtener listado de clientes activos para dropdowns de filtros
 */
export async function getClientesDistinct() {
  try {
    return await prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, dni: true },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getClientesDistinct:", error);
    return [];
  }
}

/**
 * Obtener métodos de pago distintos desde ventas para dropdowns de filtros
 */
export async function getMetodosPago() {
  try {
    const result = await prisma.venta.groupBy({
      by: ["metodoPago"],
      _count: { id: true },
      _sum: { total: true },
    });
    return result
      .filter((r) => r.metodoPago)
      .map((r) => ({
        metodo: r.metodoPago,
        count: r._count.id,
        total: r._sum.total || 0,
      }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("Error en getMetodosPago:", error);
    return [];
  }
}
