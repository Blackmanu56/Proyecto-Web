import { cookies } from "next/headers";
import { verifyJWT, TokenPayload } from "./jwt";

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
