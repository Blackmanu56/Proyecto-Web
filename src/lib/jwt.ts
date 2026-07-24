import { SignJWT, jwtVerify } from "jose";

export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

function getKey() {
  return new TextEncoder().encode(getJWTSecret());
}

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
  fotoUrl?: string | null;
}

/**
 * Genera un token JWT firmado
 */
export async function createJWT(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getKey());
}

/**
 * Verifica y decodifica un token JWT
 */
export async function verifyJWT(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error("Error al verificar JWT:", error);
    return null;
  }
}
