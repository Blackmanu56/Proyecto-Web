import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSession } from "@/lib/auth.server";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SGI-Repuestos - Sistema de Gestión Inteligente",
  description: "Sistema integral de inventario y ventas con predicción de demanda para Chopper Repuestos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="es" className={`${inter.variable} h-full bg-slate-950 text-slate-100 antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
        {session && <Navbar user={session} />}
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
