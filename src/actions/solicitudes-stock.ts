"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";

// ─── crearSolicitudStock ──────────────────────────────────────────────────

export async function crearSolicitudStock(
  tipo: "RESTA" | "REPOSICION",
  productoId: number,
  cantidad: number,
  motivo: string,
  observacion?: string
) {
  try {
    const session = await requirePermission("productos.solicitar_stock");

    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new Error("El ID del producto debe ser un número entero válido.");
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new Error("La cantidad debe ser un número entero mayor a 0.");
    }
    if (tipo !== "RESTA" && tipo !== "REPOSICION") {
      throw new Error("El tipo debe ser RESTA o REPOSICION.");
    }
    if (!motivo || motivo.trim().length === 0) {
      throw new Error("El motivo es obligatorio.");
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });
    if (!producto) {
      throw new Error("Producto no encontrado.");
    }
    if (!producto.activo) {
      throw new Error("Producto inactivo.");
    }

    if (tipo === "RESTA" && producto.cantidad < cantidad) {
      throw new Error(
        `Stock insuficiente. Stock actual: ${producto.cantidad} unidades.`
      );
    }

    const solicitud = await prisma.solicitudStock.create({
      data: {
        productoId,
        tipo,
        cantidad,
        stockAnterior: producto.cantidad,
        motivo,
        estado: "PENDIENTE",
        solicitanteId: session.userId,
      },
    });

    // Notify all active admins
    const admins = await prisma.usuario.findMany({
      where: {
        rol: { nombre: "ADMINISTRADOR" },
        activo: true,
      },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notificacion.createMany({
        data: admins.map((admin) => ({
          usuarioId: admin.id,
          tipo: "SOLICITUD_CREADA",
          titulo: "Nueva solicitud de stock",
          mensaje: `${session.username} solicita ${tipo === "RESTA" ? "resta" : "reposición"} de ${cantidad} unidades de '${producto.nombre}'${observacion ? `. Obs: ${observacion}` : ""}`,
          solicitudStockId: solicitud.id,
        })),
      });
    }

    revalidatePath("/productos");
    revalidatePath("/solicitudes-stock");
    return { success: true, solicitudId: solicitud.id };
  } catch (error: unknown) {
    console.error("Error en crearSolicitudStock:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al crear solicitud de stock",
    };
  }
}

// ─── aprobarSolicitudStock ────────────────────────────────────────────────

export async function aprobarSolicitudStock(
  solicitudId: number,
  observacion?: string
) {
  try {
    const session = await requirePermission("productos.aprobar_solicitud_stock");

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      throw new Error("El ID de la solicitud debe ser un número entero válido.");
    }

    await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudStock.findUnique({
        where: { id: solicitudId },
        include: { producto: true },
      });

      if (!solicitud) {
        throw new Error("Solicitud no encontrada.");
      }
      if (solicitud.estado !== "PENDIENTE") {
        throw new Error("La solicitud ya fue resuelta.");
      }
      if (!solicitud.producto.activo) {
        throw new Error("Producto inactivo.");
      }

      // Self-approval guard
      if (solicitud.solicitanteId === session.userId) {
        throw new Error("No puede aprobar su propia solicitud.");
      }

      const stockAnterior = solicitud.producto.cantidad;
      let stockNuevo: number;

      if (solicitud.tipo === "RESTA") {
        // Atomic decrement with stock guard
        const updateResult = await tx.producto.updateMany({
          where: { id: solicitud.productoId, cantidad: { gte: solicitud.cantidad } },
          data: { cantidad: { decrement: solicitud.cantidad } },
        });

        if (updateResult.count === 0) {
          const current = await tx.producto.findUnique({
            where: { id: solicitud.productoId },
          });
          throw new Error(
            `Stock insuficiente. Stock actual: ${current?.cantidad ?? 0} unidades.`
          );
        }

        stockNuevo = stockAnterior - solicitud.cantidad;
      } else {
        // REPOSICION — increment stock
        await tx.producto.update({
          where: { id: solicitud.productoId },
          data: { cantidad: { increment: solicitud.cantidad } },
        });

        stockNuevo = stockAnterior + solicitud.cantidad;
      }

      // TODO: Create MovimientoProducto audit record.
      // TipoMovimientoProducto enum needs RESTA_APROBADA / REPOSICION_SOLICITUD_APROBADA
      // to be added to schema before this can be enabled.

      // Update solicitud status
      await tx.solicitudStock.update({
        where: { id: solicitudId },
        data: {
          estado: "APROBADA",
          resueltoPorId: session.userId,
          observacionResolucion: observacion ?? null,
          resolvedAt: new Date(),
        },
      });

      // Notify the solicitante
      await tx.notificacion.create({
        data: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_APROBADA",
          titulo: "Solicitud de stock aprobada",
          mensaje: `Tu solicitud de ${solicitud.tipo === "RESTA" ? "resta" : "reposición"} de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue aprobada. Stock: ${stockAnterior} → ${stockNuevo}.`,
          solicitudStockId: solicitud.id,
        },
      });
    });

    revalidatePath("/productos");
    revalidatePath("/solicitudes-stock");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en aprobarSolicitudStock:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al aprobar solicitud de stock",
    };
  }
}

// ─── rechazarSolicitudStock ──────────────────────────────────────────────

export async function rechazarSolicitudStock(
  solicitudId: number,
  motivo: string
) {
  try {
    const session = await requirePermission("productos.aprobar_solicitud_stock");

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      throw new Error("El ID de la solicitud debe ser un número entero válido.");
    }
    if (!motivo || motivo.trim().length === 0) {
      throw new Error("El motivo de rechazo es obligatorio.");
    }

    await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudStock.findUnique({
        where: { id: solicitudId },
        include: { producto: true },
      });

      if (!solicitud) {
        throw new Error("Solicitud no encontrada.");
      }
      if (solicitud.estado !== "PENDIENTE") {
        throw new Error("La solicitud ya fue resuelta.");
      }

      await tx.solicitudStock.update({
        where: { id: solicitudId },
        data: {
          estado: "RECHAZADA",
          resueltoPorId: session.userId,
          observacionResolucion: motivo,
          resolvedAt: new Date(),
        },
      });

      await tx.notificacion.create({
        data: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_RECHAZADA",
          titulo: "Solicitud de stock rechazada",
          mensaje: `Tu solicitud de ${solicitud.tipo === "RESTA" ? "resta" : "reposición"} de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue rechazada. Motivo: ${motivo}`,
          solicitudStockId: solicitud.id,
        },
      });
    });

    revalidatePath("/solicitudes-stock");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en rechazarSolicitudStock:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al rechazar solicitud de stock",
    };
  }
}

// ─── getSolicitudesStock ─────────────────────────────────────────────────

interface GetSolicitudesStockFilters {
  estado?: string;
  tipo?: string;
  solicitanteId?: number;
  page?: number;
  pageSize?: number;
}

export async function getSolicitudesStock(filters: GetSolicitudesStockFilters = {}) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    let enforcedSolicitanteId: number | undefined;

    try {
      // Try admin path first
      await requirePermission("productos.aprobar_solicitud_stock", session);
    } catch {
      // Fallback: require solicitar_stock and enforce own solicitudes only
      try {
        const encargadoSession = await requirePermission(
          "productos.solicitar_stock",
          session
        );
        enforcedSolicitanteId = encargadoSession.userId;
      } catch {
        throw new Error("Acceso denegado.");
      }
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.tipo) where.tipo = filters.tipo;

    // Enforce server-side data isolation
    if (enforcedSolicitanteId) {
      where.solicitanteId = enforcedSolicitanteId;
    } else if (filters.solicitanteId) {
      where.solicitanteId = filters.solicitanteId;
    }

    const [data, total] = await Promise.all([
      prisma.solicitudStock.findMany({
        where,
        include: {
          producto: { select: { id: true, nombre: true, imagen: true } },
          solicitante: { select: { id: true, nombreCompleto: true } },
          resueltoPor: { select: { id: true, nombreCompleto: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.solicitudStock.count({ where }),
    ]);

    return { data, total, page, pageSize };
  } catch (error: unknown) {
    console.error("Error en getSolicitudesStock:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al obtener solicitudes de stock",
    };
  }
}

// ─── getNotificaciones ───────────────────────────────────────────────────

export async function getNotificaciones(limit: number = 20) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: session.userId },
      include: {
        solicitudStock: {
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            estado: true,
            producto: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(50, Math.max(1, limit)),
    });

    return { notificaciones };
  } catch (error: unknown) {
    console.error("Error en getNotificaciones:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al obtener notificaciones",
    };
  }
}

// ─── marcarNotificacionLeida ─────────────────────────────────────────────

export async function marcarNotificacionLeida(notificacionId: number) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    // Verify ownership + update atomically
    const updated = await prisma.notificacion.updateMany({
      where: { id: notificacionId, usuarioId: session.userId },
      data: { leida: true, readAt: new Date() },
    });

    if (updated.count === 0) {
      throw new Error("Notificación no encontrada o no pertenece al usuario.");
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en marcarNotificacionLeida:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al marcar notificación como leída",
    };
  }
}

// ─── getContadorNotificaciones ───────────────────────────────────────────

export async function getContadorNotificaciones() {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const count = await prisma.notificacion.count({
      where: { usuarioId: session.userId, leida: false },
    });

    return { count };
  } catch (error: unknown) {
    console.error("Error en getContadorNotificaciones:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al obtener contador de notificaciones",
    };
  }
}

// ─── marcarTodasLeidas ─────────────────────────────────────────────────

export async function marcarTodasLeidas() {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    await prisma.notificacion.updateMany({
      where: { usuarioId: session.userId, leida: false },
      data: { leida: true, readAt: new Date() },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en marcarTodasLeidas:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al marcar todas las notificaciones como leídas",
    };
  }
}
