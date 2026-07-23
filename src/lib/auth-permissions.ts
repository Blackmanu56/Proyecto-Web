import { getSession } from "./auth.server";

export async function requirePermission(permission: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado.");
  if (!session.permissions || !session.permissions.includes(permission)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }
  return session;
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.permissions?.includes(permission) ?? false;
}
