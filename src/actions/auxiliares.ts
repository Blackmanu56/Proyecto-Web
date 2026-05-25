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
