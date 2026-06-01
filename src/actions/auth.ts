"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createJWT } from "@/lib/jwt";

const loginSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
});

export type LoginState = {
  success?: boolean;
  error?: string;
};

/**
 * Acción de servidor para manejar el inicio de sesión
 */
export async function loginAction(
  prevState: any,
  formData: FormData
): Promise<LoginState> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  // 1. Validar esquema
  const validation = loginSchema.safeParse({ username, password });
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  try {
    // 2. Buscar usuario
    const user = await prisma.usuario.findUnique({
      where: { username },
      include: {
        rol: true,
        empleado: true,
      },
    });

    if (!user) {
      return { error: "Usuario o contraseña incorrectos" };
    }

    // Verificar si el usuario está activo (baja lógica)
    if (!user.activo) {
      return { error: "Este usuario ha sido dado de baja del sistema. Contacte al administrador." };
    }

    // Verificar si el empleado está activo (compatibilidad)
    if (user.empleado && !user.empleado.activo) {
      return { error: "Este usuario ha sido desactivado del sistema" };
    }

    // 3. Verificar contraseña
    const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!passwordMatch) {
      return { error: "Usuario o contraseña incorrectos" };
    }

    // 4. Crear JWT
    const token = await createJWT({
      userId: user.id,
      username: user.username,
      role: user.rol.nombre,
      fotoUrl: user.fotoUrl,
    });

    // 5. Configurar cookie
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 horas
    });

    return { success: true };

  } catch (error: any) {
    console.error("Error en loginAction:", error);
    return { error: "Error interno del servidor. Intente más tarde." };
  }
}
