"use server";

import { requirePermission } from "@/lib/auth-permissions";
import { calcularEfectivoCajaActiva } from "@/lib/caja-balance";
import { prisma } from "@/lib/prisma";
import { formatDate,formatDateShort } from "@/lib/utils";
import { formatMovimientoDescripcion } from "@/lib/movimiento-format";
import type { Prisma } from "@prisma/client";

export interface DashboardData {
  stats: {
    ventasHoy: number;
    ingresosCaja: number;
    stockBajoCount: number;
    totalClientes: number;
    ventasHoyCount: number;
    productosSinStock: number;
    productosActivosCount: number;
    movimientosInventarioHoy: number;
    comprasHoy: number;
    clientesAtendidosHoy: number;
    proveedoresActivos: number;
  };
  ventasGrafico: { fecha: string; total: number }[];
  productosMasVendidos: { nombre: string; cantidad: number }[];
  categoriaVentas: { name: string; value: number }[];
  cajaMovimientosRecientes: {
    id: number;
    descripcion: string;
    monto: number;
    tipo: string;
    fecha: string;
    username: string;
  }[];
  prediccionesStock: {
    productoId: number;
    nombre: string;
    stockActual: number;
    promedioVentaMensual: number;
    diasRestantes: number;
    sugerenciaCompra: number;
    proveedor: string;
  }[];
}

/**
 * Obtiene todos los indicadores de negocio, datos para gráficos y predicciones de stock
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    await requirePermission("informes.ver");
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

    // 1. Estadísticas básicas
    // Ventas de hoy (monto total)
    const ventasHoyDb = await prisma.venta.aggregate({
      where: {
        fecha: {
          gte: hoyInicio,
          lte: hoyFin,
        },
      },
      _sum: {
        total: true,
      },
    });

    // Ventas de hoy (cantidad de operaciones)
    const ventasHoyCountDb = await prisma.venta.count({
      where: {
        fecha: {
          gte: hoyInicio,
          lte: hoyFin,
        },
      },
    });

    // Saldo en caja activa
    const cajaActiva = await prisma.caja.findFirst({
      where: { estado: "ABIERTA" },
      include: {
        movimientos: {
          select: { tipo: true, monto: true },
        },
      },
    });
    const ingresosCajaVal = calcularEfectivoCajaActiva(cajaActiva);

    // Conteo stock bajo
    const stockBajoDb = await prisma.producto.count({
      where: {
        activo: true,
        cantidad: {
          lte: prisma.producto.fields.stockMinimo,
        },
      },
    });

    // Productos sin stock (cantidad = 0)
    const productosSinStockDb = await prisma.producto.count({
      where: {
        activo: true,
        cantidad: 0,
      },
    });

    // Productos activos
    const productosActivosCountDb = await prisma.producto.count({
      where: { activo: true },
    });

    // Movimientos de inventario hoy (compras registradas)
    const movimientosInventarioHoyDb = await prisma.compra.count({
      where: {
        fecha: {
          gte: hoyInicio,
          lte: hoyFin,
        },
      },
    });

    // Total clientes
    const clientesCount = await prisma.cliente.count();

    // Clientes atendidos hoy (distintos)
    const clientesAtendidosHoyDb = await prisma.venta.findMany({
      where: {
        fecha: {
          gte: hoyInicio,
          lte: hoyFin,
        },
      },
      select: { clienteId: true },
      distinct: ["clienteId"],
    });
    const clientesAtendidosHoyCount = clientesAtendidosHoyDb.length;

    // Proveedores activos
    const proveedoresActivosDb = await prisma.proveedor.count({
      where: { activo: true },
    });

    // 2. Gráfico de ventas (Últimos 7 días)
    const sieteDiasAtras = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ventasRecientes = await prisma.venta.findMany({
      where: {
        fecha: {
          gte: sieteDiasAtras,
        },
      },
      orderBy: { fecha: "asc" },
    });

    // Agrupar ventas por fecha
    const ventasPorFechaMap: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000);
      const strFecha = formatDateShort(d);
      ventasPorFechaMap[strFecha] = 0;
    }

    ventasRecientes.forEach((v) => {
      const strFecha = formatDateShort(v.fecha);
      if (ventasPorFechaMap[strFecha] !== undefined) {
        ventasPorFechaMap[strFecha] += v.total;
      }
    });

    const ventasGrafico = Object.keys(ventasPorFechaMap).map((key) => ({
      fecha: key,
      total: ventasPorFechaMap[key],
    }));

    // 3. Productos más vendidos
    const detallesVenta = await prisma.detalleVenta.findMany({
      include: {
        producto: {
          include: { categoria: true },
        },
      },
    });

    const agrupadoProductos: { [key: string]: number } = {};
    detallesVenta.forEach((d) => {
      agrupadoProductos[d.producto.nombre] = (agrupadoProductos[d.producto.nombre] || 0) + d.cantidad;
    });

    const productosMasVendidos = Object.keys(agrupadoProductos)
      .map((key) => ({
        nombre: key,
        cantidad: agrupadoProductos[key],
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // 4. Distribución por Categoría (Ventas)
    const agrupadoCategorias: { [key: string]: number } = {};
    detallesVenta.forEach((d) => {
      const catNombre = d.producto.categoria?.nombre || "Sin categoría";
      agrupadoCategorias[catNombre] = (agrupadoCategorias[catNombre] || 0) + d.subtotal;
    });

    const categoriaVentas = Object.keys(agrupadoCategorias).map((key) => ({
      name: key,
      value: agrupadoCategorias[key],
    })).slice(0, 4);

    // 5. Movimientos recientes de caja
    const movimientosCaja = await prisma.movimientoCaja.findMany({
      take: 5,
      orderBy: { fecha: "desc" },
      include: {
        usuario: true,
      },
    });

    const cajaMovimientosRecientes = movimientosCaja.map((m) => ({
      id: m.id,
      descripcion: formatMovimientoDescripcion(m.descripcion),
      monto: m.monto,
      tipo: m.tipo,
      fecha: formatDate(m.fecha),
      username: m.usuario.username,
    }));

    // 6. MOTOR PREDICTIVO DE DEMANDA (TESIS LOGIC)
    // Suponemos una tasa de ventas basadas en el histórico acumulado
    const productosDb = await prisma.producto.findMany({
      where: { activo: true },
      include: { proveedor: true },
    });

    const totalVentasPorProducto: { [key: number]: number } = {};
    detallesVenta.forEach((d) => {
      totalVentasPorProducto[d.productoId] = (totalVentasPorProducto[d.productoId] || 0) + d.cantidad;
    });

    // Simulamos un promedio de ventas mensuales basado en las ventas reales divididas por un factor mensual
    const prediccionesStock = productosDb.map((p) => {
      const ventasTotales = totalVentasPorProducto[p.id] || 0;
      // Asumimos que las ventas ocurrieron en un lapso de 30 días para calcular promedio de velocidad mensual
      const promedioVentaMensual = ventasTotales > 0 ? Math.max(ventasTotales, 5) : 3; 
      
      const ventaDiaria = promedioVentaMensual / 30;
      const diasRestantes = ventaDiaria > 0 ? Math.floor(p.cantidad / ventaDiaria) : 999;
      
      // Sugerir reposición si le queda stock para menos de 15 días
      const sugerenciaCompra = diasRestantes <= 15 ? Math.max(promedioVentaMensual * 1.5 - p.cantidad, 10) : 0;

      return {
        productoId: p.id,
        nombre: p.nombre,
        stockActual: p.cantidad,
        promedioVentaMensual: Math.round(promedioVentaMensual),
        diasRestantes: diasRestantes,
        sugerenciaCompra: Math.round(sugerenciaCompra),
        proveedor: p.proveedor.nombre,
      };
    })
    .filter((pred) => pred.diasRestantes <= 30) // Filtrar solo los que están en riesgo de desabastecimiento en 30 días
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

    return {
      stats: {
        ventasHoy: ventasHoyDb._sum.total || 0,
        ingresosCaja: ingresosCajaVal,
        stockBajoCount: stockBajoDb,
        totalClientes: clientesCount,
        ventasHoyCount: ventasHoyCountDb,
        productosSinStock: productosSinStockDb,
        productosActivosCount: productosActivosCountDb,
        movimientosInventarioHoy: movimientosInventarioHoyDb,
        comprasHoy: movimientosInventarioHoyDb,
        clientesAtendidosHoy: clientesAtendidosHoyCount,
        proveedoresActivos: proveedoresActivosDb,
      },
      ventasGrafico,
      productosMasVendidos,
      categoriaVentas,
      cajaMovimientosRecientes,
      prediccionesStock,
    };

  } catch (error) {
    console.error("Error en getDashboardData:", error);
    return {
      stats: {
        ventasHoy: 0,
        ingresosCaja: 0,
        stockBajoCount: 0,
        totalClientes: 0,
        ventasHoyCount: 0,
        productosSinStock: 0,
        productosActivosCount: 0,
        movimientosInventarioHoy: 0,
        comprasHoy: 0,
        clientesAtendidosHoy: 0,
        proveedoresActivos: 0,
      },
      ventasGrafico: [],
      productosMasVendidos: [],
      categoriaVentas: [],
      cajaMovimientosRecientes: [],
      prediccionesStock: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORTES PARA EL MÓDULO DE INFORMES
// ═══════════════════════════════════════════════════════════════

// ─── Tipos compartidos ─────────────────────────────────────────────

export type ReporteVenta = {
  id: number;
  fecha: string;
  cliente: string;
  usuario: string;
  total: number;
  cantidadProductos: number;
};

export type DetalleVentaCompleto = {
  id: number;
  fecha: string;
  cliente: { id: number; nombre: string; dni: string; cuit: string | null };
  usuario: { id: number; username: string; nombreCompleto: string };
  total: number;
  metodoPago: string | null;
  estado: string;
  detalles: {
    id: number;
    producto: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
};

export type ReporteCierre = {
  id: number;
  fechaApertura: string;
  fechaCierre: string | null;
  usuario: string;
  montoInicial: number;
  totalVentas: number;
  estado: string;
  totalEsperado: number;
  totalContado: number | null;
};

export type DetalleCierreCompleto = ReporteCierre & {
  ingresos: number;
  egresos: number;
  gastosManuales: number;
  diferencia: number | null;
  totalContado: number | null;
  movimientos: {
    id: number;
    tipo: string;
    monto: number;
    descripcion: string;
    fecha: string;
    usuario: string;
    ventaId: number | null;
  }[];
};

export type ReporteProducto = {
  id: number;
  nombre: string;
  categoria: string;
  proveedor: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  totalVendido: number;
  totalIngresado: number;
};

// ─── Tipos compartidos para las nuevas server actions ─────────────────

export interface ReportFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  page?: number;
  limit?: number;
  usuarioId?: number;
  clienteId?: number;
  productoId?: number;
  categoriaId?: number;
  proveedorId?: number;
  metodoPago?: string;
  estado?: string;
  rol?: string;
  tipo?: string;
  conDiferencia?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Fin tipos compartidos ────────────────────────────────────────────

export type ReporteEmpleado = {
  usuarioId: number;
  nombreCompleto: string;
  username: string;
  fotoUrl: string | null;
  rol: string;
  ventasCount: number;
  totalVendido: number;
  cierresCount: number;
};

// ─── 1. REPORTE DE VENTAS ──────────────────────────────────────────

export async function getReporteVentas(
  fechaDesde?: string,
  fechaHasta?: string,
  usuarioId?: number,
  clienteId?: number
  ): Promise<{ ventas: ReporteVenta[]; totales: { cantidad: number; total: number; promedio: number } }> {
  try {
    await requirePermission("informes.ver");
    const where: Prisma.VentaWhereInput = {};

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.fecha.lte = hasta;
      }
    }
    if (usuarioId) where.usuarioId = usuarioId;
    if (clienteId) where.clienteId = clienteId;

    const ventas = await prisma.venta.findMany({
      where,
      include: {
        cliente: { select: { nombre: true } },
        usuario: { select: { username: true } },
        _count: { select: { detalles: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const cantidadVentas = ventas.length;
    const totalVendido = ventas.reduce((sum, v) => sum + v.total, 0);
    const promedio = cantidadVentas > 0 ? totalVendido / cantidadVentas : 0;

    return {
      ventas: ventas.map((v) => ({
        id: v.id,
        fecha: formatDate(v.fecha),
        cliente: v.cliente.nombre,
        usuario: v.usuario.username,
        total: v.total,
        cantidadProductos: v._count.detalles,
      })),
      totales: {
        cantidad: cantidadVentas,
        total: totalVendido,
        promedio: Math.round(promedio * 100) / 100,
      },
    };
  } catch (error) {
    console.error("Error en getReporteVentas:", error);
    return { ventas: [], totales: { cantidad: 0, total: 0, promedio: 0 } };
  }
}

// ─── 2. DETALLE DE VENTA ───────────────────────────────────────────

export async function getDetalleVenta(ventaId: number): Promise<DetalleVentaCompleto | null> {
  try {
    await requirePermission("informes.ver");
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: { select: { id: true, nombre: true, dni: true, cuit: true } },
        usuario: { select: { id: true, username: true, nombreCompleto: true } },
        detalles: {
          include: { producto: { select: { nombre: true } } },
        },
      },
    });

    if (!venta) return null;

    return {
      id: venta.id,
      fecha: formatDate(venta.fecha),
      cliente: venta.cliente,
      usuario: venta.usuario,
      total: venta.total,
      metodoPago: venta.metodoPago,
      estado: venta.estado,
      detalles: venta.detalles.map((d) => ({
        id: d.id,
        producto: d.producto.nombre,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        subtotal: d.subtotal,
      })),
    };
  } catch (error) {
    console.error("Error en getDetalleVenta:", error);
    return null;
  }
}

// ─── 3. REPORTE DE CIERRES DE CAJA ─────────────────────────────────

export async function getReporteCierres(
  fechaDesde?: string,
  fechaHasta?: string,
  usuarioId?: number,
  estado?: string
  ): Promise<ReporteCierre[]> {
  try {
    await requirePermission("informes.ver");
    const where: Prisma.CajaWhereInput = {};

    if (fechaDesde || fechaHasta) {
      where.fechaApertura = {};
      if (fechaDesde) where.fechaApertura.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.fechaApertura.lte = hasta;
      }
    }
    if (usuarioId) where.usuarioId = usuarioId;
    if (estado) where.estado = estado;

    const cajas = await prisma.caja.findMany({
      where,
      include: { usuario: { select: { username: true } } },
      orderBy: { fechaApertura: "desc" },
    });

    return cajas.map((c) => ({
      id: c.id,
      fechaApertura: formatDate(c.fechaApertura),
      fechaCierre: c.fechaCierre ? formatDate(c.fechaCierre) : null,
      usuario: c.usuario.username,
      montoInicial: c.montoInicial,
      totalVentas: c.totalVentas,
      estado: c.estado,
      totalEsperado: c.montoInicial + c.totalVentas,
      totalContado: c.totalContado ?? null,
    }));
  } catch (error) {
    console.error("Error en getReporteCierres:", error);
    return [];
  }
}

// ─── CIERRES MENSUALES (agrupado por año-mes de fecha_cierre) ───────

export type CierreMensual = {
  mes: string;            // "YYYY-MM" — año-mes LOCAL de fecha_cierre
  anio: number;
  mesLabel: string;       // Etiqueta es-AR, ej. "Agosto"
  totalCierres: number;   // Filas del grupo
  cerrados: number;       // Conteo CERRADA (== totalCierres bajo el filtro; se mantiene por REQ-02)
  montoInicial: number;   // Suma de montoInicial
  totalVentas: number;    // Suma de totalVentas
  totalEsperado: number;  // Suma de (montoInicial + totalVentas) por fila
  totalContado: number;   // Suma de (totalContado ?? 0)
  diferenciaNeta: number; // Suma de ((totalContado ?? totalEsperado) - totalEsperado) → null aporta 0
  conDiferencia: number;  // Filas con diferencia ≠ 0 (null excluidas, REQ-03)
};

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export async function getCierresMensuales(
  fechaDesde?: string,
  fechaHasta?: string,
  empleadoId?: number
): Promise<CierreMensual[]> {
  try {
    await requirePermission("informes.ver");
    const where: Prisma.CajaWhereInput = {};

    // Rango: cierres cerrados por fecha_cierre; cajas abiertas (fecha_cierre null) por fecha_apertura
    if (fechaDesde || fechaHasta) {
      const rangoCierre: Prisma.DateTimeNullableFilter = {};
      const rangoApertura: Prisma.DateTimeFilter = {};
      if (fechaDesde) {
        rangoCierre.gte = new Date(fechaDesde);
        rangoApertura.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        rangoCierre.lte = hasta;
        rangoApertura.lte = hasta;
      }
      where.OR = [
        { fechaCierre: rangoCierre },
        { fechaCierre: null, fechaApertura: rangoApertura },
      ];
    }
    if (empleadoId) where.usuarioId = empleadoId;

    const cajas = await prisma.caja.findMany({
      where,
      include: { usuario: { select: { username: true } } },
      orderBy: [{ fechaCierre: "asc" }, { fechaApertura: "asc" }],
    });

    // Agrupación por año-mes LOCAL: cerradas por fecha_cierre (getFullYear/getMonth,
    // NO getUTC*); abiertas (fecha_cierre null) por fecha_apertura.
    // Nota: una caja abierta el 31 a las 23:50 y cerrada el 1 a las 00:10 se resume
    // bajo el mes de fecha_cierre, aunque su arqueo aparezca en la expansión del mes
    // anterior (getReporteCierres filtra por fechaApertura — queries existentes intactas).
    const grupos = new Map<string, CierreMensual & { mesNum: number }>();
    for (const c of cajas) {
      const f = c.fechaCierre ?? c.fechaApertura; // cierres → mes de cierre; abiertas → mes de apertura
      const anio = f.getFullYear();
      const mesNum = f.getMonth() + 1;
      const key = `${anio}-${String(mesNum).padStart(2, "0")}`;

      const totalEsperado = c.montoInicial + c.totalVentas;
      const contado = c.totalContado ?? 0;
      const diff = (c.totalContado ?? totalEsperado) - totalEsperado;

      let g = grupos.get(key);
      if (!g) {
        g = {
          mes: key,
          anio,
          mesNum,
          mesLabel: MESES_ES[mesNum - 1],
          totalCierres: 0,
          cerrados: 0,
          montoInicial: 0,
          totalVentas: 0,
          totalEsperado: 0,
          totalContado: 0,
          diferenciaNeta: 0,
          conDiferencia: 0,
        };
        grupos.set(key, g);
      }
      g.totalCierres += 1;
      if (c.estado === "CERRADA") g.cerrados += 1;
      g.montoInicial += c.montoInicial;
      g.totalVentas += c.totalVentas;
      g.totalEsperado += totalEsperado;
      g.totalContado += contado;
      g.diferenciaNeta += diff;
      if (c.totalContado !== null && diff !== 0) g.conDiferencia += 1;
    }

    return Array.from(grupos.values())
      .sort((a, b) => b.anio * 100 + b.mesNum - (a.anio * 100 + a.mesNum))
      .map((g): CierreMensual => ({
        mes: g.mes,
        anio: g.anio,
        mesLabel: g.mesLabel,
        totalCierres: g.totalCierres,
        cerrados: g.cerrados,
        montoInicial: g.montoInicial,
        totalVentas: g.totalVentas,
        totalEsperado: g.totalEsperado,
        totalContado: g.totalContado,
        diferenciaNeta: g.diferenciaNeta,
        conDiferencia: g.conDiferencia,
      }));
  } catch (error) {
    console.error("Error en getCierresMensuales:", error);
    return [];
  }
}

// ─── CIERRES DEL MES (detalle para expansión mensual; misma lógica de agrupación que getCierresMensuales) ───────
export async function getCierresDelMes(mes: string): Promise<ReporteCierre[]> {
  try {
    await requirePermission("informes.ver");
    // F1: fechas locales sin Z. mes = "YYYY-MM"
    const [anioStr, mesStr] = mes.split("-");
    const anio = Number(anioStr);
    const mesNum = Number(mesStr);
    const inicio = new Date(anio, mesNum - 1, 1, 0, 0, 0, 0);         // día 1 00:00:00
    const fin = new Date(anio, mesNum, 0, 23, 59, 59, 999);           // último día 23:59:59.999

    const where: Prisma.CajaWhereInput = {
      OR: [
        { fechaCierre: { gte: inicio, lte: fin } },                    // cerradas en el mes → mes de cierre
        { fechaCierre: null, fechaApertura: { gte: inicio, lte: fin } }, // abiertas con apertura en el mes
      ],
    };

    const cajas = await prisma.caja.findMany({
      where,
      include: { usuario: { select: { username: true } } },
      orderBy: { fechaApertura: "desc" },
    });

    return cajas.map((c) => ({
      id: c.id,
      fechaApertura: formatDate(c.fechaApertura),
      fechaCierre: c.fechaCierre ? formatDate(c.fechaCierre) : null,
      usuario: c.usuario.username,
      montoInicial: c.montoInicial,
      totalVentas: c.totalVentas,
      estado: c.estado,
      totalEsperado: c.montoInicial + c.totalVentas,
      totalContado: c.totalContado ?? null,
    }));
  } catch (error) {
    console.error("Error en getCierresDelMes:", error);
    return [];
  }
}

// ─── 4. DETALLE DE CIERRE DE CAJA ──────────────────────────────────

export async function getDetalleCierre(cajaId: number): Promise<DetalleCierreCompleto | null> {
  try {
    await requirePermission("informes.ver");
    const caja = await prisma.caja.findUnique({
      where: { id: cajaId },
      include: {
        usuario: { select: { username: true } },
        movimientos: {
          include: { usuario: { select: { username: true } } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    if (!caja) return null;

    const ingresos = caja.movimientos
      .filter((m) => m.tipo === "INGRESO")
      .reduce((sum, m) => sum + m.monto, 0);
    const egresos = caja.movimientos
      .filter((m) => m.tipo === "EGRESO")
      .reduce((sum, m) => sum + m.monto, 0);

    const totalEsperado = caja.montoInicial + caja.totalVentas;
    const diferencia = caja.totalContado !== null ? caja.totalContado - totalEsperado : null;

    return {
      id: caja.id,
      fechaApertura: formatDate(caja.fechaApertura),
      fechaCierre: caja.fechaCierre ? formatDate(caja.fechaCierre) : null,
      usuario: caja.usuario.username,
      montoInicial: caja.montoInicial,
      totalVentas: caja.totalVentas,
      gastosManuales: caja.gastosManuales,
      estado: caja.estado,
      totalEsperado,
      ingresos,
      egresos,
      diferencia,
      totalContado: caja.totalContado,
      movimientos: caja.movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: formatMovimientoDescripcion(m.descripcion),
        fecha: formatDate(m.fecha),
        usuario: m.usuario.username,
        ventaId: m.ventaId,
      })),
    };
  } catch (error) {
    console.error("Error en getDetalleCierre:", error);
    return null;
  }
}

// ─── 5. REPORTE DE PRODUCTOS ───────────────────────────────────────

export async function getReporteProductos(
  categoriaId?: number,
  proveedorId?: number,
  activo?: boolean
  ): Promise<ReporteProducto[]> {
  try {
    await requirePermission("informes.ver");
    const where: Prisma.ProductoWhereInput = {};
    if (activo !== undefined) where.activo = activo;
    if (categoriaId) where.categoriaId = categoriaId;
    if (proveedorId) where.proveedorId = proveedorId;

    const productos = await prisma.producto.findMany({
      where,
      include: {
        categoria: { select: { nombre: true } },
        proveedor: { select: { nombre: true } },
        detalleVentas: {
          select: { cantidad: true, subtotal: true },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria.nombre,
      proveedor: p.proveedor.nombre,
      precioCompra: p.precioCompra,
      precioVenta: p.precioVenta,
      cantidad: p.cantidad,
      stockMinimo: p.stockMinimo,
      activo: p.activo,
      totalVendido: p.detalleVentas.reduce((sum, d) => sum + d.cantidad, 0),
      totalIngresado: p.detalleVentas.reduce((sum, d) => sum + d.subtotal, 0),
    }));
  } catch (error) {
    console.error("Error en getReporteProductos:", error);
    return [];
  }
}

// ─── 6. PRODUCTOS MÁS VENDIDOS ─────────────────────────────────────

export async function getProductosMasVendidos(limit: number = 10): Promise<{ nombre: string; cantidad: number; ingreso: number; categoria: string }[]> {
  try {
    await requirePermission("informes.ver");
    const detalles = await prisma.detalleVenta.findMany({
      include: {
        producto: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: { [key: number]: { nombre: string; categoria: string; cantidad: number; ingreso: number } } = {};
    for (const d of detalles) {
      if (!agrupado[d.productoId]) {
        agrupado[d.productoId] = {
          nombre: d.producto.nombre,
          categoria: d.producto.categoria.nombre,
          cantidad: 0,
          ingreso: 0,
        };
      }
      agrupado[d.productoId].cantidad += d.cantidad;
      agrupado[d.productoId].ingreso += d.subtotal;
    }

    return Object.values(agrupado)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limit);
  } catch (error) {
    console.error("Error en getProductosMasVendidos:", error);
    return [];
  }
}

// ─── 7. PRODUCTOS CON MAYOR INGRESO ────────────────────────────────

export async function getProductosMayorIngreso(limit: number = 10): Promise<{ nombre: string; cantidad: number; ingreso: number; categoria: string }[]> {
  try {
    await requirePermission("informes.ver");
    const detalles = await prisma.detalleVenta.findMany({
      include: {
        producto: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: { [key: number]: { nombre: string; categoria: string; cantidad: number; ingreso: number } } = {};
    for (const d of detalles) {
      if (!agrupado[d.productoId]) {
        agrupado[d.productoId] = {
          nombre: d.producto.nombre,
          categoria: d.producto.categoria.nombre,
          cantidad: 0,
          ingreso: 0,
        };
      }
      agrupado[d.productoId].cantidad += d.cantidad;
      agrupado[d.productoId].ingreso += d.subtotal;
    }

    return Object.values(agrupado)
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, limit);
  } catch (error) {
    console.error("Error en getProductosMayorIngreso:", error);
    return [];
  }
}

// ─── 8. REPORTE DE EMPLEADOS ───────────────────────────────────────

export async function getReporteEmpleados(
  fechaDesde?: string,
  fechaHasta?: string
  ): Promise<ReporteEmpleado[]> {
  try {
    await requirePermission("informes.ver");
    const whereVentas: Prisma.VentaWhereInput = {};
    if (fechaDesde || fechaHasta) {
      whereVentas.fecha = {};
      if (fechaDesde) whereVentas.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        whereVentas.fecha.lte = hasta;
      }
    }

    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      include: {
        rol: { select: { nombre: true } },
        ventas: {
          where: whereVentas,
          select: { total: true },
        },
      },
    });

    const whereCierres: Prisma.CajaWhereInput = {};
    if (fechaDesde || fechaHasta) {
      whereCierres.fechaApertura = {};
      if (fechaDesde) whereCierres.fechaApertura.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        whereCierres.fechaApertura.lte = hasta;
      }
    }

    const cierresPorUsuario: { [key: number]: number } = {};
    const cierres = await prisma.caja.groupBy({
      by: ["usuarioId"],
      where: whereCierres,
      _count: { id: true },
    });
    for (const c of cierres) {
      cierresPorUsuario[c.usuarioId] = c._count.id;
    }

    return usuarios.map((u) => ({
      usuarioId: u.id,
      nombreCompleto: u.nombreCompleto,
      username: u.username,
      fotoUrl: u.fotoUrl,
      rol: u.rol.nombre,
      ventasCount: u.ventas.length,
      totalVendido: u.ventas.reduce((sum, v) => sum + v.total, 0),
      cierresCount: cierresPorUsuario[u.id] || 0,
    }));
  } catch (error) {
    console.error("Error en getReporteEmpleados:", error);
    return [];
  }
}

// ─── 9. OBTENER USUARIOS PARA FILTROS ──────────────────────────────

export async function getUsuariosActivos() {
  try {
    await requirePermission("informes.ver");
    return await prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, username: true, nombreCompleto: true },
      orderBy: { nombreCompleto: "asc" },
    });
  } catch (error) {
    console.error("Error en getUsuariosActivos:", error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// NUEVAS SERVER ACTIONS (Phase 2)
// ═══════════════════════════════════════════════════════════════

// ─── Helpers ─────────────────────────────────────────────────

type DateRangeFilter = { gte?: Date; lte?: Date };

function buildDateFilter(fechaDesde?: string, fechaHasta?: string): Prisma.VentaWhereInput;
function buildDateFilter(fechaDesde: string | undefined, fechaHasta: string | undefined, field: "fechaApertura"): Prisma.CajaWhereInput;
function buildDateFilter(
  fechaDesde?: string,
  fechaHasta?: string,
  field: "fecha" | "fechaApertura" = "fecha"
): Prisma.VentaWhereInput | Prisma.CajaWhereInput {
  if (!fechaDesde && !fechaHasta) return {};

  const range: DateRangeFilter = {};
  if (fechaDesde) range.gte = new Date(fechaDesde);
  if (fechaHasta) {
    const hasta = new Date(fechaHasta);
    hasta.setHours(23, 59, 59, 999);
    range.lte = hasta;
  }

  return field === "fechaApertura" ? { fechaApertura: range } : { fecha: range };
}

function buildMovimientoCajaDateFilter(fechaDesde?: string, fechaHasta?: string): Prisma.MovimientoCajaWhereInput {
  if (!fechaDesde && !fechaHasta) return {};

  const range: DateRangeFilter = {};
  if (fechaDesde) range.gte = new Date(fechaDesde);
  if (fechaHasta) {
    const hasta = new Date(fechaHasta);
    hasta.setHours(23, 59, 59, 999);
    range.lte = hasta;
  }

  return { fecha: range };
}

function paginate(page: number = 1, limit: number = 50): { skip: number; take: number } {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return { skip: (page - 1) * safeLimit, take: safeLimit };
}

// ─── 10. REPORTE CLIENTES ────────────────────────────────────

export async function getClientesReport(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; nombre: string; dni: string; totalGastado: number; frecuencia: number;
  ultimaCompra: string | null; cantidadCompras: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      include: {
        ventas: {
          where: dateFilter.fecha ? { fecha: dateFilter.fecha } : undefined,
          select: { id: true, total: true, fecha: true },
        },
      },
      orderBy: { nombre: "asc" },
      skip,
      take,
    });

    const total = await prisma.cliente.count({ where: { activo: true } });

    const data = clientes.map((c) => {
      const totalGastado = c.ventas.reduce((sum, v) => sum + v.total, 0);
      const fechas = c.ventas.map((v) => v.fecha).sort((a, b) => a.getTime() - b.getTime());
      const frecuencia = fechas.length > 1
        ? (fechas[fechas.length - 1].getTime() - fechas[0].getTime()) / (fechas.length - 1) / 86400000
        : 0;

      return {
        id: c.id,
        nombre: c.nombre,
        dni: c.dni,
        totalGastado,
        frecuencia: Math.round(frecuencia),
        ultimaCompra: fechas.length > 0
          ? formatDateShort(fechas[fechas.length - 1])
          : null,
        cantidadCompras: c.ventas.length,
      };
    });

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getClientesReport:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 11. REPORTE PROVEEDORES ─────────────────────────────────

export async function getProveedoresReport(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; nombre: string; cuit: string; productosCount: number;
  valorStock: number; stockBajoCount: number; ultimaCompra: string | null;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);

    const whereProveedor: Prisma.ProveedorWhereInput = {};
    if (filters.proveedorId) whereProveedor.id = filters.proveedorId;
    if (filters.categoriaId) {
      whereProveedor.productos = { some: { categoriaId: filters.categoriaId } };
    }

    const proveedores = await prisma.proveedor.findMany({
      where: whereProveedor,
      include: {
        productos: {
          include: { categoria: { select: { nombre: true } } },
        },
        compras: {
          orderBy: { fecha: "desc" },
          take: 1,
          select: { fecha: true },
        },
      },
      orderBy: { nombre: "asc" },
      skip,
      take,
    });

    const total = await prisma.proveedor.count({ where: whereProveedor });

    const data = proveedores.map((p) => {
      const productosFiltrados = filters.categoriaId
        ? p.productos.filter((prod) => prod.categoriaId === filters.categoriaId)
        : p.productos;

      return {
        id: p.id,
        nombre: p.nombre,
        cuit: p.cuit,
        productosCount: productosFiltrados.length,
        valorStock: productosFiltrados.reduce((sum, prod) => sum + prod.precioCompra * prod.cantidad, 0),
        stockBajoCount: productosFiltrados.filter((prod) => prod.cantidad < prod.stockMinimo).length,
        ultimaCompra: p.compras[0]?.fecha ? formatDateShort(p.compras[0].fecha) : null,
      };
    });

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getProveedoresReport:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 12. VENTAS POR PRODUCTO ─────────────────────────────────

// ─── 14. VENTAS POR PRODUCTO ─────────────────────────────────

export async function getVentasPorProducto(filters: ReportFilters = {}): Promise<PaginatedResult<{
  productoId: number; producto: string; categoria: string; cantidad: number;
  subtotal: number; ganancia: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const whereDetalle: Prisma.DetalleVentaWhereInput = {};
    if (dateFilter.fecha) whereDetalle.venta = { fecha: dateFilter.fecha };
    if (filters.categoriaId) whereDetalle.producto = { categoriaId: filters.categoriaId };
    if (filters.productoId) whereDetalle.productoId = filters.productoId;

    const detalles = await prisma.detalleVenta.findMany({
      where: whereDetalle,
      include: {
        producto: { select: { nombre: true, precioCompra: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: Record<number, { producto: string; categoria: string; cantidad: number; subtotal: number; ganancia: number }> = {};

    for (const d of detalles) {
      if (!agrupado[d.productoId]) {
        agrupado[d.productoId] = {
          producto: d.producto.nombre,
          categoria: d.producto.categoria.nombre,
          cantidad: 0,
          subtotal: 0,
          ganancia: 0,
        };
      }
      agrupado[d.productoId].cantidad += d.cantidad;
      agrupado[d.productoId].subtotal += d.subtotal;
      agrupado[d.productoId].ganancia += d.subtotal - (d.cantidad * d.producto.precioCompra);
    }

    const sorted = Object.entries(agrupado)
      .map(([productoId, val]) => ({ productoId: Number(productoId), ...val }))
      .sort((a, b) => b.subtotal - a.subtotal);

    const total = sorted.length;
    const data = sorted.slice(skip, skip + take);

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getVentasPorProducto:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 15. VENTAS POR CATEGORÍA ────────────────────────────────

export async function getVentasPorCategoria(filters: ReportFilters = {}): Promise<{
  data: { categoria: string; cantidad: number; subtotal: number; ganancia: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);
    const whereDetalle: Prisma.DetalleVentaWhereInput = {};
    if (dateFilter.fecha) whereDetalle.venta = { fecha: dateFilter.fecha };

    const detalles = await prisma.detalleVenta.findMany({
      where: whereDetalle,
      include: {
        producto: { select: { nombre: true, precioCompra: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: Record<string, { cantidad: number; subtotal: number; ganancia: number }> = {};
    for (const d of detalles) {
      const cat = d.producto.categoria.nombre;
      if (!agrupado[cat]) agrupado[cat] = { cantidad: 0, subtotal: 0, ganancia: 0 };
      agrupado[cat].cantidad += d.cantidad;
      agrupado[cat].subtotal += d.subtotal;
      agrupado[cat].ganancia += d.subtotal - (d.cantidad * d.producto.precioCompra);
    }

    const data = Object.entries(agrupado)
      .map(([categoria, vals]) => ({ categoria, ...vals }))
      .sort((a, b) => b.subtotal - a.subtotal);

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getVentasPorCategoria:", error);
    return { data: [], total: 0 };
  }
}

// ─── 16. VENTAS POR CLIENTE ──────────────────────────────────

export async function getVentasPorCliente(filters: ReportFilters = {}): Promise<PaginatedResult<{
  clienteId: number; cliente: string; cantidad: number; total: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const whereVenta: Prisma.VentaWhereInput = { ...dateFilter };
    if (filters.clienteId) whereVenta.clienteId = filters.clienteId;

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      include: { cliente: { select: { nombre: true } } },
    });

    const agrupado: Record<number, { cliente: string; cantidad: number; total: number }> = {};
    for (const v of ventas) {
      if (!agrupado[v.clienteId]) {
        agrupado[v.clienteId] = { cliente: v.cliente.nombre, cantidad: 0, total: 0 };
      }
      agrupado[v.clienteId].cantidad += 1;
      agrupado[v.clienteId].total += v.total;
    }

    const sorted = Object.entries(agrupado)
      .map(([clienteId, vals]) => ({ clienteId: Number(clienteId), ...vals }))
      .sort((a, b) => b.total - a.total);

    const total = sorted.length;
    const data = sorted.slice(skip, skip + take);

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getVentasPorCliente:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 17. VENTAS POR VENDEDOR + COMISIONES ────────────────────

export async function getVentasPorVendedorComision(filters: ReportFilters = {}): Promise<PaginatedResult<{
  usuarioId: number; vendedor: string; cantidadVentas: number; totalVendido: number;
  comision: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const whereVenta: Prisma.VentaWhereInput = { ...dateFilter };
    if (filters.usuarioId) whereVenta.usuarioId = filters.usuarioId;

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      include: { usuario: { select: { nombreCompleto: true } } },
    });

    const agrupado: Record<number, { vendedor: string; cantidadVentas: number; totalVendido: number }> = {};
    for (const v of ventas) {
      if (!agrupado[v.usuarioId]) {
        agrupado[v.usuarioId] = { vendedor: v.usuario.nombreCompleto, cantidadVentas: 0, totalVendido: 0 };
      }
      agrupado[v.usuarioId].cantidadVentas += 1;
      agrupado[v.usuarioId].totalVendido += v.total;
    }

    const sorted = Object.entries(agrupado)
      .map(([usuarioId, vals]) => ({
        usuarioId: Number(usuarioId),
        ...vals,
        comision: Math.round(vals.totalVendido * 0.05 * 100) / 100, // 5% commission
      }))
      .sort((a, b) => b.totalVendido - a.totalVendido);

    const total = sorted.length;
    const data = sorted.slice(skip, skip + take);

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getVentasPorVendedorComision:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 18. TOP PRODUCTOS ───────────────────────────────────────

export async function getTopProductos(filters: ReportFilters = {}, limit: number = 10): Promise<{
  data: { productoId: number; producto: string; categoria: string; cantidad: number; ingreso: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);
    const whereDetalle: Prisma.DetalleVentaWhereInput = {};
    if (dateFilter.fecha) whereDetalle.venta = { fecha: dateFilter.fecha };
    if (filters.categoriaId) whereDetalle.producto = { categoriaId: filters.categoriaId };
    if (filters.productoId) whereDetalle.productoId = filters.productoId;

    const detalles = await prisma.detalleVenta.findMany({
      where: whereDetalle,
      include: {
        producto: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: Record<number, { producto: string; categoria: string; cantidad: number; ingreso: number }> = {};
    for (const d of detalles) {
      if (!agrupado[d.productoId]) {
        agrupado[d.productoId] = {
          producto: d.producto.nombre,
          categoria: d.producto.categoria.nombre,
          cantidad: 0,
          ingreso: 0,
        };
      }
      agrupado[d.productoId].cantidad += d.cantidad;
      agrupado[d.productoId].ingreso += d.subtotal;
    }

    const sorted = Object.entries(agrupado)
      .map(([productoId, vals]) => ({ productoId: Number(productoId), ...vals }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limit);

    return { data: sorted, total: sorted.length };
  } catch (error) {
    console.error("Error en getTopProductos:", error);
    return { data: [], total: 0 };
  }
}

// ─── 19. BOTTOM PRODUCTOS ────────────────────────────────────

export async function getBottomProductos(filters: ReportFilters = {}, limit: number = 10): Promise<{
  data: { productoId: number; producto: string; categoria: string; cantidad: number; ingreso: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);
    const whereDetalle: Prisma.DetalleVentaWhereInput = {};
    if (dateFilter.fecha) whereDetalle.venta = { fecha: dateFilter.fecha };

    const detalles = await prisma.detalleVenta.findMany({
      where: whereDetalle,
      include: {
        producto: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      },
    });

    const agrupado: Record<number, { producto: string; categoria: string; cantidad: number; ingreso: number }> = {};
    for (const d of detalles) {
      if (!agrupado[d.productoId]) {
        agrupado[d.productoId] = {
          producto: d.producto.nombre,
          categoria: d.producto.categoria.nombre,
          cantidad: 0,
          ingreso: 0,
        };
      }
      agrupado[d.productoId].cantidad += d.cantidad;
      agrupado[d.productoId].ingreso += d.subtotal;
    }

    const sorted = Object.entries(agrupado)
      .map(([productoId, vals]) => ({ productoId: Number(productoId), ...vals }))
      .filter((p) => p.cantidad > 0)
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, limit);

    return { data: sorted, total: sorted.length };
  } catch (error) {
    console.error("Error en getBottomProductos:", error);
    return { data: [], total: 0 };
  }
}

// ─── 20. CIERRES MOVIMIENTOS ─────────────────────────────────

export async function getCierresMovimientos(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; cajaId: number; tipo: string; monto: number;
  descripcion: string; fecha: string; usuario: string;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const where: Prisma.MovimientoCajaWhereInput = buildMovimientoCajaDateFilter(filters.fechaDesde, filters.fechaHasta);
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;

    const [movimientos, total] = await Promise.all([
      prisma.movimientoCaja.findMany({
        where,
        include: { usuario: { select: { username: true } } },
        orderBy: { fecha: "desc" },
        skip,
        take,
      }),
      prisma.movimientoCaja.count({ where }),
    ]);

    const data = movimientos.map((m) => ({
      id: m.id,
      cajaId: m.cajaId,
      tipo: m.tipo,
      monto: m.monto,
      descripcion: formatMovimientoDescripcion(m.descripcion),
      fecha: formatDate(m.fecha),
      usuario: m.usuario.username,
    }));

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getCierresMovimientos:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 21. CIERRES DIFERENCIAS ─────────────────────────────────

export async function getCierresDiferencias(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; usuario: string; fechaApertura: string; fechaCierre: string | null;
  totalEsperado: number; totalContado: number | null; diferencia: number | null;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta, "fechaApertura");

    const where: Prisma.CajaWhereInput = { ...dateFilter, NOT: { totalContado: null } };
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;

    const cajas = await prisma.caja.findMany({
      where,
      include: { usuario: { select: { username: true } } },
      orderBy: { fechaApertura: "desc" },
    });

    const withDiff = cajas
      .map((c) => {
        const totalEsperado = c.montoInicial + c.totalVentas;
        const diferencia = c.totalContado !== null ? c.totalContado - totalEsperado : null;
        return {
          id: c.id,
          usuario: c.usuario.username,
          fechaApertura: formatDate(c.fechaApertura),
          fechaCierre: c.fechaCierre ? formatDate(c.fechaCierre) : null,
          totalEsperado,
          totalContado: c.totalContado,
          diferencia,
        };
      })
      .filter((c) => filters.conDiferencia ? c.diferencia !== 0 : true)
      .sort((a, b) => Math.abs(b.diferencia ?? 0) - Math.abs(a.diferencia ?? 0));

    const total = withDiff.length;
    const data = withDiff.slice(skip, skip + take);

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getCierresDiferencias:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 22. RENTABILIDAD PRODUCTOS ──────────────────────────────

export async function getRentabilidadProductos(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; producto: string; categoria: string; precioCompra: number;
  precioVenta: number; margen: number; margenPorc: number; vendido: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);

    const whereProducto: Prisma.ProductoWhereInput = { activo: true };
    if (filters.categoriaId) whereProducto.categoriaId = filters.categoriaId;
    if (filters.proveedorId) whereProducto.proveedorId = filters.proveedorId;

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where: whereProducto,
        include: {
          categoria: { select: { nombre: true } },
          detalleVentas: { select: { cantidad: true } },
        },
        orderBy: { nombre: "asc" },
        skip,
        take,
      }),
      prisma.producto.count({ where: whereProducto }),
    ]);

    const data = productos.map((p) => {
      const margen = p.precioVenta - p.precioCompra;
      const margenPorc = p.precioCompra > 0 ? (margen / p.precioCompra) * 100 : 100;
      return {
        id: p.id,
        producto: p.nombre,
        categoria: p.categoria.nombre,
        precioCompra: p.precioCompra,
        precioVenta: p.precioVenta,
        margen,
        margenPorc: Math.round(margenPorc * 100) / 100,
        vendido: p.detalleVentas.reduce((sum, d) => sum + d.cantidad, 0),
      };
    });

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getRentabilidadProductos:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 23. REPOSICIÓN PRODUCTOS ────────────────────────────────

export async function getReposicionProductos(): Promise<{
  data: { id: number; producto: string; stockActual: number; stockMinimo: number;
           proveedor: string; sugerencia: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        cantidad: { lte: prisma.producto.fields.stockMinimo },
      },
      include: { proveedor: { select: { nombre: true } } },
      orderBy: { cantidad: "asc" },
    });

    const data = productos.map((p) => ({
      id: p.id,
      producto: p.nombre,
      stockActual: p.cantidad,
      stockMinimo: p.stockMinimo,
      proveedor: p.proveedor.nombre,
      sugerencia: Math.max(p.stockMinimo * 2 - p.cantidad, 10),
    }));

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getReposicionProductos:", error);
    return { data: [], total: 0 };
  }
}

// ─── 24. SIN MOVIMIENTO PRODUCTOS ────────────────────────────

export async function getSinMovimientoProductos(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; producto: string; categoria: string; stockActual: number;
  precioVenta: number; ultimaVenta: string | null;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);

    const whereProducto: Prisma.ProductoWhereInput = { activo: true };
    if (filters.categoriaId) whereProducto.categoriaId = filters.categoriaId;
    if (filters.proveedorId) whereProducto.proveedorId = filters.proveedorId;

    const productos = await prisma.producto.findMany({
      where: whereProducto,
      include: {
        categoria: { select: { nombre: true } },
        detalleVentas: {
          orderBy: { id: "desc" },
          take: 1,
          include: { venta: { select: { fecha: true } } },
        },
      },
      orderBy: { nombre: "asc" },
    });

    const sinMovimiento = productos.filter((p) => p.detalleVentas.length === 0);
    const total = sinMovimiento.length;
    const data = sinMovimiento.slice(skip, skip + take).map((p) => ({
      id: p.id,
      producto: p.nombre,
      categoria: p.categoria.nombre,
      stockActual: p.cantidad,
      precioVenta: p.precioVenta,
      ultimaVenta: null,
    }));

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getSinMovimientoProductos:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 25. RANKING VENDEDORES ──────────────────────────────────

export async function getRankingVendedores(filters: ReportFilters = {}): Promise<{
  data: { usuarioId: number; vendedor: string; rol: string; ventas: number;
           totalVendido: number; promedioVenta: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const whereUsuario: Prisma.UsuarioWhereInput = { activo: true };
    if (filters.rol) whereUsuario.rol = { nombre: filters.rol };
    if (filters.usuarioId) whereUsuario.id = filters.usuarioId;

    const whereVentas: Prisma.VentaWhereInput = { ...dateFilter };

    const usuarios = await prisma.usuario.findMany({
      where: whereUsuario,
      include: {
        rol: { select: { nombre: true } },
        ventas: {
          where: whereVentas,
          select: { total: true },
        },
      },
      orderBy: { nombreCompleto: "asc" },
    });

    const data = usuarios
      .map((u) => ({
        usuarioId: u.id,
        vendedor: u.nombreCompleto,
        rol: u.rol.nombre,
        ventas: u.ventas.length,
        totalVendido: u.ventas.reduce((sum, v) => sum + v.total, 0),
        promedioVenta: u.ventas.length > 0
          ? Math.round((u.ventas.reduce((sum, v) => sum + v.total, 0) / u.ventas.length) * 100) / 100
          : 0,
      }))
      .sort((a, b) => b.totalVendido - a.totalVendido);

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getRankingVendedores:", error);
    return { data: [], total: 0 };
  }
}

// ─── 26. ACTIVIDAD RECIENTE VENDEDORES ───────────────────────

export async function getActividadRecienteVendedores(): Promise<{
  data: { usuarioId: number; vendedor: string; ultimaVenta: string | null;
           ultimoCierre: string | null; ventasHoy: number; ventasSemana: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const semanaAtras = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      include: {
        ventas: {
          orderBy: { fecha: "desc" },
          take: 1,
          select: { fecha: true },
        },
        cajas: {
          orderBy: { fechaCierre: "desc" },
          take: 1,
          select: { fechaCierre: true },
        },
        _count: {
          select: {
            ventas: {
              where: { fecha: { gte: hoyInicio } },
            },
          },
        },
      },
    });

    const data = usuarios.map((u) => {
      const ventasSemana = u.ventas.filter(
        (v) => v.fecha >= semanaAtras
      ).length;

      return {
        usuarioId: u.id,
        vendedor: u.nombreCompleto,
        ultimaVenta: u.ventas[0]?.fecha
          ? formatDate(u.ventas[0].fecha)
          : null,
        ultimoCierre: u.cajas[0]?.fechaCierre
          ? formatDate(u.cajas[0].fechaCierre)
          : null,
        ventasHoy: u._count.ventas,
        ventasSemana,
      };
    });

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getActividadRecienteVendedores:", error);
    return { data: [], total: 0 };
  }
}

// ─── 27. GANANCIAS POR PERÍODO ───────────────────────────────

export async function getGananciasPeriodo(filters: ReportFilters = {}): Promise<{
  data: { periodo: string; venta: number; costo: number; ganancia: number }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const dateFilter = buildDateFilter(filters.fechaDesde, filters.fechaHasta);

    const ventas = await prisma.venta.findMany({
      where: dateFilter,
      include: {
        detalles: {
          include: { producto: { select: { precioCompra: true } } },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const agrupado: Record<string, { venta: number; costo: number }> = {};
    const agruparPor = filters.search || "dia"; // dia | semana | mes

    for (const v of ventas) {
      let periodo: string;
      if (agruparPor === "mes") {
        periodo = formatDateShort(v.fecha);
      } else if (agruparPor === "semana") {
        const inicioSemana = new Date(v.fecha);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
        periodo = formatDateShort(inicioSemana);
      } else {
        periodo = formatDateShort(v.fecha);
      }

      if (!agrupado[periodo]) agrupado[periodo] = { venta: 0, costo: 0 };
      agrupado[periodo].venta += v.total;
      agrupado[periodo].costo += v.detalles.reduce((s, d) => s + d.cantidad * d.producto.precioCompra, 0);
    }

    const data = Object.entries(agrupado)
      .map(([periodo, vals]) => ({
        periodo,
        ...vals,
        ganancia: vals.venta - vals.costo,
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getGananciasPeriodo:", error);
    return { data: [], total: 0 };
  }
}

// ─── 28. FRECUENCIA COMPRAS CLIENTE ──────────────────────────

export async function getFrecuenciaComprasCliente(): Promise<{
  data: { clienteId: number; cliente: string; cantidadCompras: number;
           frecuenciaDias: number; categoria: string }[];
  total: number;
}> {
  try {
    await requirePermission("informes.ver");
    const clientes = await prisma.cliente.findMany({
      where: { activo: true, ventas: { some: {} } },
      include: {
        ventas: {
          select: { fecha: true, total: true },
          orderBy: { fecha: "asc" },
        },
      },
    });

    const data = clientes.map((c) => {
      const fechas = c.ventas.map((v) => v.fecha);
      const frecuenciaDias = fechas.length > 1
        ? (fechas[fechas.length - 1].getTime() - fechas[0].getTime()) / (fechas.length - 1) / 86400000
        : 0;

      let categoria = "Nuevo";
      if (frecuenciaDias <= 7) categoria = "Frecuente";
      else if (frecuenciaDias <= 30) categoria = "Regular";
      else if (frecuenciaDias <= 90) categoria = "Ocasional";
      else categoria = "Inactivo";

      return {
        clienteId: c.id,
        cliente: c.nombre,
        cantidadCompras: c.ventas.length,
        frecuenciaDias: Math.round(frecuenciaDias),
        categoria,
      };
    }).sort((a, b) => a.frecuenciaDias - b.frecuenciaDias);

    return { data, total: data.length };
  } catch (error) {
    console.error("Error en getFrecuenciaComprasCliente:", error);
    return { data: [], total: 0 };
  }
}

// ─── 30. EVOLUCIÓN DE VENTAS PARA GRÁFICO ───────────────────

export async function getEvolucionVentas(
  fechaDesde?: string,
  fechaHasta?: string,
  agruparPor: "dia" | "semana" | "mes" | "anio" = "dia"
): Promise<{ data: { periodo: string; ventas: number; ganancia: number; fechaInicio: string; fechaFin: string }[] }> {
  try {
    await requirePermission("informes.ver");

    const dateFilter = buildDateFilter(fechaDesde, fechaHasta);

    const ventas = await prisma.venta.findMany({
      where: dateFilter,
      include: {
        detalles: {
          include: { producto: { select: { precioCompra: true } } },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const agrupado: Record<string, { ventas: number; costo: number; fecha: Date; fechaFin: Date }> = {};
    for (const v of ventas) {
      let periodo: string;
      let fechaFin = v.fecha;
      if (agruparPor === "anio") {
        periodo = v.fecha.toLocaleDateString("es-AR", { year: "numeric" });
      } else if (agruparPor === "mes") {
        periodo = v.fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      } else if (agruparPor === "semana") {
        // Calcular inicio de semana (lunes) usando fecha local para evitar bug de timezone
        const y = v.fecha.getFullYear();
        const m = v.fecha.getMonth();
        const d = v.fecha.getDate();
        const dayOfWeek = v.fecha.getDay(); // 0=Dom, 1=Lun, ...
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const inicioLocal = new Date(y, m, d - diffToMonday);
        const finLocal = new Date(y, m, d - diffToMonday + 6);
        fechaFin = finLocal;
        // Calcular número de semana real según el día del mes del lunes
        const diaDelMes = inicioLocal.getDate();
        const numSemana = Math.ceil(diaDelMes / 7);
        const mesLargo = inicioLocal.toLocaleDateString("es-AR", { month: "long" });
        periodo = `S${numSemana} ${mesLargo}`;
      } else {
        periodo = v.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
      }

      if (!agrupado[periodo]) agrupado[periodo] = { ventas: 0, costo: 0, fecha: v.fecha, fechaFin };
      agrupado[periodo].ventas += v.total;
      agrupado[periodo].costo += v.detalles.reduce(
        (s, d) => s + d.cantidad * d.producto.precioCompra,
        0
      );
    }

    const data = Object.entries(agrupado)
      .map(([periodo, vals]) => ({
        periodo,
        ventas: vals.ventas,
        ganancia: vals.ventas - vals.costo,
        fechaInicio: vals.fecha.toISOString(),
        fechaFin: vals.fechaFin.toISOString(),
      }))
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

    return { data };
  } catch (error) {
    console.error("Error en getEvolucionVentas:", error);
    return { data: [] };
  }
}

// ─── 29. STOCK BAJO ──────────────────────────────────────────

export async function getStockBajo(filters: ReportFilters = {}): Promise<PaginatedResult<{
  id: number; producto: string; categoria: string; stockActual: number;
  stockMinimo: number; proveedor: string; precioVenta: number;
}>> {
  try {
    await requirePermission("informes.ver");
    const page = filters.page || 1;
    const { skip, take } = paginate(page);

    const where: Prisma.ProductoWhereInput = {
      activo: true,
      cantidad: { lte: prisma.producto.fields.stockMinimo },
    };
    if (filters.proveedorId) where.proveedorId = filters.proveedorId;
    if (filters.categoriaId) where.categoriaId = filters.categoriaId;

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        include: {
          categoria: { select: { nombre: true } },
          proveedor: { select: { nombre: true } },
        },
        orderBy: { cantidad: "asc" },
        skip,
        take,
      }),
      prisma.producto.count({ where }),
    ]);

    const data = productos.map((p) => ({
      id: p.id,
      producto: p.nombre,
      categoria: p.categoria.nombre,
      stockActual: p.cantidad,
      stockMinimo: p.stockMinimo,
      proveedor: p.proveedor.nombre,
      precioVenta: p.precioVenta,
    }));

    return { data, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
  } catch (error) {
    console.error("Error en getStockBajo:", error);
    return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ─── 30. DATOS DE GRÁFICOS DEL DASHBOARD (FILTRADOS) ──────────

export type DashboardPeriod =
  | "diario"
  | "semanal"
  | "mensual"
  | "ultimos3"
  | "ultimos5"
  | "ultimos7"
  | "ultimos15"
  | "ultimos35";

export type DashboardChartType = "categorias" | "productos" | "marcas";

export type DashboardChartDataResult = {
  evolutionData: { fecha: string; total: number }[];
  pieData: { name: string; value: number }[];
  period: DashboardPeriod;
  chartType: DashboardChartType;
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD CLIENTES (rediseño completo del informe de clientes)
// Fuente única de datos para toda la pantalla — sin filtro de período,
// sin fechas. F1: fechas locales, nunca UTC/"Z".
// ═══════════════════════════════════════════════════════════════

export type ClienteDashboardCliente = {
  id: number;
  nombre: string;
  dni: string;
  activo: boolean;
  creadoEn: string;
  cantidadCompras: number;
  totalGastado: number;
  ultimaCompra: string | null;
};

export type ClientesDashboard = {
  resumen: {
    total: number;
    activos: number;
    inactivos: number;
    nuevos30d: number;
    topCliente: { nombre: string; total: number } | null;
    totalFacturado: number;
  };
  activosInactivos: { name: string; value: number }[];
  nuevosPorMes: { mes: string; label: string; cantidad: number }[];
  distribucionGasto: { rango: string; clientes: number }[];
  top10: { clienteId: number; nombre: string; total: number }[];
  frecuencia: { clienteId: number; nombre: string; cantidad: number }[];
  sinComprar90d: { clienteId: number; nombre: string; ultimaCompra: string; dias: number }[];
  clientesPorGasto: { clienteId: number; nombre: string; cantidad: number; total: number; ultimaCompra: string | null; promedio: number }[];
  clientesCompleto: ClienteDashboardCliente[];
};

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

export async function getClientesDashboard(): Promise<ClientesDashboard> {
  try {
    await requirePermission("informes.ver");
    const ahora = new Date();

    // 1. Conteos base + total facturado + agregados por cliente + todos los clientes (una sola pasada)
    const [total, activos, inactivos, nuevos30d, totalFacturadoDb, ventasGroup, clientes] = await Promise.all([
      prisma.cliente.count(),
      prisma.cliente.count({ where: { activo: true } }),
      prisma.cliente.count({ where: { activo: false } }),
      prisma.cliente.count({
        where: { creadoEn: { gte: new Date(ahora.getTime() - 30 * 86400000) } },
      }),
      prisma.venta.aggregate({
        where: { estado: "COMPLETADA" },
        _sum: { total: true },
      }),
      prisma.venta.groupBy({
        by: ["clienteId"],
        where: { estado: "COMPLETADA" },
        _count: { id: true },
        _sum: { total: true },
        _max: { fecha: true },
      }),
      prisma.cliente.findMany({
        select: { id: true, nombre: true, dni: true, activo: true, creadoEn: true },
      }),
    ]);

    // 2. Merge en JS: agregados por cliente + nombres
    const aggMap = new Map<number, { cantidad: number; total: number; ultima: Date | null }>();
    for (const g of ventasGroup) {
      aggMap.set(g.clienteId, {
        cantidad: g._count.id,
        total: g._sum.total ?? 0,
        ultima: g._max.fecha ?? null,
      });
    }
    const nombreMap = new Map(clientes.map((c) => [c.id, c.nombre]));

    // 3. Clientes completos (TODOS, con o sin ventas) — orden alfabético
    const clientesCompleto: ClienteDashboardCliente[] = clientes
      .map((c) => {
        const agg = aggMap.get(c.id);
        return {
          id: c.id,
          nombre: c.nombre,
          dni: c.dni,
          activo: c.activo,
          creadoEn: formatDate(c.creadoEn),
          cantidadCompras: agg?.cantidad ?? 0,
          totalGastado: agg?.total ?? 0,
          ultimaCompra: agg?.ultima ? formatDateShort(agg.ultima) : null,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // 4. Clientes por gasto (solo con compras) — orden por total desc
    const clientesPorGasto = Array.from(aggMap.entries())
      .filter(([, agg]) => agg.cantidad > 0)
      .map(([clienteId, agg]) => ({
        clienteId,
        nombre: nombreMap.get(clienteId) ?? "Sin nombre",
        cantidad: agg.cantidad,
        total: agg.total,
        ultimaCompra: agg.ultima ? formatDateShort(agg.ultima) : null,
        promedio: Math.round((agg.total / agg.cantidad) * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    // 5. Top 10 por gasto
    const top10 = clientesPorGasto.slice(0, 10).map((c) => ({
      clienteId: c.clienteId,
      nombre: c.nombre,
      total: c.total,
    }));

    // 6. Frecuencia de compra (top 10 por cantidad de compras)
    const frecuencia = [...clientesPorGasto]
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
      .map((c) => ({ clienteId: c.clienteId, nombre: c.nombre, cantidad: c.cantidad }));

    // 7. Clientes sin comprar hace más de 90 días (más inactivo primero)
    const corte90 = ahora.getTime() - 90 * 86400000;
    const sinComprar90d = Array.from(aggMap.entries())
      .filter(([, agg]) => agg.ultima !== null && agg.ultima.getTime() < corte90)
      .map(([clienteId, agg]) => ({
        clienteId,
        nombre: nombreMap.get(clienteId) ?? "Sin nombre",
        ultimaCompra: formatDateShort(agg.ultima as Date),
        dias: Math.floor((ahora.getTime() - (agg.ultima as Date).getTime()) / 86400000),
      }))
      .sort((a, b) => b.dias - a.dias);

    // 8. Activos vs Inactivos (doughnut)
    const activosInactivos = [
      { name: "Activos", value: activos },
      { name: "Inactivos", value: inactivos },
    ];

    // 9. Nuevos por mes — últimos 12 meses incluido el actual (F1: año/mes local)
    const inicio12 = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1, 0, 0, 0, 0);
    const clientesUltimoAnio = await prisma.cliente.findMany({
      where: { creadoEn: { gte: inicio12 } },
      select: { creadoEn: true },
    });
    const porMes = new Map<string, number>();
    for (const c of clientesUltimoAnio) {
      const key = `${c.creadoEn.getFullYear()}-${String(c.creadoEn.getMonth() + 1).padStart(2, "0")}`;
      porMes.set(key, (porMes.get(key) ?? 0) + 1);
    }
    const nuevosPorMes = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - 11 + i, 1);
      const mesNum = d.getMonth();
      const anio = d.getFullYear();
      const key = `${anio}-${String(mesNum + 1).padStart(2, "0")}`;
      return {
        mes: key,
        label: `${MESES_ES[mesNum].slice(0, 3)} ${anio}`,
        cantidad: porMes.get(key) ?? 0,
      };
    });

    // 10. Distribución por nivel de gasto (4 buckets; clientes sin ventas van al bucket 0)
    const BUCKETS_GASTO = [
      { rango: "$0 - $50.000", min: 0, max: 50000 },
      { rango: "$50.000 - $100.000", min: 50000, max: 100000 },
      { rango: "$100.000 - $300.000", min: 100000, max: 300000 },
      { rango: "Más de $300.000", min: 300000, max: Infinity },
    ];
    const distribucionGasto = BUCKETS_GASTO.map((b) => ({
      rango: b.rango,
      clientes: clientes.filter((c) => {
        const gasto = aggMap.get(c.id)?.total ?? 0;
        return gasto >= b.min && gasto < b.max;
      }).length,
    }));

    return {
      resumen: {
        total,
        activos,
        inactivos,
        nuevos30d,
        topCliente: top10[0] ? { nombre: top10[0].nombre, total: top10[0].total } : null,
        totalFacturado: totalFacturadoDb._sum.total ?? 0,
      },
      activosInactivos,
      nuevosPorMes,
      distribucionGasto,
      top10,
      frecuencia,
      sinComprar90d,
      clientesPorGasto,
      clientesCompleto,
    };
  } catch (error) {
    console.error("Error en getClientesDashboard:", error);
    return EMPTY_CLIENTES_DASHBOARD;
  }
}

export async function getDashboardChartData(
  period: DashboardPeriod = "ultimos7",
  chartType: DashboardChartType = "categorias"
): Promise<DashboardChartDataResult> {
  try {
    await requirePermission("informes.ver");
    const ahora = new Date();

    // ── Calcular rango de fechas según período ──
    let fechaDesde: Date;
    const fechaHasta: Date = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

    switch (period) {
      case "diario":
        fechaDesde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        break;
      case "semanal":
        fechaDesde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "mensual":
        fechaDesde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        break;
      case "ultimos3":
        fechaDesde = new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000);
        break;
      case "ultimos5":
        fechaDesde = new Date(ahora.getTime() - 4 * 24 * 60 * 60 * 1000);
        break;
      case "ultimos7":
        fechaDesde = new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000);
        break;
      case "ultimos15":
        fechaDesde = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "ultimos35":
        fechaDesde = new Date(ahora.getTime() - 34 * 24 * 60 * 60 * 1000);
        break;
      default:
        fechaDesde = new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000);
    }

    // ── Traer ventas del rango ──
    const ventas = await prisma.venta.findMany({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      orderBy: { fecha: "asc" },
    });

    // ── 1. Evolución de ventas (AreaChart) ──
    let evolutionData: { fecha: string; total: number }[] = [];

    if (period === "diario") {
      // Agrupar por hora
      const porHora: { [hora: string]: number } = {};
      for (let h = 0; h <= 23; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        porHora[label] = 0;
      }
      ventas.forEach((v) => {
        const label = `${String(v.fecha.getHours()).padStart(2, "0")}:00`;
        if (porHora[label] !== undefined) porHora[label] += v.total;
      });
      evolutionData = Object.entries(porHora).map(([fecha, total]) => ({ fecha, total }));
    } else if (period === "mensual") {
      // Agrupar por semana del mes
      const porSemana: { [key: string]: number } = {};
      ventas.forEach((v) => {
        const diaMes = v.fecha.getDate();
        const numSemana = Math.ceil(diaMes / 7);
        const label = `Sem ${numSemana}`;
        porSemana[label] = (porSemana[label] || 0) + v.total;
      });
      evolutionData = Object.entries(porSemana).map(([fecha, total]) => ({ fecha, total }));
    } else if (period === "semanal") {
      // Agrupar por día de la semana
      const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const porDia: { [key: string]: number } = {};
      nombresDias.forEach((d) => (porDia[d] = 0));
      ventas.forEach((v) => {
        const label = nombresDias[v.fecha.getDay()];
        porDia[label] += v.total;
      });
      evolutionData = Object.entries(porDia).map(([fecha, total]) => ({ fecha, total }));
    } else {
      // Últimos X días: agrupar por fecha
      const dias = parseInt(period.replace("ultimos", ""), 10);
      const porFecha: { [key: string]: number } = {};
      for (let i = dias - 1; i >= 0; i--) {
        const d = new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000);
        const label = formatDateShort(d);
        porFecha[label] = 0;
      }
      ventas.forEach((v) => {
        const label = formatDateShort(v.fecha);
        if (porFecha[label] !== undefined) porFecha[label] += v.total;
      });
      evolutionData = Object.entries(porFecha).map(([fecha, total]) => ({ fecha, total }));
    }

    // ── 2. Pie chart según tipo seleccionado ──
    let pieData: { name: string; value: number }[] = [];

    const detalles = await prisma.detalleVenta.findMany({
      where: { venta: { fecha: { gte: fechaDesde, lte: fechaHasta } } },
      include: {
        producto: {
          select: {
            nombre: true,
            marca: true,
            categoria: { select: { nombre: true } },
          },
        },
      },
    });

    if (chartType === "categorias") {
      const agrupado: { [key: string]: number } = {};
      detalles.forEach((d) => {
        const cat = d.producto.categoria?.nombre || "Sin categoría";
        agrupado[cat] = (agrupado[cat] || 0) + d.subtotal;
      });
      pieData = Object.entries(agrupado)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    } else if (chartType === "productos") {
      const agrupado: { [key: string]: number } = {};
      detalles.forEach((d) => {
        agrupado[d.producto.nombre] = (agrupado[d.producto.nombre] || 0) + d.cantidad;
      });
      pieData = Object.entries(agrupado)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    } else if (chartType === "marcas") {
      const agrupado: { [key: string]: number } = {};
      detalles.forEach((d) => {
        const marca = d.producto.marca || "Sin marca";
        agrupado[marca] = (agrupado[marca] || 0) + d.subtotal;
      });
      pieData = Object.entries(agrupado)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }

    return { evolutionData, pieData, period, chartType };
  } catch (error) {
    console.error("Error en getDashboardChartData:", error);
    return { evolutionData: [], pieData: [], period, chartType };
  }
}
