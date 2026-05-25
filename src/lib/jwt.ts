import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "mi_secreto_super_seguro_para_tesis_2026";
const key = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * Genera un token JWT firmado
 */
export async function createJWT(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key);
}

/**
 * Verifica y decodifica un token JWT
 */
export async function verifyJWT(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error("Error al verificar JWT:", error);
    return null;
  }
}
