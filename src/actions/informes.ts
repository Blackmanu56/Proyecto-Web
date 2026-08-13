"use server";

import { requirePermission } from "@/lib/auth-permissions";
import { calcularEfectivoCajaActiva } from "@/lib/caja-balance";
import { parseRoleData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateShort, formatTime24 } from "@/lib/utils";
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
      descripcion: m.descripcion,
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
  usuarioCierre: string | null;   // quien cerró la caja (movimiento CIERRE), si existe
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
      .map(({ mesNum, ...g }) => g);
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

    const movimientoCierre = caja.movimientos.find((m) => m.tipo === "CIERRE");

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
      usuarioCierre: movimientoCierre?.usuario.username ?? null,
      movimientos: caja.movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
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

// ─── 8b. DASHBOARD DE EMPLEADOS (actividad y uso del sistema) ─────

export type EmpleadoActividadItem = {
  id: string;          // key único, ej. "venta-123"
  fecha: string;       // ISO (toISOString) para ordenar
  fechaLabel: string;  // "18:03" si es hoy, "Ayer 17:56", o "04/08 17:42"
  usuarioId: number;
  empleado: string;    // nombreCompleto
  rol: string;         // nombre del rol
  tipo: string;        // "Venta" | "Reposición" | "Movimiento de Caja" | "Cambio de Estado"
  descripcion: string;
};

export type EmpleadoDashboardRow = {
  usuarioId: number;
  nombreCompleto: string;
  username: string;
  rol: string;
  activo: boolean;
  ultimaActividad: string | null;      // ISO o null
  ultimaActividadLabel: string | null; // "Hoy 18:03", "Ayer 17:56", "04/08 17:42", o null
  acciones: number;                    // total acciones en período (definición de acción)
  ventasCount: number;
  totalVendido: number;
  comprasCount: number;
  totalCompras: number;
  cajasAbiertasCount: number;
  cierresCount: number;              // cierres de caja del período (movimiento CIERRE)
  movimientosCajaCount: number;        // SOLO movimientos manuales (sin ventaId/compraId)
  cambiosEstadoProductoCount: number;
  actividadReciente: EmpleadoActividadItem[]; // últimos 5 de ESE empleado
};

export type EmpleadosDashboard = {
  resumen: {
    total: number;           // TOTALES, independientes del período (todos los usuarios registrados)
    activos: number;         // independiente del período
    administradores: number; // independiente del período
    encargadosVentas: number;
    encargadosStock: number;
    actividadPeriodo: number; // total acciones en el período seleccionado
  };
  empleados: EmpleadoDashboardRow[];
  actividadPorDia: {
    fecha: string;    // "yyyy-MM-dd" local
    label: string;    // "Martes 04/08" (día de semana es-AR + dd/MM)
    total: number;
    porEmpleado: { usuarioId: number; nombre: string; acciones: number }[];
  }[];
  actividadPorModulo: { modulo: string; acciones: number }[]; // solo módulos con acciones > 0
  actividadReciente: EmpleadoActividadItem[]; // últimos 20 de TODOS
  faltanDatos: string[]; // array FIJO con los 4 mensajes en español
};

import { EMPTY_EMPLEADOS_DASHBOARD, EMPTY_PROVEEDORES_DASHBOARD, FALTAN_DATOS_EMPLEADOS } from "@/lib/report-constants";

const DIAS_SEMANA_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "yyyy-MM-dd" local — solo para agrupar/ordenar, nunca para el límite servidor. */
const dayKeyLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** "Martes 04/08" — día de semana es-AR + dd/MM (sin toLocaleDateString). */
const dayLabelLocal = (d: Date): string =>
  `${DIAS_SEMANA_ES[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "18:03" si es hoy, "Ayer 17:56", o "04/08 17:42". Compara con fechas LOCALES
 * del servidor (suposición del proyecto: servidor UTC-3).
 */
const actividadFechaLabel = (d: Date, now: Date): string => {
  if (isSameLocalDay(d, now)) return formatTime24(d);
  const ayer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameLocalDay(d, ayer)) return `Ayer ${formatTime24(d)}`;
  return `${formatDateShort(d)} ${formatTime24(d)}`;
};

export async function getEmpleadosDashboard(fechaDesde?: string, fechaHasta?: string): Promise<EmpleadosDashboard> {
  try {
    await requirePermission("informes.empleados");

    // TODOS los usuarios (activos e inactivos) — el resumen estructural es global
    const usuarios = await prisma.usuario.findMany({
      include: { rol: { select: { nombre: true } } },
      orderBy: { nombreCompleto: "asc" },
    });
    const nombrePorId = new Map(usuarios.map((u) => [u.id, u.nombreCompleto]));
    const rolPorId = new Map(usuarios.map((u) => [u.id, u.rol.nombre]));

    const ventaDateFilter = buildDateFilter(fechaDesde, fechaHasta);
    const [ventas, compras, movimientos, historiales, cajasAbiertas] = await Promise.all([
      prisma.venta.findMany({
        where: ventaDateFilter,
        select: { id: true, fecha: true, total: true, usuarioId: true },
      }),
      prisma.compra.findMany({
        // buildDateFilter tipa VentaWhereInput; el shape { fecha: {...} } es
        // idéntico al filtro de Compra/HistorialEstado, solo difiere el tipo generado.
        where: ventaDateFilter as Prisma.CompraWhereInput,
        select: { id: true, fecha: true, total: true, usuarioId: true },
      }),
      prisma.movimientoCaja.findMany({
        where: { ...buildMovimientoCajaDateFilter(fechaDesde, fechaHasta), ventaId: null, compraId: null },
        select: { id: true, fecha: true, tipo: true, monto: true, descripcion: true, usuarioId: true },
      }),
      prisma.historialEstado.findMany({
        where: ventaDateFilter as Prisma.HistorialEstadoWhereInput,
        select: { id: true, fecha: true, usuarioId: true, productoId: true, estadoAnterior: true, estadoNuevo: true, observacion: true },
      }),
      prisma.caja.groupBy({
        by: ["usuarioId"],
        where: buildDateFilter(fechaDesde, fechaHasta, "fechaApertura"),
        _count: { id: true },
      }),
    ]);

    type Acc = {
      ventasCount: number;
      totalVendido: number;
      comprasCount: number;
      totalCompras: number;
      movimientosCajaCount: number;
      cambiosEstadoProductoCount: number;
      cajasAbiertasCount: number;
      cierresCount: number;
      acciones: number;
      ultimaFecha: Date | null;
    };
    const acc: Record<number, Acc> = {};
    const getAcc = (uid: number): Acc => {
      let a = acc[uid];
      if (!a) {
        a = {
          ventasCount: 0, totalVendido: 0, comprasCount: 0, totalCompras: 0,
          movimientosCajaCount: 0, cambiosEstadoProductoCount: 0, cajasAbiertasCount: 0,
          cierresCount: 0,
          acciones: 0, ultimaFecha: null,
        };
        acc[uid] = a;
      }
      return a;
    };
    const touch = (a: Acc, fecha: Date): void => {
      if (!a.ultimaFecha || fecha > a.ultimaFecha) a.ultimaFecha = fecha;
    };

    const now = new Date();
    const items: EmpleadoActividadItem[] = [];

    for (const v of ventas) {
      const a = getAcc(v.usuarioId);
      a.ventasCount += 1;
      a.totalVendido += v.total;
      a.acciones += 1;
      touch(a, v.fecha);
      items.push({
        id: `venta-${v.id}`,
        fecha: v.fecha.toISOString(),
        fechaLabel: actividadFechaLabel(v.fecha, now),
        usuarioId: v.usuarioId,
        empleado: nombrePorId.get(v.usuarioId) ?? "",
        rol: rolPorId.get(v.usuarioId) ?? "",
        tipo: "Venta",
        descripcion: `Venta #${v.id}`,
      });
    }

    for (const c of compras) {
      const a = getAcc(c.usuarioId);
      a.comprasCount += 1;
      a.totalCompras += c.total;
      a.acciones += 1;
      touch(a, c.fecha);
      items.push({
        id: `compra-${c.id}`,
        fecha: c.fecha.toISOString(),
        fechaLabel: actividadFechaLabel(c.fecha, now),
        usuarioId: c.usuarioId,
        empleado: nombrePorId.get(c.usuarioId) ?? "",
        rol: rolPorId.get(c.usuarioId) ?? "",
        tipo: "Reposición",
        descripcion: `Reposición #${c.id}`,
      });
    }

    for (const m of movimientos) {
      const a = getAcc(m.usuarioId);
      a.movimientosCajaCount += 1;
      if (m.tipo === "CIERRE") a.cierresCount += 1;
      a.acciones += 1;
      touch(a, m.fecha);
      const montoStr = m.monto > 0 ? ` - ${formatCurrency(m.monto)}` : "";
      const descripcion =
        m.descripcion && m.descripcion.trim().length > 0
          ? `${m.descripcion.charAt(0).toUpperCase()}${m.descripcion.slice(1)}${montoStr}`
          : `Movimiento ${m.tipo}${montoStr}`;
      items.push({
        id: `mov-${m.id}`,
        fecha: m.fecha.toISOString(),
        fechaLabel: actividadFechaLabel(m.fecha, now),
        usuarioId: m.usuarioId,
        empleado: nombrePorId.get(m.usuarioId) ?? "",
        rol: rolPorId.get(m.usuarioId) ?? "",
        tipo: "Movimiento de Caja",
        descripcion,
      });
    }

    for (const h of historiales) {
      const a = getAcc(h.usuarioId);
      // Las ediciones de datos (prefijo [EDITAR]) no son cambios de estado reales:
      // se etiquetan aparte y no inflan el contador de cambios de estado.
      const esEdicionDatos = h.observacion?.startsWith("[EDITAR]") ?? false;
      if (!esEdicionDatos) {
        a.cambiosEstadoProductoCount += 1;
      }
      a.acciones += 1;
      touch(a, h.fecha);
      items.push({
        id: `hist-${h.id}`,
        fecha: h.fecha.toISOString(),
        fechaLabel: actividadFechaLabel(h.fecha, now),
        usuarioId: h.usuarioId,
        empleado: nombrePorId.get(h.usuarioId) ?? "",
        rol: rolPorId.get(h.usuarioId) ?? "",
        tipo: esEdicionDatos ? "Edición de datos" : "Cambio de Estado",
        descripcion: esEdicionDatos
          ? `Producto #${h.productoId}: ${h.observacion}`
          : `Producto #${h.productoId}: ${h.estadoAnterior} → ${h.estadoNuevo}`,
      });
    }

    for (const caja of cajasAbiertas) {
      getAcc(caja.usuarioId).cajasAbiertasCount = caja._count.id;
    }

    // Actividad reciente por empleado (últimos 5 de cada uno)
    const porUsuario: Record<number, EmpleadoActividadItem[]> = {};
    for (const it of items) {
      const list = porUsuario[it.usuarioId];
      if (list) list.push(it);
      else porUsuario[it.usuarioId] = [it];
    }
    for (const key of Object.keys(porUsuario)) {
      const uid = Number(key);
      porUsuario[uid].sort((a, b) => b.fecha.localeCompare(a.fecha));
      porUsuario[uid] = porUsuario[uid].slice(0, 5);
    }

    // Filas del dashboard (TODOS los usuarios, activos e inactivos)
    const ZERO: Acc = {
      ventasCount: 0, totalVendido: 0, comprasCount: 0, totalCompras: 0,
      movimientosCajaCount: 0, cambiosEstadoProductoCount: 0, cajasAbiertasCount: 0,
      cierresCount: 0,
      acciones: 0, ultimaFecha: null,
    };
    const empleados: EmpleadoDashboardRow[] = usuarios.map((u) => {
      const a = acc[u.id] ?? ZERO;
      return {
        usuarioId: u.id,
        nombreCompleto: u.nombreCompleto,
        username: u.username,
        rol: u.rol.nombre,
        activo: u.activo,
        ultimaActividad: a.ultimaFecha ? a.ultimaFecha.toISOString() : null,
        ultimaActividadLabel: a.ultimaFecha ? actividadFechaLabel(a.ultimaFecha, now) : null,
        acciones: a.acciones,
        ventasCount: a.ventasCount,
        totalVendido: a.totalVendido,
        comprasCount: a.comprasCount,
        totalCompras: a.totalCompras,
        cajasAbiertasCount: a.cajasAbiertasCount,
        cierresCount: a.cierresCount,
        movimientosCajaCount: a.movimientosCajaCount,
        cambiosEstadoProductoCount: a.cambiosEstadoProductoCount,
        actividadReciente: porUsuario[u.id] ?? [],
      };
    });

    // Actividad por día (agrupación local yyyy-MM-dd, días asc)
    const porDia = new Map<string, { label: string; total: number; porEmpleado: Map<number, number> }>();
    for (const it of items) {
      const d = new Date(it.fecha);
      const key = dayKeyLocal(d);
      let entry = porDia.get(key);
      if (!entry) {
        entry = { label: dayLabelLocal(d), total: 0, porEmpleado: new Map() };
        porDia.set(key, entry);
      }
      entry.total += 1;
      entry.porEmpleado.set(it.usuarioId, (entry.porEmpleado.get(it.usuarioId) ?? 0) + 1);
    }
    const actividadPorDia = Array.from(porDia.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, entry]) => ({
        fecha,
        label: entry.label,
        total: entry.total,
        porEmpleado: Array.from(entry.porEmpleado.entries()).map(([usuarioId, acciones]) => ({
          usuarioId,
          nombre: nombrePorId.get(usuarioId) ?? "",
          acciones,
        })),
      }));

    // Actividad por módulo (solo módulos con acciones > 0)
    let totalVentas = 0;
    let totalMovManuales = 0;
    let totalCompras = 0;
    let totalCambiosEstado = 0;
    for (const key of Object.keys(acc)) {
      const a = acc[Number(key)];
      totalVentas += a.ventasCount;
      totalMovManuales += a.movimientosCajaCount;
      totalCompras += a.comprasCount;
      totalCambiosEstado += a.cambiosEstadoProductoCount;
    }
    const actividadPorModulo = [
      { modulo: "Ventas", acciones: totalVentas },
      { modulo: "Caja", acciones: totalMovManuales },
      { modulo: "Reposiciones", acciones: totalCompras },
      { modulo: "Productos", acciones: totalCambiosEstado },
    ].filter((m) => m.acciones > 0);

    // Actividad reciente global (últimos 20, más reciente primero)
    const actividadReciente = [...items]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 20);

    return {
      resumen: {
        total: usuarios.length,
        activos: usuarios.filter((u) => u.activo).length,
        administradores: usuarios.filter((u) => u.rol.nombre === "ADMINISTRADOR").length,
        encargadosVentas: usuarios.filter((u) => u.rol.nombre === "ENCARGADO_VENTAS").length,
        encargadosStock: usuarios.filter((u) => u.rol.nombre === "ENCARGADO_STOCK").length,
        actividadPeriodo: empleados.reduce((s, e) => s + e.acciones, 0),
      },
      empleados,
      actividadPorDia,
      actividadPorModulo,
      actividadReciente,
      faltanDatos: FALTAN_DATOS_EMPLEADOS,
    };
  } catch (error) {
    console.error("Error en getEmpleadosDashboard:", error);
    return EMPTY_EMPLEADOS_DASHBOARD;
  }
}

// ─── 9. OBTENER USUARIOS PARA FILTROS ──────────────────────────────

export async function getUsuariosActivos() {
  try {
    await requirePermission("informes.ver");
    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: {
        id: true,
        username: true,
        nombreCompleto: true,
        rol: { select: { permisos: true } },
      },
      orderBy: { nombreCompleto: "asc" },
    });
    return usuarios.map((u) => ({
      id: u.id,
      username: u.username,
      nombreCompleto: u.nombreCompleto,
      puedeVender: parseRoleData(u.rol?.permisos ?? null).permisos.includes("ventas.crear"),
    }));
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
// ─── DEPRECATED: MOVED TO getProveedoresDashboard (Informes → Proveedores). Se conserva para no romper importaciones externas.

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
      descripcion: m.descripcion,
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
    let lastWeekKey = "";
    let lastMonth = -1;
    let semanaEnMes = 0;

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
        const weekKey = `${inicioLocal.getFullYear()}-${String(inicioLocal.getMonth() + 1).padStart(2, "0")}-${String(inicioLocal.getDate()).padStart(2, "0")}`;
        const mesActual = inicioLocal.getMonth();
        if (weekKey !== lastWeekKey) {
          if (mesActual !== lastMonth) {
            semanaEnMes = 1;
            lastMonth = mesActual;
          } else {
            semanaEnMes++;
          }
          lastWeekKey = weekKey;
        }
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
  ultimaCompraIso: string | null;
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
  clientesCompleto: [],
};

export async function getClientesDashboard(): Promise<ClientesDashboard> {
  try {
    await requirePermission("informes.clientes");
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
          ultimaCompraIso: agg?.ultima ? agg.ultima.toISOString() : null,
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

    // 9. Nuevos por mes — every month with new clients across all years (F1: year/month local).
    // Reuses `clientes` from the Promise.all above (it already includes creadoEn).
    const porMes = new Map<string, number>();
    for (const c of clientes) {
      const key = `${c.creadoEn.getFullYear()}-${String(c.creadoEn.getMonth() + 1).padStart(2, "0")}`;
      porMes.set(key, (porMes.get(key) ?? 0) + 1);
    }
    const nuevosPorMes = Array.from(porMes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, cantidad]) => {
        const anio = Number(key.slice(0, 4));
        const mesNum = Number(key.slice(5, 7)) - 1;
        return {
          mes: key,
          label: `${MESES_ES[mesNum].slice(0, 3)} ${anio}`,
          cantidad,
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
      clientesCompleto,
    };
  } catch (error) {
    console.error("Error en getClientesDashboard:", error);
    return EMPTY_CLIENTES_DASHBOARD;
  }
}

// ─── PROVEEDORES: DASHBOARD (Informes → Proveedores) ─────────────────────────────────────────────
// NOTA: reemplaza al informe paginado anterior getProveedoresReport (marcado DEPRECATED más abajo).

export type ProveedorFiltroEstado = "todos" | "activos" | "inactivos";

export interface ProveedoresDashboardFilters {
  estado: ProveedorFiltroEstado;
  categoriaId: string; // "TODAS" = sin filtro de categoría
  marcaId: string; // "TODAS" = sin filtro de marca
  search?: string; // búsqueda por nombre de proveedor (server-side)
}

export interface ProveedorReposicionRow {
  proveedorId: number;
  proveedor: string;
  categoria: string;
  marca: string;
  codigo: string;
  producto: string;
  stockActual: number;
  stockMinimo: number;
  deficit: number; // déficit real = max(0, stockMinimo - cantidad); sin heurísticas de reposición
  estado: "Sin stock" | "Stock bajo";
}

export interface ProveedorProductoRow {
  nombre: string;
  codigo: string;
  categoria: string;
  marca: string;
  cantidad: number;
  stockMinimo: number;
}

export interface ProveedorTablaRow {
  proveedorId: number;
  nombre: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  contactoResponsable: string;
  activo: boolean;
  totalProductos: number;
  totalCompras: number;
  totalGastado: number;
  ultimaCompra: string | null; // ISO con hora, o null si nunca compró
  acciones: string[];
  productos: ProveedorProductoRow[]; // productos del proveedor (con filtros de producto activos)
}

export interface ProveedoresDashboard {
  resumen: {
    totalProveedores: number;
    activos: number;
    inactivos: number;
    productosConProveedor: number;
    proveedoresSinCompras: number;
    proveedorPrincipal: { nombre: string; productos: number } | null;
  };
  productosPorProveedor: { proveedorId: number; nombre: string; cantidad: number }[];
  participacion: { proveedorId: number; nombre: string; totalProductos: number; porcentaje: number }[];
  valorCostoPorProveedor: { proveedorId: number; nombre: string; valor: number }[];
  reposicionResumen: { proveedorId: number; proveedor: string; aReponer: number; sinStock: number; stockBajo: number }[];
  reposicionDetalle: ProveedorReposicionRow[];
  proveedores: ProveedorTablaRow[];
  filtros: { categorias: { id: number; nombre: string }[]; marcas: { id: number; nombre: string }[] }; // opciones para los filtros
}

export async function getProveedoresDashboard(
  filters: ProveedoresDashboardFilters = { estado: "todos", categoriaId: "TODAS", marcaId: "TODAS" }
): Promise<ProveedoresDashboard> {
  try {
    await requirePermission("informes.proveedores");

    // ── Filtros comunes de producto (categoría/marca) ──
    const whereProductos = {
      ...(filters.categoriaId !== "TODAS" ? { categoriaId: Number(filters.categoriaId) } : {}),
      ...(filters.marcaId !== "TODAS" ? { marcaId: Number(filters.marcaId) } : {}),
    };

    // ── Obtener proveedores (con búsqueda por nombre) + conteo + compras ──
    const [proveedores, productosConteo, compras] = await Promise.all([
      prisma.proveedor.findMany({
        where: filters.search ? { nombre: { contains: filters.search, mode: "insensitive" } } : {},
        orderBy: { nombre: "asc" },
      }),
      prisma.producto.groupBy({
        by: ["proveedorId"],
        where: whereProductos,
        _count: { id: true },
      }),
      prisma.compra.findMany({
        select: { id: true, proveedorId: true, total: true, fecha: true },
        orderBy: { fecha: "desc" },
      }),
    ]);

    // ── KPIs ──
    const activos = proveedores.filter((p) => p.activo).length;
    const inactivos = proveedores.length - activos;
    const productosConProveedor = productosConteo.reduce((acc, g) => acc + g._count.id, 0);
    const proveedoresConCompra = new Set<number>();
    for (const c of compras) {
      proveedoresConCompra.add(c.proveedorId);
    }
    const proveedoresSinCompras = proveedores.filter((p) => !proveedoresConCompra.has(p.id)).length;

    // Gasto total por proveedor (columna de la tabla general — NO el gráfico de valor a costo)
    const gastoPorProveedor = new Map<number, number>();
    for (const c of compras) {
      gastoPorProveedor.set(c.proveedorId, (gastoPorProveedor.get(c.proveedorId) ?? 0) + Number(c.total));
    }

    // ── Productos por proveedor (e2: tras el filtro de producto se excluyen proveedores con 0) ──
    const conteoPorProveedor = new Map<number, number>();
    for (const g of productosConteo) {
      conteoPorProveedor.set(g.proveedorId, g._count.id);
    }
    const productosPorProveedor = proveedores
      .map((p) => ({ proveedorId: p.id, nombre: p.nombre, cantidad: conteoPorProveedor.get(p.id) ?? 0 }))
      .filter((r) => r.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);

    const totalProductos = productosPorProveedor.reduce((acc, r) => acc + r.cantidad, 0) || 1;
    const participacion = productosPorProveedor
      .map((r) => ({
        proveedorId: r.proveedorId,
        nombre: r.nombre,
        totalProductos: r.cantidad,
        porcentaje: Math.round((r.cantidad / totalProductos) * 100),
      }))
      .sort((a, b) => b.totalProductos - a.totalProductos);

    // ── Productos (para reposición, valor a costo y detalle por proveedor) ──
    const productos = await prisma.producto.findMany({
      where: whereProductos,
      select: {
        id: true,
        nombre: true,
        codigo: true,
        cantidad: true,
        stockMinimo: true,
        proveedorId: true,
        precioCompra: true,
        marca: true,
        categoria: { select: { nombre: true } },
        marcaRelacionada: { select: { nombre: true } },
      },
      orderBy: [{ proveedor: { nombre: "asc" } }, { nombre: "asc" }],
    });
    const proveedorNombre = new Map(proveedores.map((p) => [p.id, p.nombre]));
    const proveedoresVisibles = new Set(proveedores.map((p) => p.id));

    // Proveedor principal: el que suministra la mayor cantidad de productos; empate → primero alfabético
    let proveedorPrincipal: { nombre: string; productos: number } | null = null;
    let maxProductos = 0;
    for (const p of proveedores) {
      const cantidad = conteoPorProveedor.get(p.id) ?? 0;
      if (cantidad > maxProductos) {
        maxProductos = cantidad;
        proveedorPrincipal = { nombre: p.nombre, productos: cantidad };
      }
    }

    // ── Valor de inventario a costo: Σ(precioCompra × cantidad) por proveedor ──
    const valorCostoPorProveedor = proveedores
      .map((p) => ({
        proveedorId: p.id,
        nombre: p.nombre,
        valor: Math.round(
          productos
            .filter((prod) => prod.proveedorId === p.id)
            .reduce((acc, prod) => acc + prod.precioCompra * prod.cantidad, 0)
        ),
      }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    // ── Reposición por proveedor (usa `productos` de arriba) ──
    const productosPorProveedorId = new Map<number, ProveedorProductoRow[]>();
    const reposicionDetalle: ProveedorReposicionRow[] = [];
    for (const prod of productos) {
      if (!proveedoresVisibles.has(prod.proveedorId)) continue;

      // Detalle de productos del proveedor (sección expandida de la tabla)
      const detalleArr = productosPorProveedorId.get(prod.proveedorId) ?? [];
      detalleArr.push({
        nombre: prod.nombre,
        codigo: prod.codigo ?? "—",
        categoria: prod.categoria?.nombre ?? "—",
        marca: prod.marcaRelacionada?.nombre ?? prod.marca ?? "—",
        cantidad: prod.cantidad,
        stockMinimo: prod.stockMinimo ?? 0,
      });
      productosPorProveedorId.set(prod.proveedorId, detalleArr);

      // Reposición: sin stock (cantidad 0) o stock bajo (0 < cantidad <= mínimo)
      const sinStock = prod.cantidad === 0;
      const stockBajo = prod.cantidad > 0 && prod.cantidad <= (prod.stockMinimo ?? 0);
      if (!sinStock && !stockBajo) continue;
      reposicionDetalle.push({
        proveedorId: prod.proveedorId,
        proveedor: proveedorNombre.get(prod.proveedorId) ?? "—",
        categoria: prod.categoria?.nombre ?? "—",
        marca: prod.marcaRelacionada?.nombre ?? prod.marca ?? "—",
        codigo: prod.codigo ?? "—",
        producto: prod.nombre,
        stockActual: prod.cantidad,
        stockMinimo: prod.stockMinimo ?? 0,
        deficit: Math.max(0, (prod.stockMinimo ?? 0) - prod.cantidad),
        estado: sinStock ? "Sin stock" : "Stock bajo",
      });
    }
    const reposicionPorProveedor = new Map<number, { proveedorId: number; proveedor: string; aReponer: number; sinStock: number; stockBajo: number }>();
    for (const row of reposicionDetalle) {
      const actual =
        reposicionPorProveedor.get(row.proveedorId) ??
        { proveedorId: row.proveedorId, proveedor: row.proveedor, aReponer: 0, sinStock: 0, stockBajo: 0 };
      actual.aReponer += 1;
      if (row.estado === "Sin stock") actual.sinStock += 1;
      else actual.stockBajo += 1;
      reposicionPorProveedor.set(row.proveedorId, actual);
    }
    const reposicionResumen = Array.from(reposicionPorProveedor.values()).sort(
      (a, b) => b.aReponer - a.aReponer
    );

    // ── Tabla de proveedores ──
    const comprasPorProveedor = new Map<number, { total: number; ultima: Date | null; cantidad: number }>();
    for (const c of compras) {
      const actual = comprasPorProveedor.get(c.proveedorId) ?? { total: 0, ultima: null, cantidad: 0 };
      actual.total += Number(c.total);
      actual.cantidad += 1;
      if (!actual.ultima || c.fecha > actual.ultima) actual.ultima = c.fecha;
      comprasPorProveedor.set(c.proveedorId, actual);
    }

    let proveedoresTabla: ProveedorTablaRow[] = proveedores.map((p) => {
      const comprasP = comprasPorProveedor.get(p.id);
      const acciones: string[] = [];
      if (!comprasP) acciones.push("Proveedor sin compras registradas");
      const pendiente = reposicionPorProveedor.get(p.id);
      if (pendiente) acciones.push(`${pendiente.aReponer} producto(s) requieren reposición`);
      if (!p.activo) acciones.push("Proveedor inactivo");
      return {
        proveedorId: p.id,
        nombre: p.nombre,
        cuit: p.cuit ?? "—",
        telefono: p.telefono ?? "—",
        email: p.email ?? "—",
        direccion: p.direccion ?? "—",
        contactoResponsable: p.contactoResponsable ?? "—",
        activo: p.activo,
        totalProductos: conteoPorProveedor.get(p.id) ?? 0,
        totalCompras: comprasP?.cantidad ?? 0,
        totalGastado: Math.round(comprasP?.total ?? 0),
        ultimaCompra: comprasP?.ultima ? comprasP.ultima.toISOString() : null,
        acciones,
        productos: productosPorProveedorId.get(p.id) ?? [],
      };
    });

    // ── Filtros del lado servidor ──
    if (filters.estado === "activos") proveedoresTabla = proveedoresTabla.filter((r) => r.activo);
    if (filters.estado === "inactivos") proveedoresTabla = proveedoresTabla.filter((r) => !r.activo);

    // Opciones disponibles para los filtros (categorías y marcas de productos con proveedor)
    const categorias = await prisma.categoria.findMany({
      where: { productos: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    const marcas = await prisma.marca.findMany({
      where: { productos: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });

    return {
      resumen: {
        totalProveedores: proveedores.length,
        activos,
        inactivos,
        productosConProveedor,
        proveedoresSinCompras,
        proveedorPrincipal,
      },
      productosPorProveedor,
      participacion,
      valorCostoPorProveedor,
      reposicionResumen,
      reposicionDetalle,
      proveedores: proveedoresTabla,
      filtros: {
        categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
        marcas: marcas.map((m) => ({ id: m.id, nombre: m.nombre })),
      },
    };
  } catch (error) {
    console.error("Error en getProveedoresDashboard:", error);
    return EMPTY_PROVEEDORES_DASHBOARD;
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
