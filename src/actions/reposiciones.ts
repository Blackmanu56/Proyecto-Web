"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import type { TokenPayload } from "@/lib/jwt";
import {
  ejecutarReposicion,
  failBusiness,
  pagoSchema,
  ProductoBusinessError,
  type PagoValidado,
  type ReposicionTx,
} from "@/lib/reposicion";
import type { OrigenPagoCompraValue } from "@/lib/caja-ajuste";
import { registrarMovimiento } from "@/lib/movimiento-producto";
import { evaluarYNotificarStock } from "@/lib/stock-notifications";

// ─── Shared error handling ────────────────────────────────────────────────

const REPOSICION_TECHNICAL_ERROR =
  "No se pudo completar la operación. Intentá nuevamente.";

const EXPECTED_REPOSICION_ERRORS = new Set([
  "No autenticado.",
  "Usuario inactivo o no encontrado.",
  "Rol inactivo o sin permisos vigentes.",
  "No tiene permisos para realizar esta acción.",
]);

async function requireReposicionPermission(permission: string) {
  try {
    return await requirePermission(permission, await getSession());
  } catch (error) {
    if (
      error instanceof Error &&
      EXPECTED_REPOSICION_ERRORS.has(error.message)
    ) {
      failBusiness(error.message);
    }
    throw error;
  }
}

function reposicionActionError(error: unknown) {
  return error instanceof ProductoBusinessError
    ? error.message
    : REPOSICION_TECHNICAL_ERROR;
}

// ─── Input schemas ────────────────────────────────────────────────────────

const solicitarReposicionSchema = z.object({
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
  proveedorId: z.number().int().positive("Debe seleccionar un proveedor válido"),
  origenPago: z
    .enum(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA", "CUENTA_CORRIENTE_PROVEEDOR", "FONDOS_EXTERNOS"])
    .default("EFECTIVO_CAJA"),
  pagos: z.array(pagoSchema).optional(),
  motivo: z.string().optional(),
});

// ─── solicitarReposicion ──────────────────────────────────────────────────

export async function solicitarReposicion(
  productoId: number,
  input: {
    cantidad: number;
    proveedorId: number;
    origenPago?: OrigenPagoCompraValue;
    pagos?: PagoValidado[];
    motivo?: string;
  }
) {
  try {
    const session = await requireReposicionPermission("productos.reponer");

    const validation = solicitarReposicionSchema.safeParse(input);
    if (!validation.success) {
      failBusiness(validation.error.errors[0].message);
    }

    const { cantidad, proveedorId, origenPago, pagos, motivo } = validation.data;

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto) {
      failBusiness("Producto no encontrado");
    }
    if (!producto.activo) {
      failBusiness("No se pueden solicitar reposiciones para productos inactivos");
    }

    const solicitud = await prisma.solicitudReposicion.create({
      data: {
        productoId,
        cantidad,
        costoUnitario: producto.precioCompra,
        total: cantidad * producto.precioCompra,
        proveedorId,
        origenPago,
        pagos: pagos ?? undefined,
        motivo: motivo || undefined,
        estado: "PENDIENTE",
        solicitanteId: session.userId,
      },
    });

    // Notify all active admins about the new solicitud (respetando preferencias)
    if (prisma?.rol?.findMany) {
      try {
        const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
        const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");
        const admins = rolAdmin && prisma?.usuario?.findMany
          ? await prisma.usuario.findMany({
              where: { rolId: rolAdmin.id, activo: true },
              select: { id: true },
            })
          : [];
        if (admins.length > 0) {
          const adminIds = admins.map((a) => a.id);
          const prefs = prisma?.preferenciaNotificacion?.findMany
            ? await prisma.preferenciaNotificacion.findMany({
                where: { usuarioId: { in: adminIds }, tipo: "SOLICITUD_CREADA", habilitada: false },
                select: { usuarioId: true },
              })
            : [];
          const deshabilitados = new Set(prefs.map((p) => p.usuarioId));
          const adminsFiltrados = admins.filter((a) => !deshabilitados.has(a.id));

          if (adminsFiltrados.length > 0 && prisma?.notificacion?.createMany) {
            await prisma.notificacion.createMany({
              data: adminsFiltrados.map((admin) => ({
                usuarioId: admin.id,
                tipo: "SOLICITUD_CREADA",
                titulo: "Nuevo pedido de reposición",
                mensaje: `${session.username} solicita reposición de ${cantidad} unidades de '${producto.nombre}'`,
                solicitudReposicionId: solicitud.id,
                entidad: "reposicion",
              })),
            });
          }
        }
      } catch (notifErr) {
        console.error("Error al emitir notificaciones:", notifErr);
      }
    }

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en solicitarReposicion:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── reponerStockDirecto (ADMINISTRADOR only — no SolicitudReposicion) ─────

export async function reponerStockDirecto(
  productoId: number,
  input: {
    cantidad: number;
    proveedorId: number;
    origenPago?: OrigenPagoCompraValue;
    pagos?: PagoValidado[];
    motivo?: string;
  }
) {
  try {
    const session = await requireReposicionPermission("productos.reponer");

    const validation = solicitarReposicionSchema.safeParse(input);
    if (!validation.success) {
      failBusiness(validation.error.errors[0].message);
    }

    const { cantidad, proveedorId, origenPago, pagos } = validation.data;

    const resultado = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id: productoId } });
      if (!producto) failBusiness("Producto no encontrado");
      if (!producto.activo) failBusiness("No se pueden reposicionar productos inactivos");

      const stockAnterior = producto.cantidad;

      const txTyped = tx as unknown as ReposicionTx;
      const resultado = await ejecutarReposicion(txTyped, {
        productoId,
        nombreProducto: producto.nombre,
        cantidad,
        costoUnitario: producto.precioCompra,
        proveedorId,
        origenPago: origenPago as OrigenPagoCompraValue,
        pagos: pagos as PagoValidado[] | undefined,
        usuarioId: session.userId,
        descripcionPrefijo: `Reposición directa de '${producto.nombre}'`,
      });

      // Increment product stock
      await tx.producto.update({
        where: { id: productoId },
        data: { cantidad: { increment: cantidad } },
      });

      // Audit: register direct restock movement
      await registrarMovimiento(tx, {
        productoId,
        tipo: "REPOSICION_DIRECTA",
        cantidadAnterior: stockAnterior,
        cantidadNueva: stockAnterior + cantidad,
        compraId: resultado.compraId,
        motivo: `Reposición directa de '${producto.nombre}'`,
        usuarioId: session.userId,
      });

      return { ...resultado, stockAnterior, nombreProducto: producto.nombre };
    });

    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }

    // Evaluar stock y crear notificaciones
    await evaluarYNotificarStock({
      productoId,
      cantidadAnterior: resultado.stockAnterior,
      cantidadNueva: resultado.stockAnterior + cantidad,
      usuarioId: session.userId,
      usuarioNombre: session.username,
      tipoMovimiento: "REPOSICION_DIRECTA",
      motivo: `Reposición directa de '${resultado.nombreProducto}'`,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en reponerStockDirecto:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── aprobarReposicion ────────────────────────────────────────────────────

export async function aprobarReposicion(
  id: number,
  medioPago?: "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA"
) {
  try {
    const session = await requireReposicionPermission("productos.aprobar_reposicion");

    const resultado = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudReposicion.findUnique({
        where: { id },
        include: { producto: true, solicitante: { select: { username: true } } },
      });

      if (!solicitud) {
        failBusiness("Solicitud no encontrada");
      }
      if (solicitud.estado !== "PENDIENTE") {
        failBusiness(
          `La solicitud está en estado "${solicitud.estado}". Solo se pueden aprobar solicitudes pendientes.`
        );
      }
      if (!solicitud.producto.activo) {
        failBusiness("Producto inactivo.");
      }

      // Admin chooses payment method at approval time (defaults to EFECTIVO_CAJA)
      const origenPagoFinal = medioPago ?? "EFECTIVO_CAJA";
      const totalCosto = solicitud.cantidad * solicitud.costoUnitario;
      const pagosFinales: PagoValidado[] = [
        { medio: origenPagoFinal, monto: totalCosto },
      ];

      // Execute via helper (validates funds + writes compra/movimientos)
      // Use solicitanteId so caja/banco records reflect who ACTUALLY restocked
      const txTyped = tx as unknown as ReposicionTx;
      const resultado = await ejecutarReposicion(txTyped, {
        productoId: solicitud.productoId,
        nombreProducto: solicitud.producto.nombre,
        cantidad: solicitud.cantidad,
        costoUnitario: solicitud.costoUnitario,
        proveedorId: solicitud.proveedorId,
        origenPago: origenPagoFinal,
        pagos: pagosFinales,
        usuarioId: solicitud.solicitanteId,
        descripcionPrefijo: `Reposición de '${solicitud.producto.nombre}'`,
      });

      // Increment product stock
      await tx.producto.update({
        where: { id: solicitud.productoId },
        data: { cantidad: { increment: solicitud.cantidad } },
      });

      // Audit: register approved restock movement (solicitante = who restocked)
      await registrarMovimiento(tx, {
        productoId: solicitud.productoId,
        tipo: "REPOSICION_APROBADA",
        cantidadAnterior: solicitud.producto.cantidad,
        cantidadNueva: solicitud.producto.cantidad + solicitud.cantidad,
        compraId: resultado.compraId,
        motivo: `Reposición aprobada — ${solicitud.producto.nombre}`,
        usuarioId: solicitud.solicitanteId,
      });

      // Mark solicitud as APROBADA
      await tx.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "APROBADA",
          aprobadorId: session.userId,
          compraId: resultado.compraId,
          resueltoEn: new Date(),
        },
      });

      // Notify the employee that their solicitud was approved (respetando preferencias)
      if (prisma?.preferenciaNotificacion?.findUnique && (tx as any)?.notificacion?.create) {
        try {
          const prefAprobada = await prisma.preferenciaNotificacion.findUnique({
            where: { usuarioId_tipo: { usuarioId: solicitud.solicitanteId, tipo: "SOLICITUD_APROBADA" } },
          });
          if (prefAprobada?.habilitada !== false) {
            await (tx as any).notificacion.create({
              data: {
                usuarioId: solicitud.solicitanteId,
                tipo: "SOLICITUD_APROBADA",
                titulo: "Pedido aprobado",
                mensaje: `Tu reposición de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue aprobada. Stock: ${solicitud.producto.cantidad} → ${solicitud.producto.cantidad + solicitud.cantidad}.`,
                solicitudReposicionId: solicitud.id,
                entidad: "reposicion",
              },
            });
          }
        } catch (notifErr) {
          console.error("Error al notificar aprobación:", notifErr);
        }
      }

      return {
        ...resultado,
        stockAnterior: solicitud.producto.cantidad,
        stockNuevo: solicitud.producto.cantidad + solicitud.cantidad,
        productoId: solicitud.productoId,
        productoNombre: solicitud.producto.nombre,
        solicitanteId: solicitud.solicitanteId,
        solicitanteNombre: solicitud.solicitante?.username ?? "admin",
      };
    });

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }

    // Evaluar stock y crear notificaciones
    await evaluarYNotificarStock({
      productoId: resultado.productoId,
      cantidadAnterior: resultado.stockAnterior,
      cantidadNueva: resultado.stockNuevo,
      usuarioId: resultado.solicitanteId,
      usuarioNombre: resultado.solicitanteNombre,
      tipoMovimiento: "REPOSICION_APROBADA",
      motivo: `Reposición aprobada — ${resultado.productoNombre}`,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en aprobarReposicion:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── rechazarReposicion ───────────────────────────────────────────────────

export async function rechazarReposicion(id: number, respuesta: string) {
  try {
    await requireReposicionPermission("productos.aprobar_reposicion");

    await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudReposicion.findUnique({
        where: { id },
        include: { producto: true },
      });

      if (!solicitud) {
        failBusiness("Solicitud no encontrada");
      }
      if (solicitud.estado !== "PENDIENTE") {
        failBusiness(
          `La solicitud está en estado "${solicitud.estado}". Solo se pueden rechazar solicitudes pendientes.`
        );
      }

      await tx.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "RECHAZADA",
          respuesta,
          resueltoEn: new Date(),
        },
      });

      // Notify the employee that their solicitud was rejected (respetando preferencias)
      if (prisma?.preferenciaNotificacion?.findUnique && (tx as any)?.notificacion?.create) {
        try {
          const prefRechazada = await prisma.preferenciaNotificacion.findUnique({
            where: { usuarioId_tipo: { usuarioId: solicitud.solicitanteId, tipo: "SOLICITUD_RECHAZADA" } },
          });
          if (prefRechazada?.habilitada !== false) {
            await (tx as any).notificacion.create({
              data: {
                usuarioId: solicitud.solicitanteId,
                tipo: "SOLICITUD_RECHAZADA",
                titulo: "Pedido rechazado",
                mensaje: `Tu reposición de ${solicitud.cantidad} unidades de '${solicitud.producto.nombre}' fue rechazada. Motivo: ${respuesta}`,
                solicitudReposicionId: solicitud.id,
                entidad: "reposicion",
              },
            });
          }
        } catch (notifErr) {
          console.error("Error al notificar rechazo:", notifErr);
        }
      }
    });

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en rechazarReposicion:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── crearYaprobarReposicion (ADMINISTRADOR only — atomic create+approve) ─

export async function crearYaprobarReposicion(
  productoId: number,
  input: {
    cantidad: number;
    proveedorId: number;
    origenPago?: OrigenPagoCompraValue;
    pagos?: PagoValidado[];
    motivo?: string;
  }
) {
  try {
    const session = await requireReposicionPermission("productos.aprobar_reposicion");

    const validation = solicitarReposicionSchema.safeParse(input);
    if (!validation.success) {
      failBusiness(validation.error.errors[0].message);
    }

    const { cantidad, proveedorId, origenPago, pagos, motivo } = validation.data;

    const resultado = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id: productoId } });
      if (!producto) failBusiness("Producto no encontrado");
      if (!producto.activo) {
        failBusiness("No se pueden solicitar reposiciones para productos inactivos");
      }

      // Create solicitud (momentarily PENDIENTE for referential integrity)
      const solicitud = await tx.solicitudReposicion.create({
        data: {
          productoId,
          cantidad,
          costoUnitario: producto.precioCompra,
          total: cantidad * producto.precioCompra,
          proveedorId,
          origenPago,
          pagos: pagos ?? undefined,
          motivo: motivo || undefined,
          estado: "PENDIENTE",
          solicitanteId: session.userId,
        },
      });

      // Validate pagos snapshot
      let validatedPagos: PagoValidado[] | undefined;
      if (solicitud.pagos && Array.isArray(solicitud.pagos)) {
        validatedPagos = z.array(pagoSchema).parse(solicitud.pagos);
      }

      // Execute financial transaction
      const txTyped = tx as unknown as ReposicionTx;
      const finalPagos =
        validatedPagos && validatedPagos.length > 0
          ? validatedPagos
          : origenPago
          ? [{ medio: origenPago as "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA", monto: cantidad * producto.precioCompra }]
          : undefined;

      const execResult = await ejecutarReposicion(txTyped, {
        productoId,
        nombreProducto: producto.nombre,
        cantidad,
        costoUnitario: producto.precioCompra,
        proveedorId,
        origenPago: origenPago as OrigenPagoCompraValue,
        pagos: finalPagos,
        usuarioId: session.userId,
        descripcionPrefijo: `Reposición de '${producto.nombre}' (crear y aprobar)`,
      });

      // Increment product stock
      await tx.producto.update({
        where: { id: productoId },
        data: { cantidad: { increment: cantidad } },
      });

      // Audit: register approved restock movement
      await registrarMovimiento(tx, {
        productoId,
        tipo: "REPOSICION_APROBADA",
        cantidadAnterior: producto.cantidad,
        cantidadNueva: producto.cantidad + cantidad,
        compraId: execResult.compraId,
        motivo: `Reposición de '${producto.nombre}' (crear y aprobar)`,
        usuarioId: session.userId,
      });

      // Mark solicitud as APROBADA
      await tx.solicitudReposicion.update({
        where: { id: solicitud.id },
        data: {
          estado: "APROBADA",
          aprobadorId: session.userId,
          compraId: execResult.compraId,
          resueltoEn: new Date(),
        },
      });

      return {
        ...execResult,
        stockAnterior: producto.cantidad,
        stockNuevo: producto.cantidad + cantidad,
        nombreProducto: producto.nombre,
      };
    });

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }

    // Evaluar stock y crear notificaciones
    await evaluarYNotificarStock({
      productoId,
      cantidadAnterior: resultado.stockAnterior,
      cantidadNueva: resultado.stockNuevo,
      usuarioId: session.userId,
      usuarioNombre: session.username,
      tipoMovimiento: "REPOSICION_APROBADA",
      motivo: `Reposición de '${resultado.nombreProducto}' (crear y aprobar)`,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error en crearYaprobarReposicion:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── getSolicitudesReposicion ─────────────────────────────────────────────

interface GetSolicitudesParams {
  estado?: string;
  productoId?: number;
  solicitanteId?: number;
}

export async function getSolicitudesReposicion(filters: GetSolicitudesParams = {}) {
  try {
    const session = await getSession();
    if (!session) failBusiness("No autenticado.");

    let resolvedSession: TokenPayload;
    let enforcedSolicitanteId: number | undefined;

    try {
      // Try admin path first
      resolvedSession = await requirePermission("productos.aprobar_reposicion", session);
    } catch (error) {
      if (
        error instanceof Error &&
        EXPECTED_REPOSICION_ERRORS.has(error.message)
      ) {
        // Fallback to encargado path
        try {
          resolvedSession = await requirePermission("productos.reponer", session);
          enforcedSolicitanteId = resolvedSession.userId;
        } catch {
          failBusiness("Acceso Denegado");
        }
      } else {
        throw error;
      }
    }

    const where: Record<string, unknown> = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.productoId) where.productoId = filters.productoId;

    // Enforce server-side data isolation for ENCARGADO_STOCK
    if (enforcedSolicitanteId) {
      where.solicitanteId = enforcedSolicitanteId;
    } else if (filters.solicitanteId) {
      where.solicitanteId = filters.solicitanteId;
    }

    const solicitudes = await prisma.solicitudReposicion.findMany({
      where,
      include: {
        producto: true,
        proveedor: true,
        solicitante: true,
        aprobador: true,
        compra: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, solicitudes };
  } catch (error: unknown) {
    console.error("Error en getSolicitudesReposicion:", error);
    return { error: reposicionActionError(error) };
  }
}
