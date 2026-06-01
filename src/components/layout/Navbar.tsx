"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Coins,
  Users,
  Truck,
  UserCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface NavbarProps {
  user: {
    username: string;
    role: string;
    fotoUrl?: string | null;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
    { name: "Productos", path: "/productos", icon: Package, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
    { name: "Ventas", path: "/ventas", icon: ShoppingCart, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
    { name: "Caja", path: "/caja", icon: Coins, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
    { name: "Clientes", path: "/clientes", icon: Users, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS"] },
    { name: "Proveedores", path: "/proveedores", icon: Truck, roles: ["ADMINISTRADOR", "ENCARGADO_STOCK"] },
    { name: "Usuarios", path: "/empleados", icon: UserCheck, roles: ["ADMINISTRADOR"] },
    { name: "Informes", path: "/informes", icon: BarChart3, roles: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"] },
  ];

  const handleLogout = async () => {
    await fetch("/api/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  };

  const allowedItems = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                SGI-Repuestos
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-2.5 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-800">
                <Avatar
                  fotoUrl={user.fotoUrl ?? null}
                  nombreCompleto={user.username}
                  size="sm"
                  activo={true}
                />
                <div className="text-left leading-none">
                  <p className="text-xs font-semibold text-white">
                    {user.username}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                    {user.role}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition-all duration-200"
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="md:hidden flex items-center space-x-3">
            {user && (
              <span className="text-xs font-semibold text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                {user.role}
              </span>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none transition-all duration-200"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-lg animate-in slide-in-from-top duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {user && (
              <div className="border-t border-slate-800 mt-4 pt-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Usuario Activo</p>
                  <p className="text-sm font-semibold text-white">
                    {user.username}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white transition-all duration-200 text-xs"
                >
                  <LogOut size={14} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}