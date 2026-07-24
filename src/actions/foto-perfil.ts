"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/auth-permissions";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function sanitizeExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : null;
}

function publicUrl(filename: string): string {
  return `/uploads/avatars/${filename}`;
}

// ─── Upload or replace profile photo ───────────────────────────────
export async function subirFotoPerfil(
  userId: number,
  formData: FormData
): Promise<{ success?: boolean; fotoUrl?: string; error?: string }> {
  try {
    // Auth check
    await requirePermission("usuarios.foto");

    // Validate user exists
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    // Get file from form
    const file = formData.get("foto") as File | null;
    if (!file) {
      return { error: "No se proporcionó ningún archivo." };
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return { error: "La imagen no puede superar los 5 MB." };
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        error: "Formato no permitido. Solo JPG, PNG y WEBP.",
      };
    }

    // Validate extension
    const ext = sanitizeExtension(file.name);
    if (!ext) {
      return { error: "Extensión de archivo no válida." };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `avatar-${userId}-${timestamp}${ext}`;

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Save new file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

    // Delete old photo file if exists (before updating DB so we keep it if save fails)
    const oldUrl = usuario.fotoUrl;
    if (oldUrl) {
      const oldFilename = path.basename(oldUrl);
      const oldPath = path.join(UPLOAD_DIR, oldFilename);
      try {
        await fs.unlink(oldPath);
      } catch {
        // Old file might not exist — ignore
      }
    }

    // Update user record
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        fotoUrl: publicUrl(filename),
        fotoActualizadaEn: new Date(),
      },
    });

    revalidatePath("/empleados");
    return { success: true, fotoUrl: publicUrl(filename) };
  } catch (error: any) {
    console.error("Error al subir foto de perfil:", error);
    return { error: "Error interno al subir la foto." };
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

    // Delete file from disk
    const filename = path.basename(usuario.fotoUrl);
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // File might not exist — proceed with DB cleanup
    }

    // Clear DB fields
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        fotoUrl: null,
        fotoActualizadaEn: null,
      },
    });

    revalidatePath("/empleados");
    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar foto de perfil:", error);
    return { error: "Error interno al eliminar la foto." };
  }
}
