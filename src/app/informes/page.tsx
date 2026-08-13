import React from "react";
import { getSession } from "@/lib/auth.server";
import {
  getReporteVentas,
  getReporteCierres,
  getReporteProductos,
  getEmpleadosDashboard,
  getProveedoresDashboard,
  getUsuariosActivos,
  getClientesDashboard,
  type ClientesDashboard,
} from "@/actions/informes";
import { EMPTY_EMPLEADOS_DASHBOARD, EMPTY_PROVEEDORES_DASHBOARD } from "@/lib/report-constants";
import { getCategorias, getProveedores, getClientesDistinct, getMetodosPago } from "@/actions/auxiliares";
import { formatLocalDateTimeStart } from "@/lib/reportPeriods";
import InformesTabs from "@/components/reports/InformesTabs";
import { BarChart3 } from "lucide-react";

// Shape vacía para roles sin acceso a la pestaña de clientes
const EMPTY_CLIENTES_DASHBOARD: ClientesDashboard = {
  resumen: { total: 0, activos: 0, inactivos: 0, nuevos30d: 0, topCliente: null, totalFacturado: 0 },
  activosInactivos: [],
  nuevosPorMes: [],
  distribucionGasto: [],
  top10: [],
  frecuencia: [],
  sinComprar90d: [],
  clientesCompleto: [],
};

export default async function InformesPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Carga inicial de datos (hoy) — F1: datetime local completo sin Z
  const hoyStr = formatLocalDateTimeStart(new Date());

  // Filtrar datos según el rol para evitar cargar datos innecesarios
  const canSeeVentas = ["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(userRole);
  const canSeeCierres = ["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(userRole);
  const canSeeEmpleados = userRole === "ADMINISTRADOR";
  const canSeeClientes = ["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(userRole);
  const canSeeProductos = ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole);
  const canSeeProveedores = ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole);

  const [
    ventasData, cierresData, productosData, empleadosData,
    clientesData, proveedoresData,
    usuarios, categorias, proveedores, clientesDistinct, metodosPago,
  ] = await Promise.all([
    canSeeVentas ? getReporteVentas(hoyStr, hoyStr) : Promise.resolve({ ventas: [], totales: { cantidad: 0, total: 0, promedio: 0 } }),
    canSeeCierres ? getReporteCierres(hoyStr, hoyStr) : Promise.resolve([]),
    canSeeProductos ? getReporteProductos() : Promise.resolve([]),
    canSeeEmpleados ? getEmpleadosDashboard(hoyStr, hoyStr) : Promise.resolve(EMPTY_EMPLEADOS_DASHBOARD),
    canSeeClientes ? getClientesDashboard() : Promise.resolve(EMPTY_CLIENTES_DASHBOARD),
    canSeeProveedores ? getProveedoresDashboard() : Promise.resolve(EMPTY_PROVEEDORES_DASHBOARD),
    getUsuariosActivos(),
    getCategorias(),
    getProveedores(),
    canSeeClientes ? getClientesDistinct() : Promise.resolve([]),
    canSeeVentas ? getMetodosPago() : Promise.resolve([]),
  ]);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-2 lg:p-3 space-y-3">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-3 shrink-0 mb-2 text-center">
          <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
            <BarChart3 size={24} />
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight">
            Informes
          </h1>
        </div>

        {/* Tabs + Contenido (Client Component) */}
        <InformesTabs
          initialVentas={ventasData}
          initialCierres={cierresData}
          initialProductos={productosData}
          initialEmpleados={empleadosData}
          initialClientes={clientesData}
          initialProveedores={proveedoresData}
          usuarios={usuarios}
          categorias={categorias}
          proveedores={proveedores}
          clientesDistinct={clientesDistinct}
          metodosPago={metodosPago}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
