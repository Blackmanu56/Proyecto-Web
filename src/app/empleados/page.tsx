import React from "react";
import { getSession } from "@/lib/auth.server";
import { getUsuarios, getRoles, crearUsuario, actualizarUsuario, toggleEstadoUsuario } from "@/actions/usuarios";
import UsuariosTable from "@/components/tables/UsuariosTable";
import { Users } from "lucide-react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

const AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp"];

// Server action wrappers that the client component can call
async function searchUsuarios(query: string, soloActivos: boolean) {
  "use server";
  return await getUsuarios(query, soloActivos);
}

async function createUsuario(formData: FormData): Promise<{ success?: boolean; error?: string; id?: number }> {
  "use server";
  return await crearUsuario(formData);
}

async function updateUsuario(id: number, formData: FormData) {
  "use server";
  return await actualizarUsuario(id, formData);
}

async function toggleUsuario(id: number) {
  "use server";
  return await toggleEstadoUsuario(id);
}

async function uploadUserPhoto(
  userId: number,
  formData: FormData
): Promise<{ success?: boolean; fotoUrl?: string; error?: string }> {
  "use server";

  try {
    // Auth check
    const session = await getSession();
    if (!session || session.role !== "ADMINISTRADOR") {
      return { error: "No tiene permisos para realizar esta acción." };
    }

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

    // Validate
    if (file.size > MAX_SIZE) {
      return { error: "La imagen no puede superar los 5 MB." };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: "Formato no permitido. Solo JPG, PNG y WEBP." };
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return { error: "Extensión de archivo no válida." };
    }

    // Save file
    await fs.mkdir(AVATARS_DIR, { recursive: true });
    const filename = `avatar-${userId}-${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(AVATARS_DIR, filename), buffer);

    // Delete old photo
    if (usuario.fotoUrl) {
      const oldPath = path.join(AVATARS_DIR, path.basename(usuario.fotoUrl));
      await fs.unlink(oldPath).catch(() => {});
    }

    const fotoUrl = `/uploads/avatars/${filename}`;
    await prisma.usuario.update({
      where: { id: userId },
      data: { fotoUrl, fotoActualizadaEn: new Date() },
    });

    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true, fotoUrl };
  } catch (error: any) {
    console.error("Error al subir foto:", error);
    return { error: "Error interno al subir la foto." };
  }
}

async function deleteUserPhoto(userId: number): Promise<{ success?: boolean; error?: string }> {
  "use server";

  try {
    const session = await getSession();
    if (!session || session.role !== "ADMINISTRADOR") {
      return { error: "No tiene permisos para realizar esta acción." };
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return { error: "Usuario no encontrado." };
    if (!usuario.fotoUrl) return { error: "El usuario no tiene foto de perfil." };

    // Delete file
    const filePath = path.join(AVATARS_DIR, path.basename(usuario.fotoUrl));
    await fs.unlink(filePath).catch(() => {});

    await prisma.usuario.update({
      where: { id: userId },
      data: { fotoUrl: null, fotoActualizadaEn: null },
    });

    revalidatePath("/empleados");
    revalidatePath("/informes");
    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar foto:", error);
    return { error: "Error interno al eliminar la foto." };
  }
}

export default async function EmpleadosPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Only ADMINISTRADOR can access this page (enforced in middleware too)
  if (userRole !== "ADMINISTRADOR") {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold">Acceso Denegado</p>
          <p className="text-slate-500 text-sm mt-2">
            No tiene permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Load data on the server
  const [usuarios, roles] = await Promise.all([
    getUsuarios("", false), // Get all users including inactive
    getRoles(),
  ]);

  return (
    <div className="flex-1 bg p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-brand-light rounded-2xl text-brand border border-brand/10">
              <Users size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-text tracking-tight">
                Gestión de Usuarios
              </h1>
              <p className="text-text-secondary text-xs md:text-sm mt-0.5 font-medium">
                Administre usuarios, roles y permisos del sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Users Table (Client Component) */}
        <UsuariosTable
          initialUsers={usuarios as any}
          roles={roles}
          onCreateUser={createUsuario}
          onUpdateUser={updateUsuario}
          onToggleEstado={toggleUsuario}
          onSearch={searchUsuarios}
          onUploadPhoto={uploadUserPhoto}
          onDeletePhoto={deleteUserPhoto}
        />
      </div>
    </div>
  );
}
