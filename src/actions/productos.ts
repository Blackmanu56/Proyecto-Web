"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { saveFile, deleteFile } from "@/lib/upload";
import { MotivoEstadoProducto, Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth-permissions";
import {
  ProductoBusinessError,
  ejecutarReposicionEscrituras,
  failBusiness,
  pagoSchema,
  validarReposicion,
} from "@/lib/reposicion";

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
  origenPago: z
    .enum(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA", "CUENTA_CORRIENTE_PROVEEDOR", "FONDOS_EXTERNOS"])
    .default("EFECTIVO_CAJA"),
  pagos: z.array(pagoSchema).optional(),
});

/**
 * Esquema de edición pura (D4): sin cantidad/pagos/origenPago.
 * La reposición de stock pasa por SolicitudReposicion, no por updateProducto.
 */
const productoEditSchema = z.object({
  nombre: z.string().min(2, "El nombre del producto debe tener al menos 2 caracteres"),
  marca: z.string().optional().nullable(),
  codigo: z.string().optional().nullable(),
  imagen: z.string().optional().nullable(),
  categoriaId: z.number().int().positive("Seleccione una categoría válida"),
  proveedorId: z.number().int().positive("Seleccione un proveedor válido"),
  precioCompra: z.number().positive("El precio de compra debe ser mayor a 0"),
  precioVenta: z.number().positive("El precio de venta debe ser mayor a 0"),
  stockMinimo: z.number().int().nonnegative("El stock mínimo no puede ser negativo"),
});

const REPOSICION_TECHNICAL_ERROR =
  "No se pudo registrar la reposición. Intentá nuevamente.";

const EXPECTED_PRODUCT_PERMISSION_ERRORS = new Set([
  "No autenticado.",
  "Usuario inactivo o no encontrado.",
  "Rol inactivo o sin permisos vigentes.",
  "No tiene permisos para realizar esta acci?n.",
  "No tiene permisos para realizar esta acción.",
]);

async function requireProductoPermission(permission: string) {
  try {
    return await requirePermission(permission, await getSession());
  } catch (error) {
    if (
      error instanceof Error &&
      EXPECTED_PRODUCT_PERMISSION_ERRORS.has(error.message)
    ) {
      failBusiness(error.message);
    }
    throw error;
  }
}

function productoActionError(error: unknown) {
  return error instanceof ProductoBusinessError
    ? error.message
    : REPOSICION_TECHNICAL_ERROR;
}

/**
 * Obtener todos los productos con filtros de búsqueda y paginación
 */
export async function getProductos(
  query: string = "",
  categoriaId?: number,
  activo?: boolean
) {
  try {
    const whereClause: Prisma.ProductoWhereInput = {};

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
  try {
    const session = await requireProductoPermission("productos.crear");

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
      origenPago: (formData.get("origenPago") as string) || "EFECTIVO_CAJA",
      pagos: formData.get("pagos") ? JSON.parse(formData.get("pagos") as string) : undefined,
    };

    // Handle file upload if present
    const file = formData.get("imagenFile") as File | null;
    if (file && file.size > 0) {
      const imageUrl = await saveFile(file);
      rawData.imagen = imageUrl;
    }

    const validation = productoSchema.safeParse(rawData);
    if (!validation.success) {
      failBusiness(validation.error.errors[0].message);
    }

    const pagos = validation.data.pagos;

    const transactionResult = await prisma.$transaction(async (tx) => {
      // Validaciones financieras (distribución, caja, banco) ANTES del write del producto.
      const reposicionValidada = validation.data.cantidad > 0
        ? await validarReposicion(tx, {
            cantidad: validation.data.cantidad,
            costoUnitario: validation.data.precioCompra,
            origenPago: validation.data.origenPago,
            pagos,
          })
        : null;

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
      let cajaMovimientoCreado = false;
      let bancoMovimientoCreado = false;
      if (validation.data.cantidad > 0 && reposicionValidada) {
        const resultado = await ejecutarReposicionEscrituras(
          tx,
          reposicionValidada,
          {
            productoId: p.id,
            nombreProducto: validation.data.nombre,
            cantidad: validation.data.cantidad,
            costoUnitario: validation.data.precioCompra,
            proveedorId: validation.data.proveedorId,
            origenPago: validation.data.origenPago,
            pagos,
            usuarioId: session.userId,
            descripcionPrefijo: `Stock inicial de '${validation.data.nombre}'`,
          }
        );
        cajaMovimientoCreado = resultado.cajaMovimientoCreado;
        bancoMovimientoCreado = resultado.bancoMovimientoCreado;
      }

      return { producto: p, cajaMovimientoCreado, bancoMovimientoCreado };
    });

    revalidatePath("/productos");
    if (transactionResult.cajaMovimientoCreado || transactionResult.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }
    return { success: true, producto: transactionResult.producto };
  } catch (error: unknown) {
    console.error("Error en createProducto:", error);
    return { error: productoActionError(error) };
  }
}

/**
 * Modificar un producto — edición pura (D4): nunca modifica stock ni
 * genera movimientos financieros. La reposición pasa por SolicitudReposicion.
 */
export async function updateProducto(id: number, formData: FormData) {
  try {
    await requireProductoPermission("productos.editar");

    const rawData = {
      nombre: formData.get("nombre") as string,
      marca: formData.get("marca") as string || null,
      codigo: formData.get("codigo") as string || null,
      imagen: formData.get("imagen") as string || null,
      categoriaId: Number(formData.get("categoriaId")),
      proveedorId: Number(formData.get("proveedorId")),
      precioCompra: Number(formData.get("precioCompra")),
      precioVenta: Number(formData.get("precioVenta")),
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

    const validation = productoEditSchema.safeParse(rawData);
    if (!validation.success) {
      failBusiness(validation.error.errors[0].message);
    }

    const producto = await prisma.$transaction(async (tx) => {
      // Obtener producto antes de la modificación
      const productoPrevio = await tx.producto.findUnique({
        where: { id },
      });

      if (!productoPrevio) {
        failBusiness("Producto no encontrado");
      }

      // 1. Modificar producto en BD — el stock se mantiene (edit-only, D4)
      return tx.producto.update({
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
          cantidad: productoPrevio.cantidad,
          stockMinimo: validation.data.stockMinimo,
        },
      });
    });

    revalidatePath("/productos");
    return { success: true, producto };
  } catch (error: unknown) {
    console.error("Error en updateProducto:", error);
    return { error: productoActionError(error) };
  }
}

/**
 * Dar de baja un producto (soft-delete con historial)
 * - Permite inactivar aunque tenga stock
 * - No modifica el stock
 * - No crea movimientos de inventario
 * - Registra historial de cambio de estado
 */
export async function darBajaProducto(
  id: number,
  motivo: MotivoEstadoProducto,
  observacion?: string
) {
  const session = await requirePermission("productos.estado", await getSession());

  // Validar motivo
  const motivosValidos = Object.values(MotivoEstadoProducto);
  if (!motivosValidos.includes(motivo)) {
    throw new Error("Motivo inválido.");
  }

  // Validar observación obligatoria cuando motivo es OTRO
  if (motivo === "OTRO" && (!observacion || observacion.trim().length === 0)) {
    throw new Error("La observación es obligatoria cuando el motivo es 'Otro'.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener producto actual
      const producto = await tx.producto.findUnique({ where: { id } });
      if (!producto) {
        throw new Error("Producto no encontrado.");
      }
      if (!producto.activo) {
        throw new Error("El producto ya está inactivo.");
      }

      // 2. Registrar historial de cambio de estado
      await tx.historialEstado.create({
        data: {
          productoId: id,
          estadoAnterior: "ACTIVO",
          estadoNuevo: "INACTIVO",
          motivo,
          observacion: observacion?.trim() || null,
          usuarioId: session.userId,
        },
      });

      // 3. Desactivar producto (sin modificar stock)
      const p = await tx.producto.update({
        where: { id },
        data: { activo: false },
      });

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto: result };
  } catch (error: unknown) {
    console.error("Error en darBajaProducto:", error);
    return { error: error instanceof Error ? error.message : "Error al dar de baja el producto" };
  }
}

/**
 * Reactivar un producto inactivo (con historial)
 * - Solo puede reactivar un producto que esté inactivo
 * - Registra historial de cambio de estado
 */
export async function reactivarProducto(id: number, observacion?: string) {
  const session = await requirePermission("productos.estado", await getSession());

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener producto actual
      const producto = await tx.producto.findUnique({ where: { id } });
      if (!producto) {
        throw new Error("Producto no encontrado.");
      }
      if (producto.activo) {
        throw new Error("El producto ya está activo.");
      }

      // 2. Registrar historial de cambio de estado
      await tx.historialEstado.create({
        data: {
          productoId: id,
          estadoAnterior: "INACTIVO",
          estadoNuevo: "ACTIVO",
          motivo: "REACTIVACION",
          observacion: observacion?.trim() || null,
          usuarioId: session.userId,
        },
      });

      // 3. Reactivar producto
      const p = await tx.producto.update({
        where: { id },
        data: { activo: true },
      });

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto: result };
  } catch (error: unknown) {
    console.error("Error en reactivarProducto:", error);
    return { error: error instanceof Error ? error.message : "Error al reactivar el producto" };
  }
}

/**
 * Obtener historial de estados de un producto
 */
export async function getHistorialEstado(productoId: number) {
  try {
    const historial = await prisma.historialEstado.findMany({
      where: { productoId },
      include: {
        usuario: {
          select: { id: true, username: true, nombreCompleto: true },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return historial;
  } catch (error) {
    console.error("Error en getHistorialEstado:", error);
    return [];
  }
}

/**
 * Asignar marcas automáticamente a productos existentes basándose en el nombre.
 * Crea marcas nuevas si no existen.
 */
export async function asignarMarcasAutomaticamente() {
  await requirePermission("productos.marcas", await getSession());

  // Reglas de asignación: marca → palabras clave en el nombre
  const reglas: { marca: string; keywords: string[] }[] = [
    { marca: "Honda", keywords: ["honda", "cg 150", "cg150"] },
    { marca: "Yamaha", keywords: ["yamaha", "fz16", "fz 16"] },
    { marca: "Suzuki", keywords: ["suzuki", "rm500", "rm 500"] },
    { marca: "Bajaj", keywords: ["rouser", "ns200", "ns 200"] },
    { marca: "Pirelli", keywords: ["pirelli"] },
    { marca: "Motul", keywords: ["motul"] },
    { marca: "AGM", keywords: ["agm"] },
  ];

  try {
    const productos = await prisma.producto.findMany({
      where: { marcaId: null },
    });

    let asignados = 0;
    let marcasCreadas = 0;

    for (const producto of productos) {
      const nombreLower = producto.nombre.toLowerCase();

      for (const regla of reglas) {
        const coincide = regla.keywords.some(kw => nombreLower.includes(kw));
        if (coincide) {
          // Buscar o crear la marca
          let marca = await prisma.marca.findFirst({
            where: { nombre: regla.marca },
          });

          if (!marca) {
            marca = await prisma.marca.create({
              data: { nombre: regla.marca, activo: true },
            });
            marcasCreadas++;
          }

          // Asignar marca al producto
          await prisma.producto.update({
            where: { id: producto.id },
            data: {
              marcaId: marca.id,
              marca: marca.nombre,
            },
          });

          asignados++;
          break; // Solo una marca por producto
        }
      }
    }

    revalidatePath("/productos");
    return {
      success: true,
      asignados,
      marcasCreadas,
      total: productos.length,
    };
  } catch (error: unknown) {
    console.error("Error en asignarMarcasAutomaticamente:", error);
    return { error: error instanceof Error ? error.message : "Error al asignar marcas" };
  }
}

/**
 * Restar stock de un producto con auditoría.
 * Registra el movimiento en historial de estados.
 */
export async function restarStock(
  productoId: number,
  cantidad: number,
  motivo: string,
  observacion?: string
) {
  const session = await requirePermission("productos.restar_stock", await getSession());

  if (cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        throw new Error("Producto no encontrado.");
      }

      if (producto.cantidad < cantidad) {
        throw new Error(
          `Stock insuficiente. Stock actual: ${producto.cantidad} unidades.`
        );
      }

      const stockAnterior = producto.cantidad;
      const stockNuevo = stockAnterior - cantidad;

      // Actualizar stock
      await tx.producto.update({
        where: { id: productoId },
        data: { cantidad: stockNuevo },
      });

      // Registrar en historial de estados
      await tx.historialEstado.create({
        data: {
          productoId,
          estadoAnterior: "ACTIVO",
          estadoNuevo: "ACTIVO",
          motivo: "OTRO",
          observacion: `[RESTAR STOCK] Motivo: ${motivo}. Cantidad descontada: ${cantidad}. Stock anterior: ${stockAnterior}. Stock nuevo: ${stockNuevo}${observacion ? `. Observación: ${observacion}` : ""}`,
          usuarioId: session.userId,
        },
      });

      return { producto, stockAnterior, stockNuevo };
    });

    revalidatePath("/productos");
    return {
      success: true,
      stockAnterior: result.stockAnterior,
      stockNuevo: result.stockNuevo,
    };
  } catch (error: unknown) {
    console.error("Error en restarStock:", error);
    return { error: error instanceof Error ? error.message : "Error al restar stock" };
  }
}
