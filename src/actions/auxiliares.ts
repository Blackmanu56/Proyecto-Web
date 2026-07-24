"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";
import { getErrorMessage } from "@/lib/error-message";

/**
 * Obtener listado de categorías activas para comboboxes
 */
export async function getCategorias() {
  try {
    return await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getCategorias:", error);
    return [];
  }
}

/**
 * Crear una nueva categoría (si ya existe con el mismo nombre, retorna la existente)
 */
export async function createCategoria(nombre: string) {
  await requirePermission("productos.categorias");
  try {
    const existing = await prisma.categoria.findFirst({ where: { nombre } });
    if (existing) return existing;
    const cat = await prisma.categoria.create({ data: { nombre } });
    return cat;
  } catch (error) {
    console.error("Error en createCategoria:", error);
    throw new Error("Error al crear la categoría");
  }
}

/**
 * Eliminar una categoría (solo si no tiene productos asociados)
 */
export async function deleteCategoria(id: number) {
  await requirePermission("productos.categorias");
  try {
    const products = await prisma.producto.count({ where: { categoriaId: id } });
    if (products > 0) {
      throw new Error("No se puede eliminar: hay " + products + " productos en esta categoría.");
    }
    await prisma.categoria.delete({ where: { id } });
    revalidatePath("/productos");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
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
 * Obtener categorías con conteo de productos asociados
 */
export async function getCategoriasWithCount() {
  try {
    return await prisma.categoria.findMany({
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getCategoriasWithCount:", error);
    return [];
  }
}

/**
 * Actualizar nombre de una categoría
 */
export async function updateCategoria(id: number, nombre: string) {
  await requirePermission("productos.categorias");
  try {
    const existing = await prisma.categoria.findFirst({ where: { nombre, id: { not: id } } });
    if (existing) throw new Error("Ya existe una categoría con ese nombre.");
    const cat = await prisma.categoria.update({ where: { id }, data: { nombre } });
    revalidatePath("/productos");
    return cat;
  } catch (error: unknown) {
    if (getErrorMessage(error).includes("Ya existe")) throw error;
    throw new Error("Error al actualizar la categoría");
  }
}

/**
 * Cambiar estado activo/inactivo de una categoría
 */
export async function toggleCategoriaActivo(id: number, activo: boolean) {
  await requirePermission("productos.categorias");
  try {
    const cat = await prisma.categoria.update({ where: { id }, data: { activo } });
    revalidatePath("/productos");
    return cat;
  } catch {
    throw new Error("Error al cambiar estado de la categoría");
  }
}

/**
 * Obtener marcas activas para comboboxes
 */
export async function getMarcasActivas() {
  try {
    return await prisma.marca.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getMarcasActivas:", error);
    return [];
  }
}

/**
 * Obtener marcas con conteo de productos asociados
 */
export async function getMarcasWithCount() {
  try {
    return await prisma.marca.findMany({
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error en getMarcasWithCount:", error);
    return [];
  }
}

/**
 * Crear una nueva marca
 */
export async function createMarca(nombre: string) {
  await requirePermission("productos.marcas");
  try {
    const existing = await prisma.marca.findFirst({ where: { nombre } });
    if (existing) throw new Error("Ya existe una marca con ese nombre.");
    const marca = await prisma.marca.create({ data: { nombre } });
    return marca;
  } catch (error: unknown) {
    if (getErrorMessage(error).includes("Ya existe")) throw error;
    throw new Error("Error al crear la marca");
  }
}

/**
 * Actualizar nombre de una marca
 */
export async function updateMarca(id: number, nombre: string) {
  await requirePermission("productos.marcas");
  try {
    const existing = await prisma.marca.findFirst({ where: { nombre, id: { not: id } } });
    if (existing) throw new Error("Ya existe una marca con ese nombre.");
    const marca = await prisma.marca.update({ where: { id }, data: { nombre } });
    revalidatePath("/productos");
    return marca;
  } catch (error: unknown) {
    if (getErrorMessage(error).includes("Ya existe")) throw error;
    throw new Error("Error al actualizar la marca");
  }
}

/**
 * Cambiar estado activo/inactivo de una marca
 */
export async function toggleMarcaActivo(id: number, activo: boolean) {
  await requirePermission("productos.marcas");
  try {
    const marca = await prisma.marca.update({ where: { id }, data: { activo } });
    revalidatePath("/productos");
    return marca;
  } catch {
    throw new Error("Error al cambiar estado de la marca");
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
