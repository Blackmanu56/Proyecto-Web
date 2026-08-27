"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";

/* ────────────────────── Types ────────────────────── */

export interface SolicitudUnificada {
  id: number;
  origen: "PRODUCTOS" | "CAJA";
  tipo: string;
  solicitanteId: number;
  solicitanteNombre: string;
  fecha: Date | string;
  estado: string;
  detalle: string;
  productoNombre?: string;
  cantidad?: number;
  monto?: number | null;
  motivo?: string | null;
  proveedorNombre?: string | null;
  origenTabla?: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja";
  producto?: {
    id: number;
    nombre: string;
    codigo?: string | null;
    imagen?: string | null;
    marca?: string | null;
    precioCompra: number;
    precioVenta: number;
    cantidad: number;
    activo: boolean;
    categoria?: { id: number; nombre: string };
    proveedor?: { id: number; nombre: string };
  };
}

/* ────────────────────── Fetch ────────────────────── */

export async function getSolicitudesUnificadas(
  overrideRole?: string,
  overrideUserId?: number
): Promise<{
  data?: SolicitudUnificada[];
  error?: string;
  userRole?: string;
}> {
  try {
    let role = overrideRole;
    let userId = overrideUserId;

    if (!role || userId === undefined) {
      const session = await getSession();
      if (!session) {
        return { error: "No autenticado." };
      }
      role = session.role;
      userId = session.userId;
    }

    const isAdmin = role === "ADMINISTRADOR";
    const isStock = role === "ENCARGADO_STOCK";
    const isVentas = role === "ENCARGADO_VENTAS";

    const queries: Promise<SolicitudUnificada[]>[] = [];

    /* ── 1. Solicitudes Stock (Resta + Reposición de SolicitudStock) ── */
    queries.push(
      (async () => {
        const where = isAdmin || isStock ? {} : { solicitanteId: userId };
        const solicitudes = await prisma.solicitudStock.findMany({
          where,
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
                imagen: true,
                marca: true,
                precioCompra: true,
                precioVenta: true,
                cantidad: true,
                activo: true,
                categoria: { select: { id: true, nombre: true } },
                proveedor: { select: { id: true, nombre: true } },
              },
            },
            solicitante: {
              select: { id: true, nombreCompleto: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return solicitudes.map((s) => ({
          id: s.id,
          origen: "PRODUCTOS" as const,
          tipo: s.tipo === "RESTA" ? "Producto-Resta" : "Producto-Reposición",
          solicitanteId: s.solicitanteId,
          solicitanteNombre: s.solicitante.nombreCompleto,
          fecha: s.createdAt,
          estado: s.estado,
          detalle: s.motivo,
          productoNombre: s.producto.nombre,
          proveedorNombre: s.producto.proveedor?.nombre ?? null,
          cantidad: s.cantidad,
          monto: s.producto.precioCompra ? s.producto.precioCompra * s.cantidad : null,
          motivo: s.motivo,
          origenTabla: "solicitud_stock" as const,
          producto: {
            id: s.producto.id,
            nombre: s.producto.nombre,
            codigo: s.producto.codigo,
            imagen: s.producto.imagen,
            marca: s.producto.marca,
            precioCompra: s.producto.precioCompra,
            precioVenta: s.producto.precioVenta,
            cantidad: s.producto.cantidad,
            activo: s.producto.activo,
            categoria: s.producto.categoria ?? undefined,
            proveedor: s.producto.proveedor ?? undefined,
          },
        }));
      })()
    );

    /* ── 2. Solicitudes Reposición (de SolicitudReposicion) ── */
    queries.push(
      (async () => {
        const where = isAdmin || isStock ? {} : { solicitanteId: userId };
        const solicitudes = await prisma.solicitudReposicion.findMany({
          where,
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
                imagen: true,
                marca: true,
                precioCompra: true,
                precioVenta: true,
                cantidad: true,
                activo: true,
                categoria: { select: { id: true, nombre: true } },
                proveedor: { select: { id: true, nombre: true } },
              },
            },
            proveedor: {
              select: { id: true, nombre: true },
            },
            solicitante: {
              select: { id: true, nombreCompleto: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return solicitudes.map((s) => ({
          id: s.id,
          origen: "PRODUCTOS" as const,
          tipo: "Producto-Reposición",
          solicitanteId: s.solicitanteId,
          solicitanteNombre: s.solicitante.nombreCompleto,
          fecha: s.createdAt,
          estado: s.estado,
          detalle: s.motivo || `Reposición de ${s.cantidad} unidades`,
          productoNombre: s.producto.nombre,
          proveedorNombre: s.proveedor?.nombre ?? s.producto.proveedor?.nombre ?? null,
          cantidad: s.cantidad,
          monto: s.total,
          motivo: s.motivo,
          origenTabla: "solicitud_reposicion" as const,
          producto: {
            id: s.producto.id,
            nombre: s.producto.nombre,
            codigo: s.producto.codigo,
            imagen: s.producto.imagen,
            marca: s.producto.marca,
            precioCompra: s.producto.precioCompra,
            precioVenta: s.producto.precioVenta,
            cantidad: s.producto.cantidad,
            activo: s.producto.activo,
            categoria: s.producto.categoria ?? undefined,
            proveedor: s.proveedor ?? s.producto.proveedor ?? undefined,
          },
        }));
      })()
    );

    /* ── 3. Solicitudes Caja (de SolicitudCaja) ── */
    queries.push(
      (async () => {
        const where = isAdmin || isVentas ? {} : { solicitanteId: userId };
        const solicitudes = await prisma.solicitudCaja.findMany({
          where,
          include: {
            solicitante: {
              select: { id: true, nombreCompleto: true },
            },
          },
          orderBy: { fechaSolicitud: "desc" },
        });

        const tipoLabels: Record<string, string> = {
          APERTURA: "Caja-Apertura",
          CIERRE: "Caja-Cierre",
          AJUSTE_EFECTIVO: "Caja-Ajuste efectivo",
          AJUSTE_BANCO: "Caja-Ajuste banco",
          EGRESO: "Caja-Egreso",
          GASTO: "Caja-Egreso",
        };

        return solicitudes.map((s) => ({
          id: s.id,
          origen: "CAJA" as const,
          tipo: tipoLabels[s.tipo] || `Caja-${s.tipo}`,
          solicitanteId: s.solicitanteId,
          solicitanteNombre: s.solicitante.nombreCompleto,
          fecha: s.fechaSolicitud,
          estado: s.estado,
          detalle:
            s.motivo ||
            (s.datosExtra
              ? `Monto: $${(s.monto ?? 0).toLocaleString("es-AR")}`
              : "—"),
          monto: s.monto,
          motivo: s.motivo,
          origenTabla: "solicitud_caja" as const,
        }));
      })()
    );

    const results = await Promise.all(queries);
    const all = results.flat();

    // Sort by date descending
    all.sort((a, b) => {
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return dateB - dateA;
    });

    return { data: all, userRole: role };
  } catch (error: unknown) {
    console.error("Error en getSolicitudesUnificadas:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener solicitudes",
    };
  }
}

/* ────────────────────── Unified Actions ────────────────────── */

import {
  aprobarSolicitudStock,
  rechazarSolicitudStock,
  cancelarSolicitudStock,
} from "./solicitudes-stock";
import {
  aprobarReposicion,
  rechazarReposicion,
} from "./reposiciones";
import {
  aprobarSolicitudCaja,
  rechazarSolicitudCaja,
} from "./caja";
import { revalidatePath } from "next/cache";

export async function aprobarSolicitudUnificada(
  id: number,
  origenTabla?: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja",
  formaPago?: "EFECTIVO" | "BANCO" | "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA"
) {
  try {
    if (origenTabla === "solicitud_stock") {
      const res = await aprobarSolicitudStock(id, formaPago);
      revalidatePath("/solicitudes");
      return res;
    }
    if (origenTabla === "solicitud_reposicion") {
      const medio = formaPago === "BANCO" || formaPago === "TRANSFERENCIA_BANCARIA" ? "TRANSFERENCIA_BANCARIA" : "EFECTIVO_CAJA";
      const res = await aprobarReposicion(id, medio);
      revalidatePath("/solicitudes");
      return res;
    }
    if (origenTabla === "solicitud_caja") {
      const res = await aprobarSolicitudCaja(id);
      revalidatePath("/solicitudes");
      return res;
    }
    return { error: "Tipo de solicitud no especificado." };
  } catch (error: unknown) {
    console.error("Error en aprobarSolicitudUnificada:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al aprobar la solicitud.",
    };
  }
}

export async function rechazarSolicitudUnificada(
  id: number,
  origenTabla: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja",
  motivo: string
) {
  try {
    if (!motivo || motivo.trim().length === 0) {
      return { error: "El motivo de rechazo es obligatorio." };
    }
    if (origenTabla === "solicitud_stock") {
      const res = await rechazarSolicitudStock(id, motivo);
      revalidatePath("/solicitudes");
      return res;
    }
    if (origenTabla === "solicitud_reposicion") {
      const res = await rechazarReposicion(id, motivo);
      revalidatePath("/solicitudes");
      return res;
    }
    if (origenTabla === "solicitud_caja") {
      const res = await rechazarSolicitudCaja(id, motivo);
      revalidatePath("/solicitudes");
      return res;
    }
    return { error: "Tipo de solicitud no especificado." };
  } catch (error: unknown) {
    console.error("Error en rechazarSolicitudUnificada:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al rechazar la solicitud.",
    };
  }
}

export async function cancelarSolicitudUnificada(
  id: number,
  origenTabla: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja",
  motivo?: string
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "No autenticado." };
    }

    if (origenTabla === "solicitud_stock") {
      const res = await cancelarSolicitudStock(id, motivo);
      revalidatePath("/solicitudes");
      return res;
    }

    if (origenTabla === "solicitud_reposicion") {
      const solicitud = await prisma.solicitudReposicion.findUnique({
        where: { id },
      });
      if (!solicitud) return { error: "Solicitud no encontrada." };
      if (solicitud.solicitanteId !== session.userId) {
        return { error: "No tiene permisos para cancelar esta solicitud." };
      }
      if (solicitud.estado !== "PENDIENTE") {
        return { error: "Solo se pueden cancelar solicitudes pendientes." };
      }
      await prisma.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "CANCELADA",
          respuesta: motivo ?? "Cancelada por el solicitante",
          resueltoEn: new Date(),
        },
      });
      revalidatePath("/solicitudes");
      revalidatePath("/pedidos");
      return { success: true };
    }

    if (origenTabla === "solicitud_caja") {
      const solicitud = await prisma.solicitudCaja.findUnique({
        where: { id },
      });
      if (!solicitud) return { error: "Solicitud no encontrada." };
      if (solicitud.solicitanteId !== session.userId) {
        return { error: "No tiene permisos para cancelar esta solicitud." };
      }
      if (solicitud.estado !== "PENDIENTE") {
        return { error: "Solo se pueden cancelar solicitudes pendientes." };
      }
      await prisma.solicitudCaja.update({
        where: { id },
        data: {
          estado: "CANCELADA",
          motivoRechazo: motivo ?? "Cancelada por el solicitante",
          fechaResolucion: new Date(),
        },
      });
      revalidatePath("/solicitudes");
      revalidatePath("/caja");
      return { success: true };
    }

    return { error: "Tipo de solicitud no especificado." };
  } catch (error: unknown) {
    console.error("Error en cancelarSolicitudUnificada:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al cancelar la solicitud.",
    };
  }
}
