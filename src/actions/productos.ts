"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { saveFile, deleteFile } from "@/lib/upload";
import { MotivoEstadoProducto, Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth-permissions";
import { shouldCreateCajaEgreso } from "@/lib/caja-ajuste";

const pagoSchema = z.object({
  medio: z.enum(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA", "MERCADO_PAGO", "CUENTA_CORRIENTE_PROVEEDOR", "FONDOS_EXTERNOS"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  observacion: z.string().optional(),
});

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
  const session = await requirePermission("productos.crear", await getSession());

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
    throw new Error(validation.error.errors[0].message);
  }

  // Validate payments if provided
  const pagos = validation.data.pagos;
  if (pagos && pagos.length > 0) {
    const totalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const totalCosto = validation.data.cantidad * validation.data.precioCompra;
    
    // Only validate payment sum if there's a reposición (cantidad > 0)
    if (validation.data.cantidad > 0 && Math.abs(totalPagos - totalCosto) > 0.01) {
      throw new Error(`La suma de los pagos ($${totalPagos.toFixed(2)}) no coincide con el total ($${totalCosto.toFixed(2)}).`);
    }

    // Check for duplicate payment methods
    const medios = pagos.map(p => p.medio);
    const uniqueMedios = new Set(medios);
    if (uniqueMedios.size !== medios.length) {
      throw new Error("No se permiten métodos de pago duplicados.");
    }

    // Validate Caja balance for EFECTIVO_CAJA payments
    const efectivoCajaPago = pagos.find(p => p.medio === "EFECTIVO_CAJA");
    if (efectivoCajaPago && efectivoCajaPago.monto > 0) {
      const cajaAbierta = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } });
      if (!cajaAbierta) {
        throw new Error("No hay una caja abierta. Para utilizar Efectivo de Caja primero debe abrir una caja o seleccionar otro medio de pago.");
      }
      
      const cajaActual = cajaAbierta.montoInicial + cajaAbierta.totalVentas;
      if (efectivoCajaPago.monto > cajaActual) {
        throw new Error(`Fondos insuficientes en Caja. Disponible: $${cajaActual.toFixed(2)}, Solicitado: $${efectivoCajaPago.monto.toFixed(2)}, Faltante: $${(efectivoCajaPago.monto - cajaActual).toFixed(2)}.`);
      }
    }
  }

  try {
    const producto = await prisma.$transaction(async (tx) => {
      // 0. Si hay stock inicial, buscar caja una sola vez
      const cajaAbierta = (validation.data.cantidad > 0)
        ? await tx.caja.findFirst({ where: { estado: "ABIERTA" } })
        : null;

      // Si el pago es en efectivo y no hay caja abierta, rechazar ANTES de cualquier escritura.
      if (validation.data.cantidad > 0 && shouldCreateCajaEgreso(validation.data.origenPago) && !cajaAbierta && (!pagos || pagos.length === 0)) {
        throw new Error("No hay una caja abierta para registrar el pago en efectivo.");
      }

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

        // La compra contable existe para cualquier origen y no depende de una caja abierta.
        const compra = await tx.compra.create({
          data: {
            proveedorId: validation.data.proveedorId,
            usuarioId: session.userId,
            total: totalCosto,
            origenPago: validation.data.origenPago,
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

        // Create payment records if provided
        if (pagos && pagos.length > 0) {
          await tx.pagoCompra.createMany({
            data: pagos.map(pago => ({
              compraId: compra.id,
              medio: pago.medio,
              monto: pago.monto,
              observacion: pago.observacion || null,
            })),
          });

          // Create cash movements for EFECTIVO_CAJA payments
          for (const pago of pagos) {
            if (pago.medio === "EFECTIVO_CAJA" && pago.monto > 0 && cajaAbierta) {
              await tx.movimientoCaja.create({
                data: {
                  cajaId: cajaAbierta.id,
                  usuarioId: session.userId,
                  compraId: compra.id,
                  tipo: "EGRESO",
                  monto: pago.monto,
                  descripcion: `Stock inicial de '${validation.data.nombre}' x${validation.data.cantidad} (Efectivo)`,
                },
              });

              await tx.caja.update({
                where: { id: cajaAbierta.id },
                data: {
                  totalVentas: {
                    decrement: pago.monto,
                  },
                },
              });
            }
          }
        } else {
          // Legacy behavior: single payment method
          // Solo el efectivo de caja genera movimiento y decrementa el saldo físico.
          if (cajaAbierta && shouldCreateCajaEgreso(validation.data.origenPago)) {
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
      }

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto };
  } catch (error: unknown) {
    console.error("Error en createProducto:", error);
    return { error: error instanceof Error ? error.message : "Error al agregar el producto" };
  }
}

/**
 * Modificar un producto y registrar reposiciones automáticas
 */
export async function updateProducto(id: number, formData: FormData) {
  try {
    const session = await requirePermission("productos.editar", await getSession());

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

      // 0. Si hay reposición con efectivo, validar caja abierta ANTES de cualquier escritura
      const cajaAbierta = (nuevoStock > stockAnterior)
        ? await tx.caja.findFirst({ where: { estado: "ABIERTA" } })
        : null;

      if (nuevoStock > stockAnterior && shouldCreateCajaEgreso(validation.data.origenPago) && !cajaAbierta && (!validation.data.pagos || validation.data.pagos.length === 0)) {
        throw new Error("No hay una caja abierta para registrar el pago en efectivo.");
      }

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
            origenPago: validation.data.origenPago,
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

        // Handle multiple payments if provided
        const pagos = validation.data.pagos;
        if (pagos && pagos.length > 0) {
          // Validate payment sum (only if there's a reposición)
          if (diferencia > 0) {
            const totalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
            if (Math.abs(totalPagos - totalCosto) > 0.01) {
              throw new Error(`La suma de los pagos ($${totalPagos.toFixed(2)}) no coincide con el total ($${totalCosto.toFixed(2)}).`);
            }
          }

          // Check for duplicate payment methods
          const medios = pagos.map(p => p.medio);
          const uniqueMedios = new Set(medios);
          if (uniqueMedios.size !== medios.length) {
            throw new Error("No se permiten métodos de pago duplicados.");
          }

          // Validate Caja balance for EFECTIVO_CAJA payments
          const efectivoCajaPago = pagos.find(p => p.medio === "EFECTIVO_CAJA");
          if (efectivoCajaPago && efectivoCajaPago.monto > 0) {
            if (!cajaAbierta) {
              throw new Error("No hay una caja abierta. Para utilizar Efectivo de Caja primero debe abrir una caja o seleccionar otro medio de pago.");
            }
            const cajaActual = cajaAbierta.montoInicial + cajaAbierta.totalVentas;
            if (efectivoCajaPago.monto > cajaActual) {
              throw new Error(`Fondos insuficientes en Caja. Disponible: $${cajaActual.toFixed(2)}, Solicitado: $${efectivoCajaPago.monto.toFixed(2)}, Faltante: $${(efectivoCajaPago.monto - cajaActual).toFixed(2)}.`);
            }
          }

          // Create payment records
          await tx.pagoCompra.createMany({
            data: pagos.map(pago => ({
              compraId: compra.id,
              medio: pago.medio,
              monto: pago.monto,
              observacion: pago.observacion || null,
            })),
          });

          // Create cash movements for EFECTIVO_CAJA payments
          for (const pago of pagos) {
            if (pago.medio === "EFECTIVO_CAJA" && pago.monto > 0 && cajaAbierta) {
              await tx.movimientoCaja.create({
                data: {
                  cajaId: cajaAbierta.id,
                  usuarioId: session.userId,
                  compraId: compra.id,
                  tipo: "EGRESO",
                  monto: pago.monto,
                  descripcion: `Reposición de '${validation.data.nombre}' x${diferencia} (Efectivo)`,
                },
              });

              await tx.caja.update({
                where: { id: cajaAbierta.id },
                data: {
                  totalVentas: {
                    decrement: pago.monto,
                  },
                },
              });
            }
          }
        } else {
          // Legacy behavior: single payment method
          // Registrar egreso en la Caja solo si hay una caja abierta Y el pago salió del cajón
          if (cajaAbierta && shouldCreateCajaEgreso(validation.data.origenPago)) {
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
      }

      return p;
    });

    revalidatePath("/productos");
    return { success: true, producto: result };
  } catch (error: unknown) {
    console.error("Error en updateProducto:", error);
    return { error: error instanceof Error ? error.message : "Error al actualizar el producto" };
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
