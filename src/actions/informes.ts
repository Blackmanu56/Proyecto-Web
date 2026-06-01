"use server";

import { prisma } from "@/lib/prisma";

export interface DashboardData {
  stats: {
    ventasHoy: number;
    ingresosCaja: number;
    stockBajoCount: number;
    totalClientes: number;
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
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

    // 1. Estadísticas básicas
    // Ventas de hoy
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

    // Saldo en caja activa
    const cajaActiva = await prisma.caja.findFirst({
      where: { estado: "ABIERTA" },
    });
    const ingresosCajaVal = cajaActiva ? cajaActiva.montoInicial + cajaActiva.totalVentas : 0;

    // Conteo stock bajo
    const stockBajoDb = await prisma.producto.count({
      where: {
        activo: true,
        cantidad: {
          lte: prisma.producto.fields.stockMinimo,
        },
      },
    });

    // Total clientes
    const clientesCount = await prisma.cliente.count();

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
      const strFecha = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
      ventasPorFechaMap[strFecha] = 0;
    }

    ventasRecientes.forEach((v) => {
      const strFecha = v.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
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
        producto: true,
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
      const catNombre = d.producto.nombre.split(" ").slice(-1)[0] || "Otros"; // fallback si no carga relación
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
      fecha: m.fecha.toLocaleDateString("es-AR") + " " + m.fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
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
      stats: { ventasHoy: 0, ingresosCaja: 0, stockBajoCount: 0, totalClientes: 0 },
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
    const where: any = {};

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
        fecha:
          v.fecha.toLocaleDateString("es-AR") +
          " " +
          v.fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
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
      fecha:
        venta.fecha.toLocaleDateString("es-AR") +
        " " +
        venta.fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
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
    const where: any = {};

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
      fechaApertura:
        c.fechaApertura.toLocaleDateString("es-AR") +
        " " +
        c.fechaApertura.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      fechaCierre: c.fechaCierre
        ? c.fechaCierre.toLocaleDateString("es-AR") +
          " " +
          c.fechaCierre.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
        : null,
      usuario: c.usuario.username,
      montoInicial: c.montoInicial,
      totalVentas: c.totalVentas,
      estado: c.estado,
      totalEsperado: c.montoInicial + c.totalVentas,
    }));
  } catch (error) {
    console.error("Error en getReporteCierres:", error);
    return [];
  }
}

// ─── 4. DETALLE DE CIERRE DE CAJA ──────────────────────────────────

export async function getDetalleCierre(cajaId: number): Promise<DetalleCierreCompleto | null> {
  try {
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
      fechaApertura:
        caja.fechaApertura.toLocaleDateString("es-AR") +
        " " +
        caja.fechaApertura.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      fechaCierre: caja.fechaCierre
        ? caja.fechaCierre.toLocaleDateString("es-AR") +
          " " +
          caja.fechaCierre.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
        : null,
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
        descripcion: m.descripcion,
        fecha:
          m.fecha.toLocaleDateString("es-AR") +
          " " +
          m.fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
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
    const where: any = {};
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
    const whereVentas: any = {};
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

    const whereCierres: any = {};
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
