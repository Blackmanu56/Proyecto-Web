"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";

export type VentaCliente = {
  id: number;
  fecha: string;
  total: number;
  estado: string;
  metodoPago: string | null;
  tipoComprobante: string | null;
  cuotas: number | null;
  vendedor: string;
  productos: number;
  detalles: {
    id: number;
    producto: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
};

export type ClienteConVentas = {
  id: number;
  nombre: string;
  dni: string;
  cuit: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  activo: boolean;
  creadoEn: Date;
  _count: {
    ventas: number;
  };
  _sum: {
    ventas: number | null;
  };
};

/**
 * Obtener todos los clientes con opción de búsqueda y filtro por estado activo.
 */
export async function getClientes(
  query: string = "",
  soloActivos: boolean = true
): Promise<ClienteConVentas[]> {
  try {
    await requirePermission("clientes.ver", await getSession());
    const whereClause: Prisma.ClienteWhereInput = {};

    if (soloActivos) {
      whereClause.activo = true;
    }

    if (query) {
      whereClause.OR = [
        { nombre: { contains: query, mode: "insensitive" } },
        { dni: { contains: query, mode: "insensitive" } },
        { cuit: { contains: query, mode: "insensitive" } },
        { telefono: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.cliente.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            ventas: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    const ventasTotals = await prisma.venta.groupBy({
      by: ["clienteId"],
      _sum: { total: true },
      where: { clienteId: { in: rows.map((r) => r.id) } },
    });

    const totalsMap = new Map(
      ventasTotals.map((t) => [t.clienteId, t._sum.total ?? 0])
    );

    return rows.map((r): ClienteConVentas => ({
      ...r,
      _sum: { ventas: totalsMap.get(r.id) ?? 0 },
    }));
  } catch (error) {
    console.error("Error en getClientes:", error);
    return [];
  }
}

/**
 * Crear un nuevo cliente.
 */
export async function crearCliente(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePermission("clientes.crear", await getSession());
    const nombre = formData.get("nombre") as string;
    const dni = formData.get("dni") as string;
    const cuit = (formData.get("cuit") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const direccion = (formData.get("direccion") as string) || null;
    const email = (formData.get("email") as string) || null;

    if (!nombre || !dni) {
      return { error: "El nombre y el DNI son obligatorios." };
    }

    // Validar DNI único
    const existingDni = await prisma.cliente.findUnique({
      where: { dni },
    });
    if (existingDni) {
      return { error: "El DNI ya se encuentra registrado por otro cliente." };
    }

    // Validar CUIT único si se proporciona
    if (cuit) {
      const existingCuit = await prisma.cliente.findUnique({
        where: { cuit },
      });
      if (existingCuit) {
        return { error: "El CUIT ya se encuentra registrado por otro cliente." };
      }
    }

    await prisma.cliente.create({
      data: {
        nombre,
        dni,
        cuit,
        telefono,
        direccion,
        email,
        activo: true,
      },
    });

    revalidatePath("/clientes");
    revalidatePath("/ventas");
    return { success: true };
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return { error: "Error interno al registrar el cliente." };
  }
}

/**
 * Actualizar un cliente existente.
 */
export async function actualizarCliente(
  id: number,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePermission("clientes.editar", await getSession());
    const nombre = formData.get("nombre") as string;
    const dni = formData.get("dni") as string;
    const cuit = (formData.get("cuit") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const direccion = (formData.get("direccion") as string) || null;
    const email = (formData.get("email") as string) || null;

    if (!nombre || !dni) {
      return { error: "El nombre y el DNI son obligatorios." };
    }

    // Validar DNI único (excluyendo el actual)
    const existingDni = await prisma.cliente.findFirst({
      where: { dni, NOT: { id } },
    });
    if (existingDni) {
      return { error: "El DNI ingresado ya está registrado para otro cliente." };
    }

    // Validar CUIT único si se proporciona (excluyendo el actual)
    if (cuit) {
      const existingCuit = await prisma.cliente.findFirst({
        where: { cuit, NOT: { id } },
      });
      if (existingCuit) {
        return { error: "El CUIT ingresado ya está registrado para otro cliente." };
      }
    }

    await prisma.cliente.update({
      where: { id },
      data: {
        nombre,
        dni,
        cuit,
        telefono,
        direccion,
        email,
      },
    });

    revalidatePath("/clientes");
    revalidatePath("/ventas");
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    return { error: "Error interno al actualizar el cliente." };
  }
}

/**
 * Alternar el estado activo/inactivo (baja lógica).
 * Restringe la reactivación a usuarios administradores.
 */
export async function toggleEstadoCliente(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requirePermission("clientes.estado", await getSession());
    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      return { error: "Cliente no encontrado." };
    }

    // Restricción: Si el cliente está INACTIVO y se lo quiere activar, sólo ADMIN puede hacerlo
    if (!cliente.activo && session.role !== "ADMINISTRADOR") {
      return {
        error: "Permisos insuficientes: Solo un Administrador puede reactivar un cliente desactivado.",
      };
    }

    await prisma.cliente.update({
      where: { id },
      data: {
        activo: !cliente.activo,
      },
    });

    revalidatePath("/clientes");
    revalidatePath("/ventas");
    return { success: true };
  } catch (error) {
    console.error("Error al cambiar estado del cliente:", error);
    return { error: "Error interno al cambiar el estado del cliente." };
  }
}

/**
 * Obtener todas las ventas de un cliente específico con sus detalles.
 */
export async function getVentasCliente(
  clienteId: number
): Promise<VentaCliente[]> {
  try {
    await requirePermission("clientes.historial", await getSession());
    const ventas = await prisma.venta.findMany({
      where: { clienteId },
      include: {
        detalles: {
          include: {
            producto: { select: { nombre: true } },
          },
        },
        usuario: { select: { nombreCompleto: true, username: true } },
      },
      orderBy: { fecha: "desc" },
    });

    return ventas.map((v) => ({
      id: v.id,
      fecha: v.fecha.toISOString(),
      total: Number(v.total),
      estado: v.estado,
      metodoPago: v.metodoPago,
      tipoComprobante: v.tipoComprobante,
      cuotas: v.cuotas,
      vendedor: v.usuario.nombreCompleto || v.usuario.username,
      productos: v.detalles.length,
      detalles: v.detalles.map((d) => ({
        id: d.id,
        producto: d.producto.nombre,
        cantidad: d.cantidad,
        precioUnitario: Number(d.precioUnitario),
        subtotal: Number(d.subtotal),
      })),
    }));
  } catch (error) {
    console.error("Error en getVentasCliente:", error);
    return [];
  }
}

/**
 * Eliminación física directa de la base de datos.
 * Bloquea la acción si el cliente tiene facturas de venta asociadas.
 */
export async function eliminarClienteReal(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePermission("clientes.estado", await getSession());
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ventas: true,
          },
        },
      },
    });

    if (!cliente) {
      return { error: "Cliente no encontrado." };
    }

    // Evitar eliminar físicamente si ya tiene compras registradas en el historial
    if (cliente._count.ventas > 0) {
      return {
        error:
          "No es posible eliminar este cliente del sistema porque tiene compras/ventas asociadas en su historial. Utilice la desactivación (Baja Lógica).",
      };
    }

    await prisma.cliente.delete({
      where: { id },
    });

    revalidatePath("/clientes");
    revalidatePath("/ventas");
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cliente físicamente:", error);
    return { error: "Error interno al intentar eliminar el cliente." };
  }
}
