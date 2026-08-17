"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { EmployeePanel } from "@/components/ui/employee-panel";
import {
  LogOut,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Coins,
  Users,
  Truck,
  UserCheck,
  BarChart3,
  Menu,
  X,
  ClipboardList,
} from "lucide-react";

interface NavbarProps {
  user: {
    userId?: number;
    username: string;
    role: string;
    fotoUrl?: string | null;
    nombreCompleto?: string;
    dni?: string;
    correo?: string | null;
    telefono?: string | null;
    activo?: boolean;
    creadoEn?: Date;
    rol?: { id: number; nombre: string };
  } | null;
  currentPath: string;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
  { name: "Productos", path: "/productos", icon: Package, roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { name: "Pedidos", path: "/pedidos", icon: ClipboardList, roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { name: "Solicitudes", path: "/solicitudes", icon: ClipboardList, roles: ["ADMINISTRADOR"] },
  { name: "Ventas", path: "/ventas", icon: ShoppingCart, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Caja", path: "/caja", icon: Coins, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Clientes", path: "/clientes", icon: Users, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Proveedores", path: "/proveedores", icon: Truck, roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { name: "Usuarios", path: "/empleados", icon: UserCheck, roles: ["ADMINISTRADOR"] },
  { name: "Informes", path: "/informes", icon: BarChart3, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
];

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const allowedItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  const leftPaths = new Set(["/dashboard", "/productos", "/pedidos", "/ventas", "/caja"]);
  const leftItems = allowedItems.filter((item) => leftPaths.has(item.path));
  const rightItems = allowedItems.filter((item) => !leftPaths.has(item.path));

  // Build user object for EmployeePanel
  const panelUser = user ? {
    id: user.userId || 0,
    nombreCompleto: user.nombreCompleto || user.username,
    username: user.username,
    dni: user.dni || "",
    correo: user.correo || null,
    telefono: user.telefono || null,
    fotoUrl: user.fotoUrl || null,
    activo: user.activo ?? true,
    creadoEn: user.creadoEn || new Date(),
    rol: user.rol || { id: 0, nombre: user.role },
  } : null;

  return (
    <>
      <header className="sticky top-0 z-50 h-[5.5rem] px-6 bg-gradient-to-r from-[var(--panel)] via-[#1a1e27] to-[var(--panel)] border-b border-[var(--border)]/40 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.35)]">
        <div className="flex h-full items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              href="/dashboard"
              className="hidden xl:flex items-center shrink-0 group"
            >
              <Image
                src="/logo.png"
                alt="Logo de Chopper Repuestos"
                width={148}
                height={66}
                className="h-[3.9rem] w-auto object-contain rounded-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:brightness-110 group-hover:drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
              />
            </Link>

            <div className="hidden xl:block w-px h-10 bg-gradient-to-b from-transparent via-white/18 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.08)]" />

            <nav className="hidden xl:flex items-center gap-1.5 shrink-0">
              {leftItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--brand)]/10 text-white border border-[var(--brand)]/20 shadow-[0_0_14px_rgba(214,40,40,0.15)] font-bold"
                        : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--card)]/60 border border-transparent"
                    }`}
                  >
                    <Icon size={15} className={`shrink-0 transition-all duration-200 ${isActive ? "scale-110" : "group-hover:brightness-125"}`} />
                    <span>{item.name}</span>
                    {isActive && (
                      <span className="absolute bottom-[-14px] left-1/2 -translate-x-1/2 w-7 h-[2px] bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <nav className="hidden xl:flex items-center gap-1.5">
            {rightItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--brand)]/10 text-white border border-[var(--brand)]/20 shadow-[0_0_14px_rgba(214,40,40,0.15)] font-bold"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--card)]/60 border border-transparent"
                  }`}
                >
                  <Icon size={15} className={`shrink-0 transition-all duration-200 ${isActive ? "scale-110" : "group-hover:brightness-125"}`} />
                  <span>{item.name}</span>
                  {isActive && (
                    <span className="absolute bottom-[-14px] left-1/2 -translate-x-1/2 w-7 h-[2px] bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent rounded-full" />
                  )}
                </Link>
              );
            })}
            </nav>

            {/* Separator */}
            <div className="hidden xl:block w-px h-10 bg-gradient-to-b from-transparent via-white/18 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.08)]" />

            {/* User block */}
            {user && (
              <>
                <button
                  onClick={() => setShowProfile(true)}
                className="hidden xl:flex items-center gap-3 hover:bg-[var(--card)]/80 border border-[var(--border)]/20 hover:border-[var(--border)]/40 rounded-xl px-3 py-2 transition-all duration-300 cursor-pointer"
                >
                  <Avatar
                    fotoUrl={user.fotoUrl ?? null}
                    nombreCompleto={user.username}
                    size="sm"
                    activo={true}
                  />
                  <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="text-xs font-bold text-[var(--text)] max-w-[120px] truncate">
                      {user.username}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider">
                      {user.role.replace("_", " ")}
                    </span>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                className="hidden xl:flex items-center justify-center p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] border border-transparent hover:border-[var(--danger)]/10 transition-all duration-300"
                >
                  <LogOut size={16} />
                </button>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="xl:hidden p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-all duration-300 border border-transparent hover:border-[var(--border)]/40"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-x-0 top-[5.5rem] z-40 bg-gradient-to-b from-[var(--panel)] to-[#1a1e27] border-b border-[var(--border)]/40 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User info (mobile) */}
          {user && (
            <div className="px-5 py-4 border-b border-[var(--border)]/40 flex items-center gap-3">
              <Avatar
                fotoUrl={user.fotoUrl ?? null}
                nombreCompleto={user.username}
                size="sm"
                activo={true}
              />
              <div className="flex flex-col leading-none gap-0.5">
                <span className="text-sm font-bold text-[var(--text)]">
                  {user.username}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider">
                  {user.role.replace("_", " ")}
                </span>
              </div>
            </div>
          )}

          {/* Navigation items (mobile) */}
          <nav className="p-3 space-y-1">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "bg-[var(--brand)]/10 text-white border border-[var(--brand)]/20 shadow-[0_2px_10px_rgba(214,40,40,0.12)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/80"
                  }`}
                >
                  <Icon size={17} className="shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout (mobile) */}
          <div className="p-3 border-t border-[var(--border)]/40">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] border border-transparent hover:border-[var(--danger)]/10 transition-all duration-300"
            >
              <LogOut size={17} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="xl:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Employee Detail Panel */}
      <EmployeePanel
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        user={panelUser}
      />
    </>
  );
}
