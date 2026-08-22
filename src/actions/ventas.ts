"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatTipoComprobante } from "@/lib/movimiento-format";
import { validateVentaPayload } from "@/lib/ventas-validation";
import { resolverDestinoFinanciero } from "@/lib/cuenta-financiera";
import type { DestinoFinanciero } from "@/lib/cuenta-financiera";
import { registrarMovimiento } from "@/lib/movimiento-producto";
import { evaluarYNotificarStock } from "@/lib/stock-notifications";

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

      const esCobroEfectivo = ventaInput.metodoPago === "EFECTIVO";

      // Solo un cobro físico en efectivo requiere una Caja abierta.
      const cajaAbierta = esCobroEfectivo
        ? await tx.caja.findFirst({ where: { estado: "ABIERTA" } })
        : null;

      if (esCobroEfectivo && !cajaAbierta) {
        throw new Error("No hay una caja abierta para registrar un cobro en efectivo.");
      }

      let totalVenta = 0.0;
      const detallesAGuardar = [];
      const movimientosPendientes = [] as Array<{
        productoId: number;
        cantidadAnterior: number;
        cantidadNueva: number;
      }>;

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

        // Capture movement for batch registration after venta creation
        movimientosPendientes.push({
          productoId: item.productoId,
          cantidadAnterior: prod.cantidad,
          cantidadNueva: prod.cantidad - item.cantidad,
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
        throw new Error("El total final de la venta no es v\u00e1lido.");
      }

      // ─── Resolución de cuenta financiera para medios no-efectivo ──────
      let destinoFinanciero: DestinoFinanciero | null = null;
      if (!esCobroEfectivo && totalFinal > 0) {
        const cuentaBanco = await tx.cuentaFinanciera.findFirst({
          where: { tipo: "BANCO", esPrincipal: true, activa: true },
          select: { id: true },
        });
        const cuentaPorAcreditar = await tx.cuentaFinanciera.findFirst({
          where: { tipo: "POR_ACREDITAR", activa: true },
          select: { id: true },
        });
        destinoFinanciero = resolverDestinoFinanciero(
          ventaInput.metodoPago,
          totalFinal,
          cuentaBanco,
          cuentaPorAcreditar
        );
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

      // Audit: register stock movement per item with ventaId
      for (const mov of movimientosPendientes) {
        await registrarMovimiento(tx, {
          productoId: mov.productoId,
          tipo: "VENTA",
          cantidadAnterior: mov.cantidadAnterior,
          cantidadNueva: mov.cantidadNueva,
          ventaId: venta.id,
          motivo: `Venta N° ${venta.id}`,
          usuarioId: session.userId,
        });
      }

      // Solo el efectivo físico genera MovimientoCaja. Los demás medios siguen
      // siendo ventas económicas, sin cajaId artificial ni movimientos neutros.
      if (esCobroEfectivo && cajaAbierta && totalFinal > 0) {
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

        // Se conserva totalVentas solo por compatibilidad histórica.
        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: { totalVentas: { increment: totalFinal } },
        });
      }

      // ─── MovimientoFinanciero para Transferencia / Débito / Crédito ──
      if (destinoFinanciero) {
        await tx.movimientoFinanciero.create({
          data: {
            cuentaFinancieraId: destinoFinanciero.cuentaFinancieraId,
            tipo: "INGRESO",
            monto: totalFinal,
            descripcion: `${formatTipoComprobante(ventaInput.tipoComprobante)} N\u00b0 ${venta.id} \u00b7 ${ventaInput.metodoPago}`,
            usuarioId: session.userId,
            ventaId: venta.id,
          },
        });
      }

      return { venta, movimientosPendientes };
    });

    revalidatePath("/productos");
    revalidatePath("/ventas");
    revalidatePath("/caja");

    // Evaluar stock y crear notificaciones para cada producto vendido
    for (const mov of result.movimientosPendientes) {
      await evaluarYNotificarStock({
        productoId: mov.productoId,
        cantidadAnterior: mov.cantidadAnterior,
        cantidadNueva: mov.cantidadNueva,
        usuarioId: session.userId,
        usuarioNombre: session.username,
        tipoMovimiento: "VENTA",
        motivo: `Venta N° ${result.venta.id}`,
      });
    }

    // Notificar a todos los ADMINISTRADOR que se creó una venta
    if (prisma?.rol?.findMany) {
      try {
        const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
        const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");

        if (rolAdmin && prisma?.usuario?.findMany) {
          const admins = await prisma.usuario.findMany({
            where: { activo: true, rolId: rolAdmin.id },
            select: { id: true },
          });

          const prefers = prisma?.preferenciaNotificacion?.findMany
            ? await prisma.preferenciaNotificacion.findMany({
                where: { tipo: "VENTA_CREADA", usuarioId: { in: admins.map((a) => a.id) } },
              })
            : [];
          const disabledIds = new Set(prefers.filter((p) => !p.habilitada).map((p) => p.usuarioId));
          const eligibleAdmins = admins.filter((a) => !disabledIds.has(a.id));

          if (eligibleAdmins.length > 0 && prisma?.notificacion?.createMany) {
            const totalItems = result.movimientosPendientes.length;
            const totalMonto = Number(result.venta.total);
            const montoFmt = totalMonto.toLocaleString();
            const plural = totalItems > 1 ? "s" : "";
            const msg = `Venta N${"\u00b0"} ${result.venta.id} por ${montoFmt} pesos (${totalItems} producto${plural}). Vendedor: ${session.username}.`;
            await prisma.notificacion.createMany({
              data: eligibleAdmins.map((a) => ({
                usuarioId: a.id,
                tipo: "VENTA_CREADA",
                titulo: "Nueva venta registrada",
                mensaje: msg,
                entidad: "venta",
              })),
            });
          }
        }
      } catch (notifErr) {
        console.error("Error al notificar venta:", notifErr);
      }
    }

    return {
      success: true,
      ventaId: result.venta.id,
      total: Number(result.venta.total),
    };
  } catch (error: unknown) {
    console.error("Error en createVenta:", error);
    return { error: error instanceof Error ? error.message : "Error al registrar la venta" };
  }
}
