import React from "react";
import { getSession } from "@/lib/auth.server";
import {
  getReporteVentas,
  getReporteCierres,
  getReporteProductos,
  getReporteEmpleados,
  getClientesReport,
  getProveedoresReport,
  getUsuariosActivos,
} from "@/actions/informes";
import { getCategorias, getProveedores, getClientesDistinct, getMetodosPago } from "@/actions/auxiliares";
import InformesTabs from "@/components/reports/InformesTabs";
import { BarChart3 } from "lucide-react";

export default async function InformesPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Carga inicial de datos (hoy)
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

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
    canSeeClientes ? getClientesReport({ fechaDesde: hoyStr, fechaHasta: hoyStr, page: 1, limit: 50 }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }),
    canSeeProveedores ? getProveedoresReport({ page: 1, limit: 50 }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }),
    getUsuariosActivos(),
    getCategorias(),
    getProveedores(),
    canSeeClientes ? getClientesDistinct() : Promise.resolve([]),
    canSeeVentas ? getMetodosPago() : Promise.resolve([]),
  ]);

  return (
    <div className="flex-1 bg-[var(--bg)] p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="p-3 bg-[var(--brand-light)] rounded-2xl text-[var(--brand)] border border-[var(--brand)]/10">
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text)] tracking-tight">
                Informes
              </h1>
              <p className="text-[var(--text-muted)] text-xs md:text-sm mt-0.5 font-medium">
                Analice ventas, cierres de caja, productos y rendimiento del equipo.
              </p>
            </div>
          </div>
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
