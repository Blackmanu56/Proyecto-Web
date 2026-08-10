"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ReporteVenta, ReporteCierre, ReporteProducto, EmpleadosDashboard, ClientesDashboard, ProveedoresDashboard } from "@/actions/informes";
import "./report.css";
import { BarChart3, Wallet, Package, Users, UserCheck, Building } from "lucide-react";
import VentasReport from "./VentasReport";
import CierresReport from "./CierresReport";
import ProductosReport from "./ProductosReport";
import EmpleadosReport from "./EmpleadosReport";
import ClientesReport from "./ClientesReport";
import ProveedoresReport from "./ProveedoresReport";

type TabId = "ventas" | "cierres" | "productos" | "empleados" | "clientes" | "proveedores";

type UsuarioOption = { id: number; username: string; nombreCompleto: string };
type NombreOption = { id: number; nombre: string };
type MetodoPagoOption = { metodo: string | null; count: number; total: number };

const ALLOWED_TABS: Record<TabId, string[]> = {
  ventas: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  cierres: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  productos: ["ADMINISTRADOR", "ENCARGADO_STOCK"],
  empleados: ["ADMINISTRADOR"],
  clientes: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  proveedores: ["ADMINISTRADOR", "ENCARGADO_STOCK"],
};

const TAB_META: Record<TabId, { label: string; icon: React.ReactNode }> = {
  ventas: { label: "Ventas", icon: <BarChart3 size={16} /> },
  cierres: { label: "Cierres", icon: <Wallet size={16} /> },
  productos: { label: "Productos", icon: <Package size={16} /> },
  empleados: { label: "Empleados", icon: <Users size={16} /> },
  clientes: { label: "Clientes", icon: <UserCheck size={16} /> },
  proveedores: { label: "Proveedores", icon: <Building size={16} /> },
};

interface Props {
  initialVentas: { ventas: ReporteVenta[]; totales: { cantidad: number; total: number; promedio: number } };
  initialCierres: ReporteCierre[];
  initialProductos: ReporteProducto[];
  initialEmpleados: EmpleadosDashboard;
  initialClientes: ClientesDashboard;
  initialProveedores: ProveedoresDashboard;
  usuarios: UsuarioOption[];
  categorias: NombreOption[];
  proveedores: NombreOption[];
  clientesDistinct?: NombreOption[];
  metodosPago?: MetodoPagoOption[];
  userRole: string;
}

export default function InformesTabs({
  initialVentas,
  initialCierres,
  initialProductos,
  initialEmpleados,
  initialClientes,
  initialProveedores,
  usuarios,
  categorias,
  proveedores,
  userRole,
}: Props) {
  const availableTabs = (Object.keys(ALLOWED_TABS) as TabId[]).filter(
    (t) => ALLOWED_TABS[t].includes(userRole)
  );
  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0] || "ventas");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (tabsRef.current) {
      const activeButton = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
      if (activeButton) {
        setUnderlineStyle({
          left: activeButton.offsetLeft,
          width: activeButton.offsetWidth,
        });
      }
    }
     
  }, [activeTab]);

  const renderTab = () => {
    switch (activeTab) {
      case "ventas":
        return (
          <VentasReport
            initialData={initialVentas}
            usuarios={usuarios}
            userRole={userRole}
          />
        );
      case "cierres":
        return (
          <CierresReport
            initialData={initialCierres}
            usuarios={usuarios}
            userRole={userRole}
          />
        );
      case "productos":
        return (
          <ProductosReport
            initialData={initialProductos}
            categorias={categorias}
            proveedores={proveedores}
            userRole={userRole}
          />
        );
      case "empleados":
        return (
          <EmpleadosReport
            initialData={initialEmpleados}
            userRole={userRole}
          />
        );
      case "clientes":
        return (
          <ClientesReport
            initialData={initialClientes}
            userRole={userRole}
          />
        );
      case "proveedores":
        return (
          <ProveedoresReport
            initialData={initialProveedores}
            userRole={userRole}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="relative bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-lg)] p-1 w-full">
        <div
          ref={tabsRef}
          className="relative flex w-full overflow-x-auto scrollbar-hide"
        >
          {/* Animated underline indicator */}
          <div
            className="absolute bottom-0 h-0.5 bg-[var(--brand)] rounded-full transition-all duration-200 ease-out"
            style={underlineStyle}
          />

          {availableTabs.map((tab) => (
            <button
              key={tab}
              data-tab={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                activeTab === tab
                  ? "text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]"
              }`}
            >
              {TAB_META[tab].icon}
              <span className="hidden sm:inline">{TAB_META[tab].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-200">
        {renderTab()}
      </div>
    </div>
  );
}
