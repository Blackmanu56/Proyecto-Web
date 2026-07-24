import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { getJWTSecret } from "@/lib/jwt";

function getKey() {
  return new TextEncoder().encode(getJWTSecret());
}

const REFRESH_THRESHOLD_MS = 30 * 60 * 1000;

// Definimos las rutas protegidas y sus permisos mínimos
const protectedRoutes = [
  { path: "/dashboard", roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
  { path: "/productos", roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { path: "/ventas", roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { path: "/caja", roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { path: "/clientes", roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { path: "/proveedores", roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { path: "/empleados", roles: ["ADMINISTRADOR"] },
  { path: "/informes", roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session")?.value;

  // 1. Ruta de Login
  if (pathname === "/login" || pathname === "/") {
    if (token) {
      try {
        await jwtVerify(token, getKey());
        // Si ya está logueado y va a login, redirigir a dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } catch (e) {
        // Token inválido, continuar a login
      }
    }
    // Si no está logueado, continuar a login
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 2. Rutas Protegidas
  const matchingRoute = protectedRoutes.find((route) =>
    pathname === route.path || pathname.startsWith(route.path + "/")
  );

  if (matchingRoute) {
    if (!token) {
      // No logueado, redirigir a login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verificar token
      const { payload } = await jwtVerify(token, getKey());
      const userId = (payload as any).userId as number;
      const userRole = (payload as any).role as string;

      // Validar permisos del Rol
      if (!matchingRoute.roles.includes(userRole)) {
        // No autorizado, redirigir a dashboard
        return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
      }

      // Token refresh: si el token está por vencer (30min), renovarlo
      const tokenExp = (payload as any).exp as number;
      const nowSec = Math.floor(Date.now() / 1000);
      if (tokenExp && tokenExp - nowSec < 1800) {
        const newToken = await new SignJWT({
          userId: (payload as any).userId,
          username: (payload as any).username,
          role: (payload as any).role,
          permissions: (payload as any).permissions,
          fotoUrl: (payload as any).fotoUrl,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h")
          .sign(getKey());

        const response = NextResponse.next();
        response.cookies.set("session", newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24,
        });
        return response;
      }
    } catch (e) {
      // Token corrupto o expirado, limpiar cookie y redirigir a login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("session");
      return response;
    }
  }

  return NextResponse.next();
}

// Configurar el Matcher para excluir solo assets estáticos de Next
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * API routes ARE included so middleware (JWT check, user-status) applies.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
