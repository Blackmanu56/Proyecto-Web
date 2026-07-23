import React from "react";
import { getSession } from "@/lib/auth.server";
import { getUsuarios, getRoles, crearUsuario, actualizarUsuario, toggleEstadoUsuario } from "@/actions/usuarios";
import { getRolesCompletos, createRole, updateRole, toggleRoleEstado } from "@/actions/roles";
import { parseRoleData } from "@/lib/permissions";
import UsuariosTable from "@/components/tables/UsuariosTable";
import RolesTable from "@/components/tables/RolesTable";
import { Users, Shield } from "lucide-react";
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
    const session = await getSession();
    if (!session || !session.permissions?.includes("usuarios.foto")) {
      return { error: "No tiene permisos para realizar esta acción." };
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      return { error: "Usuario no encontrado." };
    }

    const file = formData.get("foto") as File | null;
    if (!file) {
      return { error: "No se proporcionó ningún archivo." };
    }

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

    await fs.mkdir(AVATARS_DIR, { recursive: true });
    const filename = `avatar-${userId}-${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(AVATARS_DIR, filename), buffer);

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
    if (!session || !session.permissions?.includes("usuarios.foto")) {
      return { error: "No tiene permisos para realizar esta acción." };
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return { error: "Usuario no encontrado." };
    if (!usuario.fotoUrl) return { error: "El usuario no tiene foto de perfil." };

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

// Role server action wrappers
async function refreshRoles() {
  "use server";
  return await getRolesCompletos();
}

async function handleCreateRole(data: { nombre: string; descripcion: string; permisos: string[] }) {
  "use server";
  return await createRole(data);
}

async function handleUpdateRole(id: number, data: { nombre: string; descripcion: string; permisos: string[] }) {
  "use server";
  return await updateRole(id, data);
}

async function handleToggleRoleEstado(id: number) {
  "use server";
  return await toggleRoleEstado(id);
}

// Client wrapper to handle tabs
import EmpleadosTabs from "./EmpleadosTabs";

export default async function EmpleadosPage() {
  const session = await getSession();
  const userRole = session?.role || "";

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

  // Fetch fresh permissions from DB (not from JWT which may be stale)
  const userRecord = await prisma.usuario.findUnique({
    where: { id: session!.userId },
    include: { rol: true },
  });
  const roleData = parseRoleData(userRecord?.rol?.permisos ?? null);
  const userPermissions = roleData.permisos;

  const [usuarios, roles, rolesCompletos] = await Promise.all([
    getUsuarios("", false),
    getRoles(),
    getRolesCompletos(),
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        <EmpleadosTabs
          initialUsers={usuarios as any}
          roles={roles}
          rolesCompletos={rolesCompletos}
          userPermissions={userPermissions}
          onCreateUser={createUsuario}
          onUpdateUser={updateUsuario}
          onToggleEstado={toggleUsuario}
          onSearch={searchUsuarios}
          onUploadPhoto={uploadUserPhoto}
          onDeletePhoto={deleteUserPhoto}
          onCreateRole={handleCreateRole}
          onUpdateRole={handleUpdateRole}
          onToggleRoleEstado={handleToggleRoleEstado}
          onRefreshRoles={refreshRoles}
        />
      </div>
    </div>
  );
}
