import React from "react";
import { getSession } from "@/lib/auth.server";
import {
  getReporteVentas,
  getReporteCierres,
  getReporteProductos,
  getReporteEmpleados,
  getClientesReport,
  getProveedoresReport,
  getFinanzasReport,
  getAuditoriaReport,
  getUsuariosActivos,
} from "@/actions/informes";
import { getCategorias, getProveedores, getClientesDistinct, getMetodosPago } from "@/actions/auxiliares";
import InformesTabs from "@/components/reports/InformesTabs";
import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function InformesPage() {
  const session = await getSession();
  const userRole = session?.role || "";

  // Carga inicial de datos (hoy)
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

  const [
    ventasData, cierresData, productosData, empleadosData,
    clientesData, proveedoresData, finanzasData, auditoriaData,
    usuarios, categorias, proveedores, clientesDistinct, metodosPago,
  ] = await Promise.all([
    getReporteVentas(hoyStr, hoyStr),
    getReporteCierres(hoyStr, hoyStr),
    getReporteProductos(),
    getReporteEmpleados(hoyStr, hoyStr),
    getClientesReport({ fechaDesde: hoyStr, fechaHasta: hoyStr, page: 1, limit: 50 }),
    getProveedoresReport({ page: 1, limit: 50 }),
    getFinanzasReport({ fechaDesde: hoyStr, fechaHasta: hoyStr }),
    getAuditoriaReport({ page: 1, limit: 50 }),
    getUsuariosActivos(),
    getCategorias(),
    getProveedores(),
    getClientesDistinct(),
    getMetodosPago(),
  ]);

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/10">
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Informes
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
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
          initialFinanzas={finanzasData}
          initialAuditoria={auditoriaData}
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
