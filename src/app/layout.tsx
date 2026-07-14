import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSession } from "@/lib/auth.server";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";
import { ChopperToaster } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Chopper Repuestos - Sistema de Gestión",
  description: "Sistema integral de inventario y ventas con predicción de demanda para Chopper Repuestos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  // Fetch fresh user data from DB for latest fotoUrl (JWT may be stale)
  let shellUser: any = null;
  if (session) {
    const userFromDb = await prisma.usuario.findUnique({
      where: { id: session.userId },
      select: { username: true, fotoUrl: true, nombreCompleto: true, dni: true, correo: true, telefono: true, activo: true, creadoEn: true, rol: true },
    });
    shellUser = {
      userId: session.userId,
      username: userFromDb?.username ?? session.username,
      role: session.role,
      fotoUrl: userFromDb?.fotoUrl ?? null,
      nombreCompleto: userFromDb?.nombreCompleto ?? session.username,
      dni: userFromDb?.dni ?? "",
      correo: userFromDb?.correo ?? null,
      telefono: userFromDb?.telefono ?? null,
      activo: userFromDb?.activo ?? true,
      creadoEn: userFromDb?.creadoEn ?? new Date(),
      rol: userFromDb?.rol ?? { id: 0, nombre: session.role },
    };
  }

  return (
    <html lang="es" className={`${inter.variable} h-full bg-bg text-text antialiased`}>
      <body className="min-h-full bg-bg text-text font-sans">
        <AppShell user={shellUser}>{children}</AppShell>
        <ChopperToaster />
      </body>
    </html>
  );
}
