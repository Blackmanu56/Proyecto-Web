"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";
import { uploadProfileImage, rollbackProfileUpload } from "@/lib/storage-service";

// ─── Upload or replace profile photo ───────────────────────────────
export async function subirFotoPerfil(
  userId: number,
  formData: FormData
): Promise<{ success?: boolean; fotoUrl?: string; error?: string }> {
  try {
    // 1. Auth check
    await requirePermission("usuarios.foto");

    // 2. Validate user exists
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    // 3. Get file from form
    const file = formData.get("foto") as File | null;
    if (!file) {
      return { error: "No se proporcionó ningún archivo." };
    }

    // 4. Subir directamente a Supabase Storage (bucket perfiles-chopper)
    const uploadRes = await uploadProfileImage(file, "empleados", userId);
    if (!uploadRes.success || !uploadRes.url || !uploadRes.objectPath) {
      return { error: uploadRes.error || "Error al subir la imagen a Supabase Storage." };
    }

    // 5. Actualizar registro en PostgreSQL
    try {
      await prisma.usuario.update({
        where: { id: userId },
        data: {
          fotoUrl: uploadRes.url,
          fotoActualizadaEn: new Date(),
        },
      });
    } catch (dbError) {
      // Compensating rollback: retirar objeto subido si falló la base de datos
      await rollbackProfileUpload(uploadRes.objectPath);
      throw dbError;
    }

    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true, fotoUrl: uploadRes.url };
  } catch (error: unknown) {
    console.error("Error al subir foto de perfil:", error);
    return { error: "Error interno al subir la foto de perfil." };
  }
}

// ─── Delete profile photo ──────────────────────────────────────────
export async function eliminarFotoPerfil(
  userId: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePermission("usuarios.foto");

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    if (!usuario.fotoUrl) {
      return { error: "El usuario no tiene foto de perfil." };
    }

    // Limpiar en base de datos sin borrar archivos compartidos ni de respaldo
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        fotoUrl: null,
        fotoActualizadaEn: null,
      },
    });

    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error al eliminar foto de perfil:", error);
    return { error: "Error interno al eliminar la foto." };
  }
}
