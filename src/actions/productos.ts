"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { saveFile, deleteFile } from "@/lib/upload";

const productoSchema = z.object({
  nombre: z.string().min(2, "El nombre del producto debe tener al menos 2 caracteres"),
  marca: z.string().optional().nullable(),
  codigo: z.string().optional().nullable(),
  imagen: z.string().optional().nullable(),
  categoriaId: z.number().int().positive("Seleccione una categoría válida"),
  proveedorId: z.number().int().positive("Seleccione un proveedor válido"),
  precioCompra: z.number().positive("El precio de compra debe ser mayor a 0"),
  precioVenta: z.number().positive("El precio de venta debe ser mayor a 0"),
  cantidad: z.number().int().nonnegative("La cantidad no puede ser negativa"),
  stockMinimo: z.number().int().nonnegative("El stock mínimo no puede ser negativo"),
});

/**
 * Obtener todos los productos con filtros de búsqueda y paginación
 */
export async function getProductos(
  query: string = "",
  categoriaId?: number,
  activo?: boolean
) {
  try {
    const whereClause: any = {};

    if (activo !== undefined) {
      whereClause.activo = activo;
    }

    if (query) {
      whereClause.OR = [
        { nombre: { contains: query, mode: "insensitive" } },
        { marca: { contains: query, mode: "insensitive" } },
        { codigo: { contains: query, mode: "insensitive" } },
        { categoria: { nombre: { contains: query, mode: "insensitive" } } },
        { proveedor: { nombre: { contains: query, mode: "insensitive" } } },
      ];
    }

    if (categoriaId && categoriaId > 0) {
      whereClause.categoriaId = categoriaId;
    }

    return await prisma.producto.findMany({
      where: whereClause,
      include: {
        categoria: true,
        proveedor: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });
  } catch (error) {
    console.error("Error en getProductos:", error);
    return [];
  }
}

/**
 * Crear un nuevo producto en el catálogo
 */
export async function createProducto(formData: FormData) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  const rawData = {
    nombre: formData.get("nombre") as string,
    marca: formData.get("marca") as string || null,
    codigo: formData.get("codigo") as string || null,
    imagen: formData.get("imagen") as string || null,
    categoriaId: Number(formData.get("categoriaId")),
    proveedorId: Number(formData.get("proveedorId")),
    precioCompra: Number(formData.get("precioCompra")),
    precioVenta: Number(formData.get("precioVenta")),
    cantidad: Number(formData.get("cantidad")),
    stockMinimo: Number(formData.get("stockMinimo")),
  };

  // Handle file upload if present
  const file = formData.get("imagenFile") as File | null;
  if (file && file.size > 0) {
    const imageUrl = await saveFile(file);
    rawData.imagen = imageUrl;
  }

  const validation = productoSchema.safeParse(rawData);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  try {
    const producto = await prisma.$transaction(async (tx) => {
      // 1. Crear producto
      const p = await tx.producto.create({
        data: {
          nombre: validation.data.nombre,
          marca: validation.data.marca,
          codigo: validation.data.codigo,
          imagen: validation.data.imagen,
          categoriaId: validation.data.categoriaId,
          proveedorId: validation.data.proveedorId,
          precioCompra: validation.data.precioCompra,
          precioVenta: validation.data.precioVenta,
          cantidad: validation.data.cantidad,
          stockMinimo: validation.data.stockMinimo,
          activo: true,
        },
      });

      // 2. Si se inicializa con stock > 0, registrar compra contable y egreso de caja
      if (validation.data.cantidad > 0) {
        const totalCosto = validation.data.cantidad * validation.data.precioCompra;

        // Buscar caja abierta (opcional: si no hay caja, se crea el producto sin movimiento financiero)
        const cajaAbierta = await tx.caja.findFirst({
          where: { estado: "ABIERTA" },
        });

        if (cajaAbierta) {
          // Crear registro de Compra
          const compra = await tx.compra.create({
            data: {
              proveedorId: validation.data.proveedorId,
              usuarioId: session.userId,
              total: totalCosto,
              detalles: {
                create: {
                  productoId: p.id,
                  cantidad: validation.data.cantidad,
                  costoUnitario: validation.data.precioCompra,
                  subtotal: totalCosto,
                },
              },
            },
          });

          // Registrar egreso en Caja
          await tx.movimientoCaja.create({
            data: {
              cajaId: cajaAbierta.id,
              usuarioId: session.userId,
              compraId: compra.id,
              tipo: "EGRESO",
              monto: totalCosto,
              descripcion: `Stock inicial de '${validation.data.nombre}' x${validation.data.cantidad}`,
            },
          });

          // Actualizar totales de la Caja
          await tx.caja.update({
            where: { id: cajaAbierta.id },
            data: {
              totalVentas: {
                decrement: totalCosto, // Los egresos reducen el balance acumulado
              },
            },
          });
        }
        // Si no hay caja abierta, se crea el producto sin registrar movimiento financiero
      }

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto };
  } catch (error: any) {
    console.error("Error en createProducto:", error);
    return { error: error.message || "Error al agregar el producto" };
  }
}

/**
 * Modificar un producto y registrar reposiciones automáticas
 */
export async function updateProducto(id: number, formData: FormData) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  const rawData = {
    nombre: formData.get("nombre") as string,
    marca: formData.get("marca") as string || null,
    codigo: formData.get("codigo") as string || null,
    imagen: formData.get("imagen") as string || null,
    categoriaId: Number(formData.get("categoriaId")),
    proveedorId: Number(formData.get("proveedorId")),
    precioCompra: Number(formData.get("precioCompra")),
    precioVenta: Number(formData.get("precioVenta")),
    cantidad: Number(formData.get("cantidad")),
    stockMinimo: Number(formData.get("stockMinimo")),
  };

  // Handle file upload if present
  const file = formData.get("imagenFile") as File | null;
  if (file && file.size > 0) {
    // Delete old image if exists
    if (rawData.imagen) {
      await deleteFile(rawData.imagen);
    }
    const imageUrl = await saveFile(file);
    rawData.imagen = imageUrl;
  }

  const validation = productoSchema.safeParse(rawData);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener producto antes de la modificación
      const productoPrevio = await tx.producto.findUnique({
        where: { id },
      });

      if (!productoPrevio) {
        throw new Error("Producto no encontrado");
      }

      const nuevoStock = validation.data.cantidad;
      const stockAnterior = productoPrevio.cantidad;

      // 1. Modificar producto en BD
      const p = await tx.producto.update({
        where: { id },
        data: {
          nombre: validation.data.nombre,
          marca: validation.data.marca,
          codigo: validation.data.codigo,
          imagen: validation.data.imagen,
          categoriaId: validation.data.categoriaId,
          proveedorId: validation.data.proveedorId,
          precioCompra: validation.data.precioCompra,
          precioVenta: validation.data.precioVenta,
          cantidad: nuevoStock,
          stockMinimo: validation.data.stockMinimo,
        },
      });

      // 2. Si el stock subió, es un reabastecimiento (Compra a proveedor)
      if (nuevoStock > stockAnterior) {
        const diferencia = nuevoStock - stockAnterior;
        const totalCosto = diferencia * validation.data.precioCompra;

        // Registrar la Compra (siempre, independientemente de la caja)
        const compra = await tx.compra.create({
          data: {
            proveedorId: validation.data.proveedorId,
            usuarioId: session.userId,
            total: totalCosto,
            detalles: {
              create: {
                productoId: id,
                cantidad: diferencia,
                costoUnitario: validation.data.precioCompra,
                subtotal: totalCosto,
              },
            },
          },
        });

        // Registrar egreso en la Caja solo si hay una caja abierta
        const cajaAbierta = await tx.caja.findFirst({
          where: { estado: "ABIERTA" },
        });

        if (cajaAbierta) {
          await tx.movimientoCaja.create({
            data: {
              cajaId: cajaAbierta.id,
              usuarioId: session.userId,
              compraId: compra.id,
              tipo: "EGRESO",
              monto: totalCosto,
              descripcion: `Reposición de '${validation.data.nombre}' x${diferencia}`,
            },
          });

          await tx.caja.update({
            where: { id: cajaAbierta.id },
            data: {
              totalVentas: {
                decrement: totalCosto,
              },
            },
          });
        }
      }

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto: result };
  } catch (error: any) {
    console.error("Error en updateProducto:", error);
    return { error: error.message || "Error al actualizar el producto" };
  }
}

/**
 * Desactivar lógicamente un producto (soft-delete)
 */
export async function deleteProducto(id: number) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  try {
    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });

    revalidatePath("/productos");
    return { success: true };
  } catch (error: any) {
    console.error("Error en deleteProducto:", error);
    return { error: error.message || "Error al eliminar el producto" };
  }
}

/**
 * Reactivar lógicamente un producto desactivado
 */
export async function reactivarProducto(id: number) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(session.role)) {
    throw new Error("No tiene permisos para reactivar productos.");
  }

  try {
    await prisma.producto.update({
      where: { id },
      data: { activo: true },
    });

    revalidatePath("/productos");
    return { success: true };
  } catch (error: any) {
    console.error("Error en reactivarProducto:", error);
    return { error: error.message || "Error al reactivar el producto" };
  }
}
