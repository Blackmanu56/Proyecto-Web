"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
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
} from "lucide-react";

interface NavbarProps {
  user: {
    username: string;
    role: string;
    fotoUrl?: string | null;
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
  { name: "Ventas", path: "/ventas", icon: ShoppingCart, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Caja", path: "/caja", icon: Coins, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Clientes", path: "/clientes", icon: Users, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
  { name: "Proveedores", path: "/proveedores", icon: Truck, roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
  { name: "Usuarios", path: "/empleados", icon: UserCheck, roles: ["ADMINISTRADOR"] },
  { name: "Informes", path: "/informes", icon: BarChart3, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
];

export default function Navbar({ user, currentPath }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const allowedItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  return (
    <>
      <header className="sticky top-0 z-50 h-14 flex items-center px-4 md:px-6 bg-[var(--panel)] border-b border-[var(--border)]">
        {/* Left section: Logo + Hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard" className="flex items-center shrink-0">
            <img
              src="/logo.png"
              alt="Chopper Repuestos"
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Center section: Navigation items (desktop) */}
        <nav className="flex-1 hidden md:flex items-center justify-center gap-1 px-6">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right section: User info + Logout + Mobile menu button */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <>
              <div className="hidden sm:flex items-center gap-2.5">
                <Avatar
                  fotoUrl={user.fotoUrl ?? null}
                  nombreCompleto={user.username}
                  size="sm"
                  activo={true}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-[var(--text)] max-w-[120px] truncate">
                    {user.username}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase">
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="hidden sm:block p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] transition-all duration-200"
              >
                <LogOut size={16} />
              </button>
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-all duration-200"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 z-40 bg-[var(--panel)] border-b border-[var(--border)] shadow-[var(--shadow-lg)] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User info (mobile) */}
          {user && (
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
              <Avatar
                fotoUrl={user.fotoUrl ?? null}
                nombreCompleto={user.username}
                size="sm"
                activo={true}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[var(--text)]">
                  {user.username}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {user.role}
                </span>
              </div>
            </div>
          )}

          {/* Navigation items (mobile) */}
          <nav className="p-2 space-y-1">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout (mobile) */}
          <div className="p-2 border-t border-[var(--border)]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] transition-all duration-200"
            >
              <LogOut size={18} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
