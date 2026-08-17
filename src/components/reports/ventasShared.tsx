"use client";

/* ─── Tipos compartidos entre el contenedor de Ventas y sus sub-vistas ── */

export interface ResumenVentas {
  cantidad: number;
  total: number;
  productosVendidos: number;
  clientesAtendidos: number;
}

export interface AnalisisCache {
  resumen: ResumenVentas;
  prevResumen: ResumenVentas | null;
  evolucion: {
    periodo: string;
    ventas: number;
    ganancia: number;
    fechaInicio: string;
    fechaFin: string;
  }[];
  categoria: { categoria: string; cantidad: number; subtotal: number }[];
  metodoPago: { metodo: string; cantidadVentas: number; total: number }[];
  topProductos: {
    productoId: number;
    producto: string;
    categoria: string;
    cantidad: number;
    ingreso: number;
  }[];
  topClientes: { clienteId: number; cliente: string; cantidad: number; total: number }[];
  vendedores: {
    usuarioId: number;
    vendedor: string;
    cantidadVentas: number;
    totalVendido: number;
    comision: number;
  }[];
  diaSemana: { dow: number; ventas: number; total: number }[]; // 0=lunes … 6=domingo
}

export type ChartGranularity = "dia" | "semana" | "mes" | "anio";

export type SortKey = "fecha" | "cliente" | "vendedor" | "cantidad" | "total";
export type SortDir = "asc" | "desc";

// Dirección por defecto del primer clic en cada columna
export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  fecha: "desc",
  cliente: "asc",
  vendedor: "asc",
  cantidad: "desc",
  total: "desc",
};

/** Fila de la tabla de ventas (shape de getReporteVentas). */
export interface ReporteVentaRow {
  id: number;
  fecha: string;
  cliente: string;
  usuario: string;
  total: number;
  cantidadProductos: number;
}

/** Respuesta completa de getReporteVentas (shape NO modificable). */
export type VentasReportData = {
  ventas: ReporteVentaRow[];
  totales: { cantidad: number; total: number; promedio: number };
};

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Encabezado visible solo en impresión (copiado de VentasReport.tsx L750-755). */
export function ReportPrintHeader({ desde, hasta }: { desde: string; hasta: string }) {
  return (
    <div className="hidden print:block text-center mb-6">
      <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
      <p className="text-sm">Informe de Ventas</p>
      <p className="text-xs text-gray-500">
        {desde} al {hasta}
      </p>
      <hr className="my-2 border-gray-300" />
    </div>
  );
}
