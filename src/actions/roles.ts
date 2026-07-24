"use server";

import { prisma } from "@/lib/prisma";
import { parseRoleData, serializeRoleData, DEFAULT_ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, getAllPermissions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";

export type RolCompleto = {
  id: number;
  nombre: string;
  activo: boolean;
  descripcion: string;
  permisos: string[];
  _count: { usuarios: number };
};

export async function getRolesCompletos(): Promise<RolCompleto[]> {
  const roles = await prisma.rol.findMany({
    include: { _count: { select: { usuarios: true } } },
    orderBy: { nombre: "asc" },
  });

  return roles.map(r => {
    const data = parseRoleData(r.permisos);
    return {
      id: r.id,
      nombre: r.nombre,
      activo: data.activo,
      descripcion: data.descripcion || ROLE_DESCRIPTIONS[r.nombre] || "",
      permisos: data.permisos,
      _count: r._count,
    };
  });
}

export async function createRole(data: {
  nombre: string;
  descripcion?: string;
  permisos: string[];
}) {
  await requirePermission("usuarios.roles");

  if (!data.nombre || data.nombre.trim().length < 2) {
    return { error: "El nombre del rol debe tener al menos 2 caracteres." };
  }

  const normalizedName = data.nombre.trim().toUpperCase().replace(/\s+/g, "_");

  const existing = await prisma.rol.findFirst({
    where: { nombre: { equals: normalizedName, mode: "insensitive" } },
  });
  if (existing) {
    return { error: "Ya existe un rol con ese nombre." };
  }

  const allPerms = getAllPermissions();
  const invalidPerms = data.permisos.filter(p => !allPerms.includes(p));
  if (invalidPerms.length > 0) {
    return { error: `Permisos inválidos: ${invalidPerms.join(", ")}` };
  }

  await prisma.rol.create({
    data: {
      nombre: normalizedName,
      permisos: serializeRoleData({
        activo: true,
        descripcion: data.descripcion || "",
        permisos: data.permisos,
      }),
    },
  });

  revalidatePath("/empleados");
  return { success: true };
}

export async function updateRole(id: number, data: {
  nombre: string;
  descripcion?: string;
  permisos: string[];
}) {
  await requirePermission("usuarios.roles");

  const role = await prisma.rol.findUnique({ where: { id } });
  if (!role) return { error: "Rol no encontrado." };

  if (!data.nombre || data.nombre.trim().length < 2) {
    return { error: "El nombre del rol debe tener al menos 2 caracteres." };
  }

  const normalizedName = data.nombre.trim().toUpperCase().replace(/\s+/g, "_");

  const existingRoleData = parseRoleData(role.permisos);

  if (role.nombre === "ADMINISTRADOR") {
    // ADMINISTRADOR permissions are FIXED - cannot be changed at all
    const currentPerms = existingRoleData.permisos.sort().join(",");
    const newPerms = data.permisos.sort().join(",");
    if (currentPerms !== newPerms) {
      return { error: "El rol Administrador tiene permisos fijos que no pueden modificarse." };
    }
    // Also prevent name change
    if (normalizedName !== role.nombre) {
      return { error: "El nombre del rol Administrador no puede modificarse." };
    }
  }

  if (normalizedName !== role.nombre) {
    const existing = await prisma.rol.findFirst({
      where: {
        nombre: { equals: normalizedName, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (existing) {
      return { error: "Ya existe un rol con ese nombre." };
    }
  }

  const allPerms = getAllPermissions();
  const invalidPerms = data.permisos.filter(p => !allPerms.includes(p));
  if (invalidPerms.length > 0) {
    return { error: `Permisos inválidos: ${invalidPerms.join(", ")}` };
  }

  await prisma.rol.update({
    where: { id },
    data: {
      nombre: normalizedName,
      permisos: serializeRoleData({
        activo: data.permisos.length > 0 ? existingRoleData.activo : false,
        descripcion: data.descripcion ?? existingRoleData.descripcion,
        permisos: data.permisos,
      }),
    },
  });

  revalidatePath("/empleados");
  return { success: true };
}

export async function toggleRoleEstado(id: number) {
  await requirePermission("usuarios.roles");

  const role = await prisma.rol.findUnique({
    where: { id },
    include: { _count: { select: { usuarios: true } } },
  });

  if (!role) return { error: "Rol no encontrado." };

  if (role.nombre === "ADMINISTRADOR") {
    return { error: "El rol Administrador no puede ser desactivado." };
  }

  const roleData = parseRoleData(role.permisos);
  const newActivo = !roleData.activo;

  await prisma.rol.update({
    where: { id },
    data: {
      permisos: serializeRoleData({
        ...roleData,
        activo: newActivo,
      }),
    },
  });

  revalidatePath("/empleados");
  return { success: true };
}

export async function deleteRole(id: number) {
  await requirePermission("usuarios.roles");

  const role = await prisma.rol.findUnique({
    where: { id },
    include: { _count: { select: { usuarios: true } } },
  });

  if (!role) return { error: "Rol no encontrado." };

  if (role.nombre === "ADMINISTRADOR") {
    return { error: "No se puede eliminar el rol Administrador." };
  }

  if (role._count.usuarios > 0) {
    return { error: `No se puede eliminar el rol "${role.nombre}" porque tiene ${role._count.usuarios} usuario(s) asignado(s). Reasigne los usuarios antes de eliminar.` };
  }

  await prisma.rol.delete({ where: { id } });
  revalidatePath("/empleados");
  return { success: true };
}
