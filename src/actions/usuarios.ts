"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";
import { getSession } from "@/lib/auth.server";

// Types
export type UsuarioConRol = {
  id: number;
  username: string;
  nombreCompleto: string;
  dni: string;
  correo: string | null;
  telefono: string | null;
  fotoUrl: string | null;
  activo: boolean;
  creadoEn: Date;
  rol: {
    id: number;
    nombre: string;
  };
};

export type RolOption = {
  id: number;
  nombre: string;
};

// Get all users with their roles
export async function getUsuarios(query: string = "", soloActivos: boolean = true): Promise<UsuarioConRol[]> {
  const where: any = {};
  
  if (soloActivos) {
    where.activo = true;
  }
  
  if (query) {
    where.OR = [
      { nombreCompleto: { contains: query, mode: "insensitive" } },
      { username: { contains: query, mode: "insensitive" } },
      { dni: { contains: query, mode: "insensitive" } },
      { correo: { contains: query, mode: "insensitive" } },
    ];
  }
  
  return await prisma.usuario.findMany({
    where,
    include: {
      rol: { select: { id: true, nombre: true } },
    },
    orderBy: { id: "asc" },
  }) as any;
}

// Get all roles for the dropdown
export async function getRoles(): Promise<RolOption[]> {
  return await prisma.rol.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

// Create a new user
export async function crearUsuario(formData: FormData): Promise<{ success?: boolean; error?: string; id?: number }> {
  try {
    const session = await requirePermission("usuarios.crear", await getSession());

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const nombreCompleto = formData.get("nombreCompleto") as string;
    const dni = formData.get("dni") as string;
    const correo = (formData.get("correo") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const rolId = Number(formData.get("rolId"));
    
    // Validations
    if (!username || !password || !nombreCompleto || !dni || !rolId) {
      return { error: "Todos los campos obligatorios deben ser completados." };
    }
    
    if (password.length < 4) {
      return { error: "La contraseña debe tener al menos 4 caracteres." };
    }
    
    // Check for existing username
    const existingUsername = await prisma.usuario.findUnique({ where: { username } });
    if (existingUsername) {
      return { error: "El nombre de usuario ya está registrado." };
    }
    
    // Check for existing DNI
    const existingDni = await prisma.usuario.findUnique({ where: { dni } });
    if (existingDni) {
      return { error: "El DNI ya está registrado en el sistema." };
    }
    
    const passwordHash = bcrypt.hashSync(password, 10);
    
    const created = await prisma.usuario.create({
      data: {
        username,
        passwordHash,
        nombreCompleto,
        dni,
        correo,
        telefono,
        rolId,
      },
    });
    
    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true, id: created.id };
  } catch (error: any) {
    console.error("Error al crear usuario:", error);
    return { error: "Error interno al crear el usuario." };
  }
}

// Update an existing user — with primary admin role protection
export async function actualizarUsuario(id: number, formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requirePermission("usuarios.editar", await getSession());

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const nombreCompleto = formData.get("nombreCompleto") as string;
    const dni = formData.get("dni") as string;
    const correo = (formData.get("correo") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const rolId = Number(formData.get("rolId"));
    
    if (!username || !nombreCompleto || !dni || !rolId) {
      return { error: "Todos los campos obligatorios deben ser completados." };
    }

    // Check uniqueness for username (exclude current user)
    const existingUsername = await prisma.usuario.findFirst({
      where: { username, NOT: { id } },
    });
    if (existingUsername) {
      return { error: "El nombre de usuario ya está en uso por otro usuario." };
    }

    // Check uniqueness for DNI (exclude current user)
    const existingDni = await prisma.usuario.findFirst({
      where: { dni, NOT: { id } },
    });
    if (existingDni) {
      return { error: "El DNI ya está registrado por otro usuario." };
    }

    // Primary admin role protection
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    const adminRole = await prisma.rol.findFirst({ where: { nombre: "ADMINISTRADOR" } });
    if (adminRole) {
      const primaryAdmin = await prisma.usuario.findFirst({
        where: { rolId: adminRole.id },
        orderBy: { id: "asc" },
      });

      // Primary admin cannot change their role away from ADMINISTRADOR
      if (primaryAdmin?.id === id && rolId !== adminRole.id) {
        return { error: "El administrador principal no puede cambiar su rol." };
      }

      // If changing an admin's role away from ADMINISTRADOR, check remaining active admins
      if (usuario.rolId === adminRole.id && rolId !== adminRole.id) {
        const activeAdminCount = await prisma.usuario.count({
          where: {
            rolId: adminRole.id,
            activo: true,
            id: { not: id },
          },
        });
        if (activeAdminCount === 0) {
          return { error: "Debe existir al menos un administrador activo." };
        }
      }
    }
    
    const data: any = {
      username,
      nombreCompleto,
      dni,
      correo,
      telefono,
      rolId,
    };
    
    // Only update password if a new one is provided
    if (password && password.length > 0) {
      if (password.length < 4) {
        return { error: "La nueva contraseña debe tener al menos 4 caracteres." };
      }
      data.passwordHash = bcrypt.hashSync(password, 10);
    }
    
    await prisma.usuario.update({
      where: { id },
      data,
    });
    
    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true };
  } catch (error: any) {
    console.error("Error al actualizar usuario:", error);
    return { error: "Error interno al actualizar el usuario." };
  }
}

// Logical delete (baja lógica) — with primary admin protection
export async function toggleEstadoUsuario(id: number): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requirePermission("usuarios.estado", await getSession());

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    // Find the primary admin: the user with ADMINISTRADOR role and lowest ID
    const adminRole = await prisma.rol.findFirst({ where: { nombre: "ADMINISTRADOR" } });
    if (!adminRole) {
      return { error: "No se encontró el rol Administrador." };
    }

    const primaryAdmin = await prisma.usuario.findFirst({
      where: { rolId: adminRole.id },
      orderBy: { id: "asc" },
    });

    // Block deactivation of the primary admin
    if (usuario.id === primaryAdmin?.id && usuario.activo) {
      return { error: "El administrador principal no puede darse de baja." };
    }

    // If deactivating an admin, ensure at least one admin remains active
    if (usuario.rolId === adminRole.id && usuario.activo) {
      const activeAdminCount = await prisma.usuario.count({
        where: {
          rolId: adminRole.id,
          activo: true,
          id: { not: usuario.id },
        },
      });
      if (activeAdminCount === 0) {
        return { error: "Debe existir al menos un administrador activo." };
      }
    }

    await prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo },
    });

    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true };
  } catch (error: any) {
    console.error("Error al cambiar estado:", error);
    return { error: "Error interno al cambiar el estado del usuario." };
  }
}
