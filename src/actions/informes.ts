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
