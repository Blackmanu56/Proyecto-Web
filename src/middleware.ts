import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "mi_secreto_super_seguro_para_tesis_2026";
const key = new TextEncoder().encode(JWT_SECRET);

// Definimos las rutas protegidas y sus permisos mínimos
const protectedRoutes = [
  { path: "/dashboard", roles: ["ADMINISTRADOR", "CAJERO", "VENDEDOR", "EMPLEADO"] },
  { path: "/productos", roles: ["ADMINISTRADOR", "EMPLEADO", "VENDEDOR"] },
  { path: "/ventas", roles: ["ADMINISTRADOR", "VENDEDOR", "CAJERO"] },
  { path: "/caja", roles: ["ADMINISTRADOR", "CAJERO"] },
  { path: "/clientes", roles: ["ADMINISTRADOR", "VENDEDOR"] },
  { path: "/proveedores", roles: ["ADMINISTRADOR", "EMPLEADO"] },
  { path: "/empleados", roles: ["ADMINISTRADOR"] },
  { path: "/informes", roles: ["ADMINISTRADOR"] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session")?.value;

  // 1. Ruta de Login
  if (pathname === "/login" || pathname === "/") {
    if (token) {
      try {
        await jwtVerify(token, key);
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
    pathname.startsWith(route.path)
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
      const { payload } = await jwtVerify(token, key);
      const userRole = (payload as any).role as string;

      // Validar permisos del Rol
      if (!matchingRoute.roles.includes(userRole)) {
        // No autorizado, redirigir a dashboard
        return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
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

// Configurar el Matcher para excluir recursos estáticos y assets de Next
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
