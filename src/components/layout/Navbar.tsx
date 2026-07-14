"use client";

import React, { useEffect, useState } from "react";
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
  const [dateTime, setDateTime] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const timeStr = now.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setDateTime(`${dateStr} | ${timeStr}`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const allowedItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  return (
    <header className="sticky top-0 z-50 h-14 flex items-center px-4 bg-[var(--panel)] border-b border-[var(--border)]">
      {/* Left section: Logo + Date/Time */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/dashboard" className="flex items-center shrink-0">
          <img
            src="/logo-chopper.jpg"
            alt="Chopper Repuestos"
            className="h-8 w-auto object-contain"
          />
        </Link>
        <div className="hidden lg:flex items-center text-[11px] text-[var(--text-secondary)] font-medium tracking-wide whitespace-nowrap">
          {dateTime}
        </div>
      </div>

      {/* Center section: Navigation items */}
      <nav className="flex-1 flex items-center justify-center gap-1 px-4">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path);

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-[var(--transition-default)] ${
                isActive
                  ? "text-[var(--brand)] bg-[var(--brand-light)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="hidden md:inline">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right section: User info + Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        {user && (
          <>
            <Avatar
              fotoUrl={user.fotoUrl ?? null}
              nombreCompleto={user.username}
              size="sm"
              activo={true}
            />
            <span className="hidden sm:inline text-xs font-medium text-[var(--text)] max-w-[120px] truncate">
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors duration-[var(--transition-default)]"
            >
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}