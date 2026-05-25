"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";

interface VentaItem {
  productoId: number;
  cantidad: number;
}

/**
 * Registra una venta completa con control transaccional de stock y caja contable.
 */
export async function createVenta(
  clienteId: number,
  items: VentaItem[]
) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "VENDEDOR", "CAJERO"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  if (items.length === 0) {
    throw new Error("El carrito de compras está vacío.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar que la caja esté abierta para poder recibir el ingreso
      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
      });

      if (!cajaAbierta) {
        throw new Error("Debe abrir la caja antes de poder registrar ventas.");
      }

      let totalVenta = 0.0;
      const detallesAGuardar = [];

      // 2. Validar existencias y calcular costos/precios
      for (const item of items) {
        const prod = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!prod) {
          throw new Error(`El producto con ID ${item.productoId} no existe.`);
        }

        if (!prod.activo) {
          throw new Error(`El producto '${prod.nombre}' está dado de baja.`);
        }

        if (prod.cantidad < item.cantidad) {
          throw new Error(`Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.cantidad} u.`);
        }

        // Descontar stock del producto
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            cantidad: {
              decrement: item.cantidad,
            },
          },
        });

        const subtotal = item.cantidad * prod.precioVenta;
        totalVenta += subtotal;

        detallesAGuardar.push({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: prod.precioVenta,
          subtotal: subtotal,
        });
      }

      // 3. Crear cabecera de la Venta
      const venta = await tx.venta.create({
        data: {
          clienteId: clienteId,
          usuarioId: session.userId,
          total: totalVenta,
          detalles: {
            create: detallesAGuardar,
          },
        },
      });

      // 4. Registrar movimiento de INGRESO en la Caja
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId: session.userId,
          ventaId: venta.id,
          tipo: "INGRESO",
          monto: totalVenta,
          descripcion: `Venta - Factura Nº ${venta.id}`,
        },
      });

      // 5. Incrementar totales de la Caja Abierta
      await tx.caja.update({
        where: { id: cajaAbierta.id },
        data: {
          totalVentas: {
            increment: totalVenta,
          },
        },
      });

      return venta;
    });

    revalidatePath("/productos");
    revalidatePath("/ventas");
    revalidatePath("/caja");
    
    return { success: true, ventaId: result.id, total: result.total };
  } catch (error: any) {
    console.error("Error en createVenta:", error);
    return { error: error.message || "Error al registrar la venta" };
  }
}
