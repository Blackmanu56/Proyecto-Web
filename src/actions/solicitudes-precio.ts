"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { registrarMovimiento } from "@/lib/movimiento-producto";

export interface CrearSolicitudPrecioInput {
  productoId: number;
  nuevoPrecioCompra?: number;
  nuevoPrecioVenta?: number;
  motivo: string;
}

/**
 * Crear una solicitud de cambio de precio (para usuarios no-admin).
 */
export async function crearSolicitudPrecio(input: CrearSolicitudPrecioInput) {
  try {
    const session = await requirePermission("productos.editar", await getSession());

    const { productoId, nuevoPrecioCompra, nuevoPrecioVenta, motivo } = input;

    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new Error("El ID del producto debe ser un número entero válido.");
    }

    if (!motivo || motivo.trim().length < 3) {
      throw new Error("El motivo del cambio de precio debe tener al menos 3 caracteres.");
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto) {
      throw new Error("Producto no encontrado.");
    }

    const precioCompraFinal =
      nuevoPrecioCompra !== undefined && nuevoPrecioCompra > 0
        ? nuevoPrecioCompra
        : producto.precioCompra;

    const precioVentaFinal =
      nuevoPrecioVenta !== undefined && nuevoPrecioVenta > 0
        ? nuevoPrecioVenta
        : producto.precioVenta;

    if (precioCompraFinal <= 0) {
      throw new Error("El precio de compra debe ser mayor a 0.");
    }

    if (precioVentaFinal <= 0) {
      throw new Error("El precio de venta debe ser mayor a 0.");
    }

    if (
      precioCompraFinal === producto.precioCompra &&
      precioVentaFinal === producto.precioVenta
    ) {
      throw new Error("Los nuevos precios deben ser diferentes a los precios actuales.");
    }

    const solicitud = await prisma.solicitudPrecio.create({
      data: {
        productoId,
        solicitanteId: session.userId,
        precioCompraActual: producto.precioCompra,
        precioCompraNuevo: precioCompraFinal,
        precioVentaActual: producto.precioVenta,
        precioVentaNuevo: precioVentaFinal,
        motivo: motivo.trim(),
        estado: "PENDIENTE",
      },
      include: {
        producto: true,
        solicitante: {
          select: { id: true, nombreCompleto: true, username: true },
        },
      },
    });

    // Notificar a administradores
    const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
    const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");
    const admins = rolAdmin
      ? await prisma.usuario.findMany({
          where: { rolId: rolAdmin.id, activo: true },
          select: { id: true },
        })
      : [];

    if (admins.length > 0) {
      const adminIds = admins.map((a) => a.id);
      const prefs = await prisma.preferenciaNotificacion.findMany({
        where: { usuarioId: { in: adminIds }, tipo: "SOLICITUD_CREADA", habilitada: false },
        select: { usuarioId: true },
      });
      const deshabilitados = new Set(prefs.map((p) => p.usuarioId));
      const adminsFiltrados = admins.filter((a) => !deshabilitados.has(a.id));

      if (adminsFiltrados.length > 0) {
        await prisma.notificacion.createMany({
          data: adminsFiltrados.map((admin) => ({
            usuarioId: admin.id,
            tipo: "SOLICITUD_CREADA",
            titulo: "Nueva solicitud de cambio de precio",
            mensaje: `${session.username} solicitó actualizar precios para '${producto.nombre}'. Compra: $${producto.precioCompra} → $${precioCompraFinal} | Venta: $${producto.precioVenta} → $${precioVentaFinal}`,
            solicitudPrecioId: solicitud.id,
            productoId: producto.id,
            entidad: "solicitud_precio",
          })),
        });
      }
    }

    // Notificar al solicitante
    const prefSolicitante = await prisma.preferenciaNotificacion.findUnique({
      where: { usuarioId_tipo: { usuarioId: session.userId, tipo: "SOLICITUD_CREADA" } },
    });
    if (prefSolicitante?.habilitada !== false) {
      await prisma.notificacion.create({
        data: {
          usuarioId: session.userId,
          tipo: "SOLICITUD_CREADA",
          titulo: "Solicitud de precio enviada",
          mensaje: `Tu solicitud de cambio de precio para '${producto.nombre}' fue enviada y está pendiente de aprobación por un administrador.`,
          solicitudPrecioId: solicitud.id,
          productoId: producto.id,
          entidad: "solicitud_precio",
        },
      });
    }

    revalidatePath("/solicitudes");
    revalidatePath("/productos");

    return { success: true, solicitudId: solicitud.id };
  } catch (error: unknown) {
    console.error("Error en crearSolicitudPrecio:", error);
    return { error: error instanceof Error ? error.message : "Error al crear la solicitud de precio" };
  }
}

/**
 * Aprobar una solicitud de cambio de precio (Solo ADMINISTRADOR).
 */
export async function aprobarSolicitudPrecio(solicitudId: number, observacion?: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMINISTRADOR") {
      throw new Error("Solo los administradores pueden aprobar solicitudes de cambio de precio.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudPrecio.findUnique({
        where: { id: solicitudId },
        include: { producto: true, solicitante: true },
      });

      if (!solicitud) {
        throw new Error("Solicitud no encontrada.");
      }

      if (solicitud.estado !== "PENDIENTE") {
        throw new Error(`La solicitud ya se encuentra ${solicitud.estado.toLowerCase()}.`);
      }

      // 1. Actualizar producto
      const productoActualizado = await tx.producto.update({
        where: { id: solicitud.productoId },
        data: {
          precioCompra: solicitud.precioCompraNuevo,
          precioVenta: solicitud.precioVentaNuevo,
        },
      });

      // 2. Determinar precios afectados
      const compraCambio = solicitud.precioCompraActual !== solicitud.precioCompraNuevo;
      const ventaCambio = solicitud.precioVentaActual !== solicitud.precioVentaNuevo;
      const preciosAfectados =
        compraCambio && ventaCambio
          ? "AMBOS"
          : compraCambio
          ? "SOLO_COMPRA"
          : "SOLO_VENTA";

      // 3. Registrar en AjustePrecio
      const ajuste = await tx.ajustePrecio.create({
        data: {
          tipoAjuste: "VALOR_DIRECTO",
          valor: solicitud.precioVentaNuevo,
          preciosAfectados,
          motivo: `Aprobación solicitud #${solicitud.id}: ${solicitud.motivo}`,
          usuarioId: session.userId,
          cantidadProductos: 1,
          esMasivo: false,
          detalles: {
            create: [
              {
                productoId: solicitud.productoId,
                precioCompraAnterior: solicitud.precioCompraActual,
                precioCompraNuevo: solicitud.precioCompraNuevo,
                precioVentaAnterior: solicitud.precioVentaActual,
                precioVentaNuevo: solicitud.precioVentaNuevo,
              },
            ],
          },
        },
      });

      // 4. Registrar auditoría de MovimientoProducto
      const cambios: Array<{ campo: string; anterior: unknown; nuevo: unknown }> = [];
      if (compraCambio) {
        cambios.push({
          campo: "precioCompra",
          anterior: solicitud.precioCompraActual,
          nuevo: solicitud.precioCompraNuevo,
        });
      }
      if (ventaCambio) {
        cambios.push({
          campo: "precioVenta",
          anterior: solicitud.precioVentaActual,
          nuevo: solicitud.precioVentaNuevo,
        });
      }

      if (cambios.length > 0) {
        await registrarMovimiento(tx, {
          productoId: solicitud.productoId,
          tipo: "EDICION",
          cantidadAnterior: productoActualizado.cantidad,
          cantidadNueva: productoActualizado.cantidad,
          motivo: `Ajuste de precio aprobado #${solicitud.id}: ${solicitud.motivo}`,
          cambios,
          usuarioId: session.userId,
        });
      }

      // 5. Actualizar SolicitudPrecio
      const solicitudActualizada = await tx.solicitudPrecio.update({
        where: { id: solicitudId },
        data: {
          estado: "APROBADA",
          aprobadorId: session.userId,
          observacionResolucion: observacion?.trim() || null,
          ajustePrecioId: ajuste.id,
          fechaResolucion: new Date(),
        },
      });

      // 6. Notificar al solicitante
      const pref = await tx.preferenciaNotificacion.findUnique({
        where: {
          usuarioId_tipo: {
            usuarioId: solicitud.solicitanteId,
            tipo: "SOLICITUD_APROBADA",
          },
        },
      });
      if (pref?.habilitada !== false) {
        await tx.notificacion.create({
          data: {
            usuarioId: solicitud.solicitanteId,
            tipo: "SOLICITUD_APROBADA",
            titulo: "Solicitud de cambio de precio aprobada",
            mensaje: `Tu solicitud de ajuste de precios para '${solicitud.producto.nombre}' fue aprobada por el administrador y aplicada con éxito.`,
            solicitudPrecioId: solicitud.id,
            productoId: solicitud.productoId,
            entidad: "solicitud_precio",
          },
        });
      }

      return { producto: productoActualizado, solicitud: solicitudActualizada };
    });

    revalidatePath("/productos");
    revalidatePath("/solicitudes");

    return { success: true, producto: result.producto };
  } catch (error: unknown) {
    console.error("Error en aprobarSolicitudPrecio:", error);
    return { error: error instanceof Error ? error.message : "Error al aprobar la solicitud de precio" };
  }
}

/**
 * Rechazar una solicitud de cambio de precio (Solo ADMINISTRADOR).
 */
export async function rechazarSolicitudPrecio(solicitudId: number, motivoRechazo?: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMINISTRADOR") {
      throw new Error("Solo los administradores pueden rechazar solicitudes de cambio de precio.");
    }

    if (!motivoRechazo || motivoRechazo.trim().length === 0) {
      throw new Error("El motivo de rechazo es obligatorio.");
    }

    const solicitud = await prisma.solicitudPrecio.findUnique({
      where: { id: solicitudId },
      include: { producto: true },
    });

    if (!solicitud) {
      throw new Error("Solicitud no encontrada.");
    }

    if (solicitud.estado !== "PENDIENTE") {
      throw new Error(`La solicitud ya se encuentra ${solicitud.estado.toLowerCase()}.`);
    }

    const actualizada = await prisma.solicitudPrecio.update({
      where: { id: solicitudId },
      data: {
        estado: "RECHAZADA",
        aprobadorId: session.userId,
        observacionResolucion: motivoRechazo?.trim() || null,
        fechaResolucion: new Date(),
      },
    });

    // Notificar al solicitante
    const pref = await prisma.preferenciaNotificacion.findUnique({
      where: {
        usuarioId_tipo: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_RECHAZADA",
        },
      },
    });
    if (pref?.habilitada !== false) {
      await prisma.notificacion.create({
        data: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_RECHAZADA",
          titulo: "Solicitud de cambio de precio rechazada",
          mensaje: `Tu solicitud de ajuste de precios para '${solicitud.producto.nombre}' fue rechazada.${motivoRechazo ? ` Motivo: ${motivoRechazo.trim()}` : ""}`,
          solicitudPrecioId: solicitud.id,
          productoId: solicitud.productoId,
          entidad: "solicitud_precio",
        },
      });
    }

    revalidatePath("/solicitudes");

    return { success: true, solicitud: actualizada };
  } catch (error: unknown) {
    console.error("Error en rechazarSolicitudPrecio:", error);
    return { error: error instanceof Error ? error.message : "Error al rechazar la solicitud de precio" };
  }
}

/**
 * Cancelar una solicitud de cambio de precio por parte del solicitante.
 */
export async function cancelarSolicitudPrecio(solicitudId: number) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error("No autenticado.");
    }

    const solicitud = await prisma.solicitudPrecio.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud) {
      throw new Error("Solicitud no encontrada.");
    }

    if (solicitud.estado !== "PENDIENTE") {
      throw new Error("Solo se pueden cancelar solicitudes pendientes.");
    }

    if (session.role !== "ADMINISTRADOR" && solicitud.solicitanteId !== session.userId) {
      throw new Error("No tienes permiso para cancelar esta solicitud.");
    }

    const actualizada = await prisma.solicitudPrecio.update({
      where: { id: solicitudId },
      data: {
        estado: "CANCELADA",
        fechaResolucion: new Date(),
      },
    });

    revalidatePath("/solicitudes");

    return { success: true, solicitud: actualizada };
  } catch (error: unknown) {
    console.error("Error en cancelarSolicitudPrecio:", error);
    return { error: error instanceof Error ? error.message : "Error al cancelar la solicitud de precio" };
  }
}
