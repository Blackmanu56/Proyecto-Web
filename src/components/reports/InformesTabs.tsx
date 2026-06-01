"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import "./report.css";
import { BarChart3, Wallet, Package, Users, UserCheck, Building, Landmark, Shield } from "lucide-react";
import VentasReport from "./VentasReport";
import CierresReport from "./CierresReport";
import ProductosReport from "./ProductosReport";
import EmpleadosReport from "./EmpleadosReport";

const ClientesReport = dynamic(() => import("./ClientesReport"), {
  loading: () => <div className="text-center py-12 text-slate-400 text-sm">Cargando Clientes...</div>,
});

const ProveedoresReport = dynamic(() => import("./ProveedoresReport"), {
  loading: () => <div className="text-center py-12 text-slate-400 text-sm">Cargando Proveedores...</div>,
});

const FinanzasReport = dynamic(() => import("./FinanzasReport"), {
  loading: () => <div className="text-center py-12 text-slate-400 text-sm">Cargando Finanzas...</div>,
});

const AuditoriaReport = dynamic(() => import("./AuditoriaReport"), {
  loading: () => <div className="text-center py-12 text-slate-400 text-sm">Cargando Auditoría...</div>,
});

type TabId = "ventas" | "cierres" | "productos" | "empleados" | "clientes" | "proveedores" | "finanzas" | "auditoria";

const ALLOWED_TABS: Record<TabId, string[]> = {
  ventas: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  cierres: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  productos: ["ADMINISTRADOR", "ENCARGADO_VENTAS", "ENCARGADO_STOCK"],
  empleados: ["ADMINISTRADOR"],
  clientes: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  proveedores: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  finanzas: ["ADMINISTRADOR", "ENCARGADO_VENTAS"],
  auditoria: ["ADMINISTRADOR"],
};

const TAB_META: Record<TabId, { label: string; icon: React.ReactNode }> = {
  ventas: { label: "Ventas", icon: <BarChart3 size={16} /> },
  cierres: { label: "Cierres de Caja", icon: <Wallet size={16} /> },
  productos: { label: "Productos", icon: <Package size={16} /> },
  empleados: { label: "Empleados", icon: <Users size={16} /> },
  clientes: { label: "Clientes", icon: <UserCheck size={16} /> },
  proveedores: { label: "Proveedores", icon: <Building size={16} /> },
  finanzas: { label: "Finanzas", icon: <Landmark size={16} /> },
  auditoria: { label: "Auditoría", icon: <Shield size={16} /> },
};

interface Props {
  initialVentas: any;
  initialCierres: any;
  initialProductos: any;
  initialEmpleados: any;
  initialClientes?: any;
  initialProveedores?: any;
  initialFinanzas?: any;
  initialAuditoria?: any;
  usuarios: any[];
  categorias: any[];
  proveedores: any[];
  clientesDistinct?: any[];
  metodosPago?: any[];
  userRole: string;
}

export default function InformesTabs({
  initialVentas,
  initialCierres,
  initialProductos,
  initialEmpleados,
  initialClientes,
  initialProveedores,
  initialFinanzas,
  initialAuditoria,
  usuarios,
  categorias,
  proveedores,
  clientesDistinct,
  metodosPago,
  userRole,
}: Props) {
  const availableTabs = (Object.keys(ALLOWED_TABS) as TabId[]).filter(
    (t) => ALLOWED_TABS[t].includes(userRole)
  );
  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0] || "ventas");

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
      case "finanzas":
        return (
          <FinanzasReport
            initialData={initialFinanzas}
            userRole={userRole}
          />
        );
      case "auditoria":
        return (
          <AuditoriaReport
            initialData={initialAuditoria}
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
      <div className="flex flex-wrap gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            {TAB_META[tab].icon}
            {TAB_META[tab].label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTab()}
    </div>
  );
}
