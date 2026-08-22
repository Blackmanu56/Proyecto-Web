"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { evaluarYNotificarStock, verificarStockActual } from "@/lib/stock-notifications";
import { registrarMovimiento } from "@/lib/movimiento-producto";

// ─── verificarStockAlertas ───────────────────────────────────────────────
// Llamado por la campanita de notificaciones para asegurar que las
// alertas de stock crítico/agotado existan incluso si el stock ya
// estaba bajo antes de iniciar sesión.

export async function verificarStockAlertas() {
  await verificarStockActual();
}

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

    // Notify all active admins (respetando preferencias)
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
            titulo: "Nueva solicitud de stock",
            mensaje: `${session.username} solicita ${tipo === "RESTA" ? "resta" : "reposición"} de ${cantidad} unidades de '${producto.nombre}'${observacion ? `. Obs: ${observacion}` : ""}`,
            solicitudStockId: solicitud.id,
            productoId: productoId,
            entidad: "solicitud_stock",
          })),
        });
      }
    }

    // Notificar al solicitante que su solicitud fue creada
    const prefSolicitante = await prisma.preferenciaNotificacion.findUnique({
      where: { usuarioId_tipo: { usuarioId: session.userId, tipo: "SOLICITUD_CREADA" } },
    });
    if (prefSolicitante?.habilitada !== false) {
      await prisma.notificacion.create({
        data: {
          usuarioId: session.userId,
          tipo: "SOLICITUD_CREADA",
          titulo: "Solicitud enviada",
          mensaje: `Tu solicitud de ${tipo === "RESTA" ? "resta" : "reposición"} de ${cantidad} unidades de '${producto.nombre}' fue enviada y está pendiente de aprobación.`,
          solicitudStockId: solicitud.id,
          productoId: productoId,
          entidad: "solicitud_stock",
        },
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

    const txResult = await prisma.$transaction(async (tx) => {
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

      // Auditoría: registrar movimiento de producto
      await registrarMovimiento(tx, {
        productoId: solicitud.productoId,
        tipo: solicitud.tipo === "RESTA" ? "SOLICITUD_RESTA_APROBADA" : "REPOSICION_APROBADA",
        cantidadAnterior: stockAnterior,
        cantidadNueva: stockNuevo,
        motivo: `Solicitud de ${solicitud.tipo === "RESTA" ? "resta" : "reposición"} #${solicitud.id} aprobada`,
        observacion: observacion ?? undefined,
        usuarioId: session.userId,
      });

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

      // Notify the solicitante (respetando preferencias)
      const prefAprobada = await prisma.preferenciaNotificacion.findUnique({
        where: { usuarioId_tipo: { usuarioId: solicitud.solicitanteId, tipo: "SOLICITUD_APROBADA" } },
      });
      if (prefAprobada?.habilitada !== false) {
        await tx.notificacion.create({
          data: {
            usuarioId: solicitud.solicitanteId,
            tipo: "SOLICITUD_APROBADA",
            titulo: "Solicitud de stock aprobada",
            mensaje: `Tu solicitud de ${solicitud.tipo === "RESTA" ? "resta" : "reposición"} de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue aprobada. Stock: ${stockAnterior} → ${stockNuevo}.`,
            solicitudStockId: solicitud.id,
            productoId: solicitud.productoId,
            entidad: "solicitud_stock",
          },
        });
      }

      return { stockAnterior, stockNuevo, productoId: solicitud.productoId, tipo: solicitud.tipo, usuarioId: solicitud.solicitanteId, username: session.username };
    });

    revalidatePath("/productos");
    revalidatePath("/solicitudes-stock");

    // Evaluar stock y crear notificaciones de stock (fuera de la transacción)
    await evaluarYNotificarStock({
      productoId: txResult.productoId,
      cantidadAnterior: txResult.stockAnterior,
      cantidadNueva: txResult.stockNuevo,
      usuarioId: txResult.usuarioId,
      usuarioNombre: txResult.username,
      tipoMovimiento: txResult.tipo === "RESTA" ? "SOLICITUD_RESTA_APROBADA" : "SOLICITUD_REPOSICION_APROBADA",
      motivo: `Solicitud de ${txResult.tipo === "RESTA" ? "resta" : "reposición"} aprobada`,
    });

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

      // Notify the solicitante (respetando preferencias)
      const prefRechazada = await prisma.preferenciaNotificacion.findUnique({
        where: { usuarioId_tipo: { usuarioId: solicitud.solicitanteId, tipo: "SOLICITUD_RECHAZADA" } },
      });
      if (prefRechazada?.habilitada !== false) {
        await tx.notificacion.create({
          data: {
            usuarioId: solicitud.solicitanteId,
            tipo: "SOLICITUD_RECHAZADA",
            titulo: "Solicitud de stock rechazada",
            mensaje: `Tu solicitud de ${solicitud.tipo === "RESTA" ? "resta" : "reposición"} de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue rechazada. Motivo: ${motivo}`,
            solicitudStockId: solicitud.id,
            productoId: solicitud.productoId,
            entidad: "solicitud_stock",
          },
        });
      }
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

// ─── cancelarSolicitudStock ─────────────────────────────────────────────

export async function cancelarSolicitudStock(
  solicitudId: number,
  motivo?: string
) {
  try {
    const session = await requirePermission("productos.solicitar_stock");

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      throw new Error("El ID de la solicitud debe ser un número entero válido.");
    }

    const solicitud = await prisma.solicitudStock.findUnique({
      where: { id: solicitudId },
      include: { producto: { select: { nombre: true } } },
    });

    if (!solicitud) {
      throw new Error("Solicitud no encontrada.");
    }

    // Solo el solicitante puede cancelar su propia solicitud
    if (solicitud.solicitanteId !== session.userId) {
      throw new Error("No tiene permisos para cancelar esta solicitud.");
    }

    // Solo se puede cancelar si está pendiente
    if (solicitud.estado !== "PENDIENTE") {
      throw new Error("Solo se pueden cancelar solicitudes pendientes.");
    }

    await prisma.solicitudStock.update({
      where: { id: solicitudId },
      data: {
        estado: "CANCELADA",
        resueltoPorId: session.userId,
        observacionResolucion: motivo ?? "Cancelada por el solicitante",
        resolvedAt: new Date(),
      },
    });

    revalidatePath("/pedidos");
    revalidatePath("/productos");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en cancelarSolicitudStock:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al cancelar solicitud de stock",
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
          producto: { select: { id: true, nombre: true, cantidad: true, imagen: true } },
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
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        leida: true,
        createdAt: true,
        entidad: true,
        solicitudStockId: true,
        solicitudReposicionId: true,
        productoId: true,
        solicitudStock: {
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            estado: true,
            producto: { select: { nombre: true } },
          },
        },
        solicitudReposicion: {
          select: {
            id: true,
            cantidad: true,
            estado: true,
            producto: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(50, Math.max(1, limit)),
    });

    console.log(`[getNotificaciones] User ${session.userId}: found ${notificaciones.length} notifications. Types: ${notificaciones.map((n) => n.tipo).join(", ")}`);
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

// ─── eliminarNotificacionesLeidas ───────────────────────────────────────

export async function eliminarNotificacionesLeidas() {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const deleted = await prisma.notificacion.deleteMany({
      where: { usuarioId: session.userId, leida: true },
    });

    revalidatePath("/notificaciones");
    return { success: true, deleted: deleted.count };
  } catch (error: unknown) {
    console.error("Error en eliminarNotificacionesLeidas:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al eliminar notificaciones leídas",
    };
  }
}

// ─── descartarNotificacion ─────────────────────────────────────────────

export async function descartarNotificacion(notificacionId: number) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const deleted = await prisma.notificacion.deleteMany({
      where: { id: notificacionId, usuarioId: session.userId },
    });

    if (deleted.count === 0) {
      throw new Error("Notificación no encontrada o no pertenece al usuario.");
    }

    revalidatePath("/notificaciones");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en descartarNotificacion:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al descartar notificación",
    };
  }
}

// ─── getNotificacionesPaginadas ─────────────────────────────────────────

interface NotificacionesFilters {
  busqueda?: string;
  tipo?: string;
  soloNoLeidas?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getNotificacionesPaginadas(filters: NotificacionesFilters = {}) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { usuarioId: session.userId };

    if (filters.soloNoLeidas) {
      where.leida = false;
    }

    if (filters.tipo) {
      where.tipo = filters.tipo;
    }

    if (filters.busqueda) {
      where.OR = [
        { titulo: { contains: filters.busqueda, mode: "insensitive" } },
        { mensaje: { contains: filters.busqueda, mode: "insensitive" } },
      ];
    }

    const [data, total, noLeidas] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          leida: true,
          createdAt: true,
          entidad: true,
          solicitudStockId: true,
          solicitudReposicionId: true,
          productoId: true,
          solicitudStock: {
            select: {
              id: true,
              tipo: true,
              cantidad: true,
              estado: true,
              producto: { select: { nombre: true } },
            },
          },
          solicitudReposicion: {
            select: {
              id: true,
              cantidad: true,
              estado: true,
              producto: { select: { nombre: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.notificacion.count({ where }),
      prisma.notificacion.count({ where: { usuarioId: session.userId, leida: false } }),
    ]);

    return { data, total, noLeidas, page, pageSize };
  } catch (error: unknown) {
    console.error("Error en getNotificacionesPaginadas:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al obtener notificaciones",
    };
  }
}

// ─── Preferencias de notificación ──────────────────────────────────────

const TIPOS_NOTIFICACION = [
  "SOLICITUD_CREADA",
  "SOLICITUD_APROBADA",
  "SOLICITUD_RECHAZADA",
  "STOCK_CRITICO",
  "STOCK_AGOTADO",
  "STOCK_RESTADO",
  "STOCK_RECARGADO",
] as const;

export async function getPreferenciasNotificacion() {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    const preferencias = await prisma.preferenciaNotificacion.findMany({
      where: { usuarioId: session.userId },
    });

    // Mapa tipo -> habilitada (default true si no existe registro)
    const mapa: Record<string, boolean> = {};
    for (const tipo of TIPOS_NOTIFICACION) {
      const pref = preferencias.find((p) => p.tipo === tipo);
      mapa[tipo] = pref?.habilitada ?? true;
    }

    return { preferencias: mapa };
  } catch (error: unknown) {
    console.error("Error en getPreferenciasNotificacion:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al obtener preferencias de notificación",
    };
  }
}

export async function togglePreferenciaNotificacion(tipo: string, habilitada: boolean) {
  try {
    const session = await getSession();
    if (!session) throw new Error("No autenticado.");

    if (!TIPOS_NOTIFICACION.includes(tipo as typeof TIPOS_NOTIFICACION[number])) {
      throw new Error("Tipo de notificación inválido.");
    }

    await prisma.preferenciaNotificacion.upsert({
      where: {
        usuarioId_tipo: {
          usuarioId: session.userId,
          tipo: tipo as typeof TIPOS_NOTIFICACION[number],
        },
      },
      update: { habilitada },
      create: {
        usuarioId: session.userId,
        tipo: tipo as typeof TIPOS_NOTIFICACION[number],
        habilitada,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en togglePreferenciaNotificacion:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Error al actualizar preferencia de notificación",
    };
  }
}
