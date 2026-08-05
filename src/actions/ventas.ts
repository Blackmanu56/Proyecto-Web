"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatTipoComprobante } from "@/lib/movimiento-format";
import { validateVentaPayload } from "@/lib/ventas-validation";

interface VentaItem {
  productoId: number;
  cantidad: number;
}

/**
 * Crear un cliente rápido desde la terminal de ventas.
 */
export async function crearClienteRapido(
  nombre: string,
  dni: string,
  telefono: string,
  email: string
) {
  await requirePermission("clientes.crear", await getSession());

  if (!nombre || !dni) {
    return { error: "El nombre y el DNI son obligatorios." };
  }

  try {
    const existingDni = await prisma.cliente.findUnique({ where: { dni } });
    if (existingDni) {
      return { error: "El DNI ya se encuentra registrado por otro cliente." };
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        dni,
        telefono: telefono || null,
        email: email || null,
        activo: true,
      },
    });

    revalidatePath("/ventas");
    revalidatePath("/clientes");
    return {
      success: true,
      cliente: { id: cliente.id, nombre: cliente.nombre, dni: cliente.dni, cuit: cliente.cuit },
    };
  } catch (error: unknown) {
    console.error("Error en crearClienteRapido:", error);
    return { error: error instanceof Error ? error.message : "Error al registrar el cliente." };
  }
}

/**
 * Alterna el estado de favorito de un producto para el usuario actual.
 */
export async function toggleFavorito(productoId: number) {
  const session = await getSession();
  if (!session) {
    return { error: "Debe iniciar sesión." };
  }

  try {
    const existing = await prisma.productoFavorito.findUnique({
      where: {
        usuarioId_productoId: {
          usuarioId: session.userId,
          productoId,
        },
      },
    });

    if (existing) {
      await prisma.productoFavorito.delete({
        where: { id: existing.id },
      });
      return { success: true, favorito: false };
    } else {
      await prisma.productoFavorito.create({
        data: {
          usuarioId: session.userId,
          productoId,
        },
      });
      return { success: true, favorito: true };
    }
  } catch (error: unknown) {
    console.error("Error en toggleFavorito:", error);
    return { error: error instanceof Error ? error.message : "Error al actualizar favorito." };
  }
}

/**
 * Registra una venta completa con control transaccional de stock y caja contable.
 */
export async function createVenta(
  clienteId: number,
  items: VentaItem[],
  metodoPago: string,
  descuentoTipo: string | null,
  montoDescuento: number,
  tipoComprobante: string,
  cuotas?: number | null
) {
  try {
    const session = await requirePermission("ventas.crear", await getSession());
    const payload = validateVentaPayload({
      clienteId,
      items,
      metodoPago,
      descuentoTipo,
      montoDescuento,
      tipoComprobante,
      cuotas: cuotas ?? null,
    });

    if (!payload.success) {
      return { error: payload.error };
    }

    const ventaInput = payload.data;

    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: ventaInput.clienteId },
        select: { id: true, activo: true },
      });

      if (!cliente) {
        throw new Error("Cliente no encontrado.");
      }

      if (!cliente.activo) {
        throw new Error("El cliente seleccionado est? dado de baja.");
      }

      // 1. Validar que la caja est? abierta
      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
      });

      if (!cajaAbierta) {
        throw new Error("Debe abrir la caja antes de poder registrar ventas.");
      }

      let totalVenta = 0.0;
      const detallesAGuardar = [];

      // 2. Validar existencias y calcular costos/precios desde la base
      for (const item of ventaInput.items) {
        const prod = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!prod) {
          throw new Error(`El producto con ID ${item.productoId} no existe.`);
        }

        if (!prod.activo) {
          throw new Error(`El producto '${prod.nombre}' est? dado de baja.`);
        }

        if (!Number.isInteger(prod.cantidad) || prod.cantidad < item.cantidad) {
          throw new Error(`Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.cantidad} u.`);
        }

        const precioVenta = Number(prod.precioVenta);
        if (!Number.isFinite(precioVenta) || precioVenta < 0) {
          throw new Error(`El producto '${prod.nombre}' tiene un precio inv?lido.`);
        }

        await tx.producto.update({
          where: { id: item.productoId },
          data: { cantidad: { decrement: item.cantidad } },
        });

        const subtotal = item.cantidad * precioVenta;
        if (!Number.isFinite(subtotal) || subtotal < 0) {
          throw new Error(`Subtotal inv?lido para '${prod.nombre}'.`);
        }

        totalVenta += subtotal;

        detallesAGuardar.push({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: precioVenta,
          subtotal,
        });
      }

      if (!Number.isFinite(totalVenta) || totalVenta <= 0) {
        throw new Error("El total de la venta no es v?lido.");
      }

      // 3. Aplicar descuento validado
      let descuentoAplicado = 0;
      if (ventaInput.descuentoTipo === "PORCENTAJE" && ventaInput.montoDescuento > 0) {
        descuentoAplicado = totalVenta * (ventaInput.montoDescuento / 100);
      } else if (ventaInput.descuentoTipo === "MONTO" && ventaInput.montoDescuento > 0) {
        if (ventaInput.montoDescuento > totalVenta) {
          throw new Error("El descuento no puede superar el total de la venta.");
        }
        descuentoAplicado = ventaInput.montoDescuento;
      }

      const totalFinal = totalVenta - descuentoAplicado;
      if (!Number.isFinite(totalFinal) || totalFinal < 0) {
        throw new Error("El total final de la venta no es v?lido.");
      }

      // 4. Crear cabecera de la Venta
      const venta = await tx.venta.create({
        data: {
          clienteId: ventaInput.clienteId,
          usuarioId: session.userId,
          total: totalFinal,
          metodoPago: ventaInput.metodoPago,
          descuentoTipo: ventaInput.descuentoTipo,
          montoDescuento: descuentoAplicado,
          tipoComprobante: ventaInput.tipoComprobante,
          cuotas: ventaInput.cuotas,
          detalles: {
            create: detallesAGuardar,
          },
        },
      });

      // 5. Registrar movimiento de INGRESO en la Caja
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId: session.userId,
          ventaId: venta.id,
          tipo: "INGRESO",
          monto: totalFinal,
          descripcion: `${formatTipoComprobante(ventaInput.tipoComprobante)} N° ${venta.id} - ${ventaInput.metodoPago}${descuentoAplicado > 0 ? ` (Dto: $${descuentoAplicado.toFixed(2)})` : ""}`,
        },
      });

      // 6. Incrementar totales de la Caja Abierta
      await tx.caja.update({
        where: { id: cajaAbierta.id },
        data: { totalVentas: { increment: totalFinal } },
      });

      return venta;
    });

    revalidatePath("/productos");
    revalidatePath("/ventas");
    revalidatePath("/caja");

    return {
      success: true,
      ventaId: result.id,
      total: Number(result.total),
    };
  } catch (error: unknown) {
    console.error("Error en createVenta:", error);
    return { error: error instanceof Error ? error.message : "Error al registrar la venta" };
  }
}
