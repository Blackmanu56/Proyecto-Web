"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";

export type ProveedorConDetalles = {
  id: number;
  nombre: string;
  contactoResponsable: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  cuit: string;
  activo: boolean;
  creadoEn: Date;
  _count: {
    productos: number;
    compras: number;
  };
};

export type CompraConDetalles = {
  id: number;
  fecha: Date;
  total: number;
  usuario: {
    nombreCompleto: string;
    username: string;
  };
  detalles: {
    id: number;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
    producto: {
      nombre: string;
    };
  }[];
};

// Get all suppliers
export async function getProveedores(
  query: string = "",
  soloActivos: boolean = true
): Promise<ProveedorConDetalles[]> {
  const where: any = {};

  if (soloActivos) {
    where.activo = true;
  }

  if (query) {
    where.OR = [
      { nombre: { contains: query, mode: "insensitive" } },
      { cuit: { contains: query, mode: "insensitive" } },
      { contactoResponsable: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  return (await prisma.proveedor.findMany({
    where,
    include: {
      _count: {
        select: {
          productos: true,
          compras: true,
        },
      },
    },
    orderBy: { id: "asc" },
  })) as any;
}

// Create a new supplier
export async function crearProveedor(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Verificar permisos
    await requirePermission("proveedores.crear");

    const nombre = formData.get("nombre") as string;
    const contactoResponsable = (formData.get("contactoResponsable") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const direccion = (formData.get("direccion") as string) || null;
    const email = (formData.get("email") as string) || null;
    const cuit = formData.get("cuit") as string;

    if (!nombre || !cuit) {
      return { error: "El nombre y el CUIT son obligatorios." };
    }

    // Check unique CUIT
    const existingCuit = await prisma.proveedor.findUnique({ where: { cuit } });
    if (existingCuit) {
      return { error: "El CUIT ya est├í registrado por otro proveedor." };
    }

    // Check unique Email if provided
    if (email) {
      const existingEmail = await prisma.proveedor.findFirst({
        where: { email },
      });
      if (existingEmail) {
        return { error: "El correo electr├│nico ya est├í registrado." };
      }
    }

    await prisma.proveedor.create({
      data: {
        nombre,
        contactoResponsable,
        telefono,
        direccion,
        email,
        cuit,
      },
    });

    revalidatePath("/proveedores");
    return { success: true };
  } catch (error: any) {
    console.error("Error al crear proveedor:", error);
    return { error: "Error interno al crear el proveedor." };
  }
}

// Update an existing supplier
export async function actualizarProveedor(
  id: number,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Verificar permisos
    await requirePermission("proveedores.editar");

    const nombre = formData.get("nombre") as string;
    const contactoResponsable = (formData.get("contactoResponsable") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const direccion = (formData.get("direccion") as string) || null;
    const email = (formData.get("email") as string) || null;
    const cuit = formData.get("cuit") as string;

    if (!nombre || !cuit) {
      return { error: "El nombre y el CUIT son obligatorios." };
    }

    // Check unique CUIT excluding current
    const existingCuit = await prisma.proveedor.findFirst({
      where: { cuit, NOT: { id } },
    });
    if (existingCuit) {
      return { error: "El CUIT ya est├í registrado por otro proveedor." };
    }

    // Check unique Email excluding current if provided
    if (email) {
      const existingEmail = await prisma.proveedor.findFirst({
        where: { email, NOT: { id } },
      });
      if (existingEmail) {
        return { error: "El correo electr├│nico ya est├í registrado por otro proveedor." };
      }
    }

    await prisma.proveedor.update({
      where: { id },
      data: {
        nombre,
        contactoResponsable,
        telefono,
        direccion,
        email,
        cuit,
      },
    });

    revalidatePath("/proveedores");
    return { success: true };
  } catch (error: any) {
    console.error("Error al actualizar proveedor:", error);
    return { error: "Error interno al actualizar el proveedor." };
  }
}

// Logical delete (baja l├│gica)
export async function toggleEstadoProveedor(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Verificar permisos
    await requirePermission("proveedores.estado");

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) {
      return { error: "Proveedor no encontrado." };
    }

    await prisma.proveedor.update({
      where: { id },
      data: { activo: !proveedor.activo },
    });

    revalidatePath("/proveedores");
    return { success: true };
  } catch (error: any) {
    console.error("Error al cambiar estado de proveedor:", error);
    return { error: "Error interno al cambiar el estado del proveedor." };
  }
}

// Hard delete from database
export async function eliminarProveedorReal(
  id: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Verificar permisos (solo administradores pueden eliminar definitivamente)
    await requirePermission("proveedores.estado");

    const proveedor = await prisma.proveedor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productos: true,
            compras: true,
          },
        },
      },
    });

    if (!proveedor) {
      return { error: "Proveedor no encontrado." };
    }

    // If there are related products or purchases, prevent hard deletion
    if (proveedor._count.productos > 0 || proveedor._count.compras > 0) {
      return {
        error:
          "No se puede eliminar f├¡sicamente este proveedor porque tiene productos asociados o historial de compras. Utilice la 'Baja L├│gica' en su lugar para desactivarlo.",
      };
    }

    await prisma.proveedor.delete({
      where: { id },
    });

    revalidatePath("/proveedores");
    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar proveedor f├¡sicamente:", error);
    return { error: "Error interno al eliminar el proveedor." };
  }
}

// Consult supplier restock history (compras)
export async function getHistorialAbastecimiento(
  proveedorId: number
): Promise<CompraConDetalles[]> {
  try {
    const compras = await prisma.compra.findMany({
      where: { proveedorId },
      include: {
        usuario: {
          select: {
            nombreCompleto: true,
            username: true,
          },
        },
        detalles: {
          include: {
            producto: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return compras as any;
  } catch (error: any) {
    console.error("Error al obtener historial de abastecimiento:", error);
    return [];
  }
}

// Get all products linked to a supplier
export async function getProveedorProductos(proveedorId: number) {
  try {
    return await prisma.producto.findMany({
      where: { proveedorId },
      include: {
        categoria: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener productos del proveedor:", error);
    return [];
  }
}
