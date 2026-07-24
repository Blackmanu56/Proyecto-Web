import { getSession } from "./auth.server";
import { TokenPayload } from "./jwt";

/**
 * Valida que la sesión tenga un permiso específico.
 * Si se pasa session (incluyendo null), la usa directamente sin llamar getSession().
 * Si NO se pasa el parámetro, la obtiene via getSession().
 */
export async function requirePermission(
  permission: string,
  session?: TokenPayload | null
): Promise<TokenPayload> {
  const s = arguments.length > 1 ? session : await getSession();
  if (!s) throw new Error("No autenticado.");
  if (s.role === "ADMINISTRADOR") return s;
  if (!s.permissions || !s.permissions.includes(permission)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }
  return s;
}

export async function hasPermission(
  permission: string,
  session?: TokenPayload | null
): Promise<boolean> {
  const s = arguments.length > 1 ? session : await getSession();
  if (!s) return false;
  if (s.role === "ADMINISTRADOR") return true;
  return s.permissions?.includes(permission) ?? false;
}
