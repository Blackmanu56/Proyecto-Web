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

// ─── Shared error handling ────────────────────────────────────────────────

const REPOSICION_TECHNICAL_ERROR =
  "No se pudo completar la operación. Intentá nuevamente.";

const EXPECTED_REPOSICION_ERRORS = new Set([
  "No autenticado.",
  "Usuario inactivo o no encontrado.",
  "Rol inactivo o sin permisos vigentes.",
  "No tiene permisos para realizar esta acci?n.",
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

    await prisma.solicitudReposicion.create({
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
        data: { cantidad: producto.cantidad + cantidad },
      });

      return resultado;
    });

    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en reponerStockDirecto:", error);
    return { error: reposicionActionError(error) };
  }
}

// ─── aprobarReposicion ────────────────────────────────────────────────────

export async function aprobarReposicion(id: number) {
  try {
    const session = await requireReposicionPermission("productos.aprobar_reposicion");

    const resultado = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudReposicion.findUnique({
        where: { id },
        include: { producto: true },
      });

      if (!solicitud) {
        failBusiness("Solicitud no encontrada");
      }
      if (solicitud.estado !== "PENDIENTE") {
        failBusiness(
          `La solicitud está en estado "${solicitud.estado}". Solo se pueden aprobar solicitudes pendientes.`
        );
      }

      // Re-validate pagos snapshot with zod (D5)
      let validatedPagos: PagoValidado[] | undefined;
      if (solicitud.pagos && Array.isArray(solicitud.pagos)) {
        validatedPagos = z.array(pagoSchema).parse(solicitud.pagos);
      }

      // Execute via helper (validates funds + writes compra/movimientos)
      const txTyped = tx as unknown as ReposicionTx;
      const resultado = await ejecutarReposicion(txTyped, {
        productoId: solicitud.productoId,
        nombreProducto: solicitud.producto.nombre,
        cantidad: solicitud.cantidad,
        costoUnitario: solicitud.costoUnitario,
        proveedorId: solicitud.proveedorId,
        origenPago: solicitud.origenPago as OrigenPagoCompraValue,
        pagos: validatedPagos,
        usuarioId: session.userId,
        descripcionPrefijo: `Reposición de '${solicitud.producto.nombre}'`,
      });

      // Increment product stock
      await tx.producto.update({
        where: { id: solicitud.productoId },
        data: { cantidad: solicitud.producto.cantidad + solicitud.cantidad },
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

      return resultado;
    });

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }
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
      const solicitud = await tx.solicitudReposicion.findUnique({ where: { id } });

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
      const execResult = await ejecutarReposicion(txTyped, {
        productoId,
        nombreProducto: producto.nombre,
        cantidad,
        costoUnitario: producto.precioCompra,
        proveedorId,
        origenPago: origenPago as OrigenPagoCompraValue,
        pagos: validatedPagos,
        usuarioId: session.userId,
        descripcionPrefijo: `Reposición de '${producto.nombre}' (crear y aprobar)`,
      });

      // Increment product stock
      await tx.producto.update({
        where: { id: productoId },
        data: { cantidad: producto.cantidad + cantidad },
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

      return execResult;
    });

    revalidatePath("/solicitudes");
    revalidatePath("/pedidos");
    revalidatePath("/productos");
    if (resultado.cajaMovimientoCreado || resultado.bancoMovimientoCreado) {
      revalidatePath("/caja");
    }
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
