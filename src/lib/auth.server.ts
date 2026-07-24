import { cookies } from "next/headers";
import { verifyJWT, TokenPayload } from "./jwt";
import { prisma } from "./prisma";

export const userStatusCache = new Map<number, { activo: boolean; ts: number }>();
const CACHE_TTL_MS = 60_000;

export function clearUserStatusCache(): void {
  userStatusCache.clear();
}

/**
 * Verifica si un usuario está activo en la DB, con caché de 60s
 */
export async function getUserActivo(userId: number): Promise<boolean> {
  const now = Date.now();
  const cached = userStatusCache.get(userId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.activo;
  }

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { activo: true },
  });

  if (!user) {
    userStatusCache.set(userId, { activo: false, ts: now });
    return false;
  }

  userStatusCache.set(userId, { activo: user.activo, ts: now });
  return user.activo;
}

/**
 * Obtiene la sesión actual desde las cookies del navegador
 */
export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  
  if (!token) return null;
  
  return await verifyJWT(token);
}

/**
 * Elimina la cookie de sesión (Cerrar sesión)
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
