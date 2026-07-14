"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";

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
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)) {
    return { error: "No tiene permisos para realizar esta acción." };
  }

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
  } catch (error: any) {
    console.error("Error en crearClienteRapido:", error);
    return { error: error.message || "Error al registrar el cliente." };
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
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  if (items.length === 0) {
    throw new Error("El carrito de compras está vacío.");
  }

  if (!metodoPago) {
    throw new Error("Debe seleccionar una forma de pago.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar que la caja esté abierta
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

        await tx.producto.update({
          where: { id: item.productoId },
          data: { cantidad: { decrement: item.cantidad } },
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

      // 3. Aplicar descuento
      let descuentoAplicado = 0;
      if (descuentoTipo === "PORCENTAJE" && montoDescuento > 0) {
        descuentoAplicado = totalVenta * (montoDescuento / 100);
      } else if (descuentoTipo === "MONTO" && montoDescuento > 0) {
        descuentoAplicado = Math.min(montoDescuento, totalVenta);
      }

      const totalFinal = totalVenta - descuentoAplicado;

      // 4. Crear cabecera de la Venta
      const venta = await tx.venta.create({
        data: {
          clienteId: clienteId,
          usuarioId: session.userId,
          total: totalFinal,
          metodoPago: metodoPago,
          descuentoTipo: descuentoTipo || null,
          montoDescuento: descuentoAplicado,
          tipoComprobante: tipoComprobante || null,
          cuotas: (metodoPago === "TARJETA_CREDITO" && cuotas) ? cuotas : null,
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
          descripcion: `${tipoComprobante || 'Venta'} Nº ${venta.id} - ${metodoPago}${descuentoAplicado > 0 ? ` (Dto: $${descuentoAplicado.toFixed(2)})` : ''}`,
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
      total: result.total,
    };
  } catch (error: any) {
    console.error("Error en createVenta:", error);
    return { error: error.message || "Error al registrar la venta" };
  }
}
