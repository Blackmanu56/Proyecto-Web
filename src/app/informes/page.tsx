import React from "react";
import { getSession } from "@/lib/auth.server";
import {
  getReporteVentas,
  getReporteCierres,
  getReporteProductos,
  getReporteEmpleados,
  getProveedoresReport,
  getUsuariosActivos,
  getClientesDashboard,
  type ClientesDashboard,
} from "@/actions/informes";
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
  clientesPorGasto: [],
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
    canSeeEmpleados ? getReporteEmpleados(hoyStr, hoyStr) : Promise.resolve([]),
    canSeeClientes ? getClientesDashboard() : Promise.resolve(EMPTY_CLIENTES_DASHBOARD),
    canSeeProveedores ? getProveedoresReport({ page: 1, limit: 50 }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }),
    getUsuariosActivos(),
    getCategorias(),
    getProveedores(),
    canSeeClientes ? getClientesDistinct() : Promise.resolve([]),
    canSeeVentas ? getMetodosPago() : Promise.resolve([]),
  ]);

  return (
    <div className="flex-1 bg-[var(--bg)] pt-2 pb-4 md:pt-3 md:pb-6 lg:pt-4 lg:pb-8">
      <div className="max-w-screen-2xl mx-auto space-y-4 px-6 md:px-8 xl:px-10">
        {/* Encabezado */}
        <div className="flex items-center justify-center gap-2 shrink-0 mb-1">
          <div className="p-1.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <BarChart3 size={16} />
          </div>
          <h1 className="text-base lg:text-lg font-extrabold text-[var(--text)] tracking-tight">
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
