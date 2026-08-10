import type { EmpleadosDashboard, ProveedoresDashboard } from "@/actions/informes";

/** Métricas que el sistema NO puede obtener hoy — se muestran como banner en el informe. */
export const FALTAN_DATOS_EMPLEADOS = [
  "Quién editó productos (precio/stock), clientes o proveedores — no hay campo createdBy/updatedBy ni log",
  "Quién cerró cada caja — solo queda quién la abrió",
  "Comisiones reales — no hay campo ni tabla; el 5% actual está hardcodeado e inventado",
  "Logins/sesiones/horas trabajadas — no se registran",
];

export const EMPTY_EMPLEADOS_DASHBOARD: EmpleadosDashboard = {
  resumen: { total: 0, activos: 0, administradores: 0, encargadosVentas: 0, encargadosStock: 0, actividadPeriodo: 0 },
  empleados: [],
  actividadPorDia: [],
  actividadPorModulo: [],
  actividadReciente: [],
  faltanDatos: FALTAN_DATOS_EMPLEADOS,
};

/** Dashboard de proveedores vacío — mismo shape que ProveedoresDashboard, todo en 0. */
export const EMPTY_PROVEEDORES_DASHBOARD: ProveedoresDashboard = {
  resumen: {
    totalProveedores: 0,
    activos: 0,
    inactivos: 0,
    productosConProveedor: 0,
    proveedoresSinCompras: 0,
    proveedorPrincipal: null,
  },
  productosPorProveedor: [],
  participacion: [],
  valorCostoPorProveedor: [],
  reposicionResumen: [],
  reposicionDetalle: [],
  proveedores: [],
  filtros: { categorias: [], marcas: [] },
};
