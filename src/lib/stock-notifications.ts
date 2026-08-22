import { prisma } from "@/lib/prisma";
import type { TipoNotificacion } from "@prisma/client";

/**
 * Evalúa el estado del stock después de un movimiento y crea notificaciones
 * correspondientes (CRÍTICO, AGOTADO, RESTADO, RECARGADO).
 *
 * Debe llamarse DESPUÉS del commit de la transacción que modificó el stock,
 * ya que usa prisma (no tx) para leer el estado final consistente.
 */
export async function evaluarYNotificarStock(params: {
  productoId: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  usuarioId: number;
  usuarioNombre: string;
  tipoMovimiento: string;
  motivo: string;
}) {
  const { productoId, cantidadAnterior, cantidadNueva, usuarioId, usuarioNombre, tipoMovimiento, motivo } = params;

  console.log(`[stock-notifications] Called: productoId=${productoId}, anterior=${cantidadAnterior}, nueva=${cantidadNueva}, user=${usuarioNombre}, tipo=${tipoMovimiento}`);

  // Skip if stock didn't actually change
  if (cantidadAnterior === cantidadNueva) {
    console.log("[stock-notifications] Skip: stock unchanged");
    return;
  }

  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto || !producto.activo) {
    console.log(`[stock-notifications] Skip: product not found or inactive. producto=${!!producto}, activo=${producto?.activo}`);
    return;
  }

  const stockMinimo = producto.stockMinimo;
  console.log(`[stock-notifications] Product: ${producto.nombre}, stockMinimo=${stockMinimo}, activo=${producto.activo}`);
  const esBaja = cantidadNueva < cantidadAnterior;
  const esAlta = cantidadNueva > cantidadAnterior;

  // ── Determine which notification types to create ──
  const tiposNotificar: Array<{ tipo: string; titulo: string; mensaje: string }> = [];

  if (esBaja) {
    // STOCK_RESTADO — always on decrease
    tiposNotificar.push({
      tipo: "STOCK_RESTADO",
      titulo: "Stock reducido",
      mensaje: `${usuarioNombre} restó ${cantidadAnterior - cantidadNueva} unidades de '${producto.nombre}'. Stock: ${cantidadAnterior} → ${cantidadNueva}. Motivo: ${motivo}`,
    });

    // STOCK_CRITICO — crossed threshold (was OK, now <= min)
    if (cantidadAnterior > stockMinimo && cantidadNueva <= stockMinimo && cantidadNueva > 0) {
      tiposNotificar.push({
        tipo: "STOCK_CRITICO",
        titulo: "⚠ Stock crítico",
        mensaje: `'${producto.nombre}' quedó con ${cantidadNueva} unidades (mínimo: ${stockMinimo}).`,
      });
    }

    // STOCK_AGOTADO — hit zero
    if (cantidadAnterior > 0 && cantidadNueva === 0) {
      tiposNotificar.push({
        tipo: "STOCK_AGOTADO",
        titulo: "🔴 Stock agotado",
        mensaje: `'${producto.nombre}' se quedó sin stock. Se requiere reposición urgente.`,
      });
    }
  } else if (esAlta) {
    // STOCK_RECARGADO — always on increase
    tiposNotificar.push({
      tipo: "STOCK_RECARGADO",
      titulo: "Stock recargado",
      mensaje: `${usuarioNombre} agregó ${cantidadNueva - cantidadAnterior} unidades de '${producto.nombre}'. Stock: ${cantidadAnterior} → ${cantidadNueva}.`,
    });
  }

  if (tiposNotificar.length === 0) {
    console.log("[stock-notifications] Skip: no notification types to create");
    return;
  }

  console.log(`[stock-notifications] Types to notify: ${tiposNotificar.map((t) => t.tipo).join(", ")}`);

  // ── Fetch recipients ──
  // Admins + Encargados de Stock receive critical/empty alerts
  // The user who caused the movement gets RESTADO/RECARGADO
  let admins: { id: number }[] = [];
  let encargadosStock: { id: number }[] = [];
  let preferencias: { usuarioId: number; tipo: string; habilitada: boolean }[] = [];
  const destinatariosCriticos = new Map<number, true>();

  try {
    // Fetch roles first to avoid relation filter issues with PrismaPg adapter
    const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
    const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");
    const rolEncargadoStock = roles.find((r) => r.nombre === "ENCARGADO_STOCK");

    if (rolAdmin) {
      admins = await prisma.usuario.findMany({
        where: { rolId: rolAdmin.id, activo: true },
        select: { id: true },
      });
    }

    if (rolEncargadoStock) {
      encargadosStock = await prisma.usuario.findMany({
        where: { rolId: rolEncargadoStock.id, activo: true },
        select: { id: true },
      });
    }

    // Merge unique recipients for critical alerts
    for (const u of admins) destinatariosCriticos.set(u.id, true);
    for (const u of encargadosStock) destinatariosCriticos.set(u.id, true);

    console.log(`[stock-notifications] Recipients: ${admins.length} admins, ${encargadosStock.length} encargados stock. IDs: [${[...destinatariosCriticos.keys()].join(", ")}]`);

    // Fetch preferences for all potential recipients
    const allUserIds = [...destinatariosCriticos.keys(), usuarioId];
    preferencias = await prisma.preferenciaNotificacion.findMany({
      where: { usuarioId: { in: allUserIds } },
      select: { usuarioId: true, tipo: true, habilitada: true },
    });
  } catch (err) {
    console.error("[stock-notifications] Error fetching recipients/preferences:", err);
    return;
  }

  // Build a lookup: userId -> Set of disabled types
  const deshabilitadasPorUsuario = new Map<number, Set<string>>();
  for (const pref of preferencias) {
    if (!pref.habilitada) {
      const set = deshabilitadasPorUsuario.get(pref.usuarioId) ?? new Set();
      set.add(pref.tipo);
      deshabilitadasPorUsuario.set(pref.usuarioId, set);
    }
  }

  // Helper: check if user wants this notification type
  const usuarioQuiere = (userId: number, tipo: string): boolean => {
    const deshabilitadas = deshabilitadasPorUsuario.get(userId);
    return !deshabilitadas?.has(tipo);
  };

  // Build notification records
  const notificaciones: Array<{
    usuarioId: number;
    tipo: TipoNotificacion;
    titulo: string;
    mensaje: string;
    entidad: string;
    productoId: number;
  }> = [];

  for (const { tipo, titulo, mensaje } of tiposNotificar) {
    const esAlertaCritica = tipo === "STOCK_CRITICO" || tipo === "STOCK_AGOTADO";

    if (esAlertaCritica) {
      // Send to ALL admins + encargados de stock (respetando preferencias)
      for (const userId of destinatariosCriticos.keys()) {
        if (!usuarioQuiere(userId, tipo)) continue;
        notificaciones.push({
          usuarioId: userId,
          tipo: tipo as TipoNotificacion,
          titulo,
          mensaje,
          entidad: "stock",
          productoId,
        });
      }
    } else {
      // RESTADO / RECARGADO → send to the user who did it (respetando preferencias)
      if (!destinatariosCriticos.has(usuarioId) && usuarioQuiere(usuarioId, tipo)) {
        notificaciones.push({
          usuarioId,
          tipo: tipo as TipoNotificacion,
          titulo,
          mensaje,
          entidad: "stock",
          productoId,
        });
      }
    }
  }

  if (notificaciones.length > 0) {
    console.log(`[stock-notifications] Creating ${notificaciones.length} notifications:`, notificaciones.map((n) => `${n.tipo}->${n.usuarioId}`).join(", "));
    try {
      await prisma.notificacion.createMany({ data: notificaciones });
      console.log("[stock-notifications] Notifications created successfully");
    } catch (err) {
      console.error("[stock-notifications] Error creating notifications:", err);
      console.error("[stock-notifications] Data:", JSON.stringify(notificaciones, null, 2));
    }
  } else {
    console.log("[stock-notifications] No notifications to create (all filtered by preferences or no critical recipients)");
  }
}

/**
 * Verifica el estado ACTUAL de stock de TODOS los productos activos
 * y crea notificaciones de STOCK_CRITICO / STOCK_AGOTADO para los que
 * estén en estado de alerta, SOLO si no existe ya una notificación
 * reciente (últimas 24h) para ese producto + tipo + usuario.
 *
 * Se llama al abrir la campanita de notificaciones para garantizar
 * que las alertas aparezcan incluso si el stock ya estaba bajo
 * antes de que existiera la función.
 */
export async function verificarStockActual() {
  try {
    console.log("[stock-notifications] verificarStockActual: checking all products...");

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, cantidad: true, stockMinimo: true },
    });

    console.log(`[stock-notifications] verificarStockActual: ${productos.length} active products`);

    // Find products that need alerts
    const criticos = productos.filter((p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo);
    const agotados = productos.filter((p) => p.cantidad === 0);

    if (criticos.length === 0 && agotados.length === 0) {
      console.log("[stock-notifications] verificarStockActual: no products in alert state");
      return;
    }

    console.log(`[stock-notifications] verificarStockActual: ${criticos.length} critical, ${agotados.length} empty`);

    // Fetch recipients
    const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
    const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");
    const rolEncargadoStock = roles.find((r) => r.nombre === "ENCARGADO_STOCK");

    const destinatarios = new Map<number, true>();
    if (rolAdmin) {
      const admins = await prisma.usuario.findMany({
        where: { rolId: rolAdmin.id, activo: true },
        select: { id: true },
      });
      for (const u of admins) destinatarios.set(u.id, true);
    }
    if (rolEncargadoStock) {
      const encargados = await prisma.usuario.findMany({
        where: { rolId: rolEncargadoStock.id, activo: true },
        select: { id: true },
      });
      for (const u of encargados) destinatarios.set(u.id, true);
    }

    if (destinatarios.size === 0) {
      console.log("[stock-notifications] verificarStockActual: no recipients found");
      return;
    }

    const userIds = [...destinatarios.keys()];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check existing recent notifications to avoid duplicates
    const existingNotis = await prisma.notificacion.findMany({
      where: {
        usuarioId: { in: userIds },
        tipo: { in: ["STOCK_CRITICO", "STOCK_AGOTADO"] },
        createdAt: { gte: oneDayAgo },
      },
      select: { usuarioId: true, tipo: true, productoId: true },
    });

    // Build set of existing "user+tipo+productoId" combos
    const existingSet = new Set(
      existingNotis.map((n) => `${n.usuarioId}|${n.tipo}|${n.productoId}`)
    );

    const notificaciones: Array<{
      usuarioId: number;
      tipo: "STOCK_CRITICO" | "STOCK_AGOTADO";
      titulo: string;
      mensaje: string;
      entidad: string;
      productoId: number;
    }> = [];

    for (const p of criticos) {
      for (const userId of userIds) {
        const key = `${userId}|STOCK_CRITICO|${p.id}`;
        if (!existingSet.has(key)) {
          notificaciones.push({
            usuarioId: userId,
            tipo: "STOCK_CRITICO",
            titulo: "⚠ Stock crítico",
            mensaje: `'${p.nombre}' tiene ${p.cantidad} unidades disponibles y alcanzó el mínimo configurado (${p.stockMinimo}).`,
            entidad: "stock",
            productoId: p.id,
          });
        }
      }
    }

    for (const p of agotados) {
      for (const userId of userIds) {
        const key = `${userId}|STOCK_AGOTADO|${p.id}`;
        if (!existingSet.has(key)) {
          notificaciones.push({
            usuarioId: userId,
            tipo: "STOCK_AGOTADO",
            titulo: "🔴 Stock agotado",
            mensaje: `'${p.nombre}' se quedó sin stock. Se requiere reposición urgente.`,
            entidad: "stock",
            productoId: p.id,
          });
        }
      }
    }

    if (notificaciones.length > 0) {
      console.log(`[stock-notifications] verificarStockActual: creating ${notificaciones.length} notifications`);
      await prisma.notificacion.createMany({ data: notificaciones });
      console.log("[stock-notifications] verificarStockActual: done");
    } else {
      console.log("[stock-notifications] verificarStockActual: all alerts already exist (no duplicates)");
    }
  } catch (err) {
    console.error("[stock-notifications] verificarStockActual error:", err);
  }
}
