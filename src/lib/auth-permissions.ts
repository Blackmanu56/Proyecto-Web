import { getSession } from "./auth.server";
import { TokenPayload } from "./jwt";
import { prisma } from "./prisma";
import { parseRoleData } from "./permissions";

/**
 * Validates that the current session can execute a sensitive server operation.
 *
 * The JWT is only used to identify the user. Role, permissions and active state
 * are re-read from the database so deactivated users or changed roles do not
 * keep authorization until the token expires.
 */
export async function requirePermission(
  permission: string,
  session?: TokenPayload | null
): Promise<TokenPayload> {
  const s = arguments.length > 1 ? session : await getSession();
  if (!s) throw new Error("No autenticado.");

  const userId = Number(s.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("No autenticado.");
  }

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      activo: true,
      fotoUrl: true,
      rol: {
        select: {
          nombre: true,
          permisos: true,
        },
      },
    },
  });

  if (!user || !user.activo) {
    throw new Error("Usuario inactivo o no encontrado.");
  }

  const roleData = parseRoleData(user.rol.permisos);
  if (!roleData.activo) {
    throw new Error("Rol inactivo o sin permisos vigentes.");
  }

  const freshSession: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.rol.nombre,
    permissions: roleData.permisos,
    fotoUrl: user.fotoUrl,
  };

  if (freshSession.role === "ADMINISTRADOR") return freshSession;
  if (!freshSession.permissions.includes(permission)) {
    throw new Error("No tiene permisos para realizar esta acci?n.");
  }

  return freshSession;
}

/**
 * Lightweight UI permission helper.
 *
 * This intentionally uses the provided/current JWT payload to avoid a database
 * hit during render-only checks. Sensitive server operations must use
 * requirePermission(), which revalidates against the database.
 */
export async function hasPermission(
  permission: string,
  session?: TokenPayload | null
): Promise<boolean> {
  const s = arguments.length > 1 ? session : await getSession();
  if (!s) return false;
  if (s.role === "ADMINISTRADOR") return true;
  return s.permissions?.includes(permission) ?? false;
}
