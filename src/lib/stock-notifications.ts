import { prisma } from "@/lib/prisma";
import type { TipoNotificacion } from "@prisma/client";

/**
 * Obtiene los destinatarios (IDs de usuarios activos) para alertas de stock
 * (ADMINISTRADOR y ENCARGADO_STOCK).
 */
async function getDestinatariosStockAlerta(): Promise<number[]> {
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

  return Array.from(destinatarios.keys());
}

/**
 * Obtiene una función para verificar si un usuario tiene habilitado un tipo de notificación.
 */
async function getFiltroPreferencias(userIds: number[]) {
  const preferencias = await prisma.preferenciaNotificacion.findMany({
    where: { usuarioId: { in: userIds } },
    select: { usuarioId: true, tipo: true, habilitada: true },
  });

  const deshabilitadas = new Map<number, Set<string>>();
  for (const pref of preferencias) {
    if (!pref.habilitada) {
      const set = deshabilitadas.get(pref.usuarioId) ?? new Set();
      set.add(pref.tipo);
      deshabilitadas.set(pref.usuarioId, set);
    }
  }

  return (userId: number, tipo: string): boolean => {
    return !deshabilitadas.get(userId)?.has(tipo);
  };
}

/**
 * Obtiene el conteo actual de productos activos en estado crítico y sin stock.
 */
async function getConteosStockAlerta() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    select: { id: true, cantidad: true, stockMinimo: true },
  });

  const criticosCount = productos.filter(
    (p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo
  ).length;

  const agotadosCount = productos.filter((p) => p.cantidad === 0).length;

  return { criticosCount, agotadosCount };
}

/**
 * Sincroniza o actualiza la notificación agrupada para un tipo de alerta de stock
 * (STOCK_CRITICO o STOCK_AGOTADO) para los destinatarios especificados.
 */
async function sincronizarNotificacionAgrupada({
  tipo,
  count,
  destinatarios,
  usuarioQuiere,
  forceCreateIfNotExists = false,
}: {
  tipo: "STOCK_CRITICO" | "STOCK_AGOTADO";
  count: number;
  destinatarios: number[];
  usuarioQuiere: (userId: number, tipo: string) => boolean;
  forceCreateIfNotExists?: boolean;
}) {
  const titulo = tipo === "STOCK_CRITICO" ? "⚠ Stock crítico" : "🔴 Stock agotado";
  const mensaje =
    tipo === "STOCK_CRITICO"
      ? `Se detectaron ${count} productos con stock crítico`
      : `Se detectaron ${count} productos sin stock`;

  for (const userId of destinatarios) {
    if (!usuarioQuiere(userId, tipo)) continue;

    if (count === 0) {
      // Si llega a 0, la notificación se marca como resuelta / desaparece
      await prisma.notificacion.deleteMany({
        where: {
          usuarioId: userId,
          tipo,
          leida: false,
        },
      });
    } else {
      // count > 0: buscar si existe una notificación activa (no leída) de este tipo
      const existingUnread = await prisma.notificacion.findFirst({
        where: {
          usuarioId: userId,
          tipo,
          leida: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingUnread) {
        // Actualizar la notificación existente con el nuevo contador
        await prisma.notificacion.update({
          where: { id: existingUnread.id },
          data: {
            titulo,
            mensaje,
            entidad: "stock",
            productoId: null,
          },
        });
        // Limpiar posibles duplicados antiguos no leídos
        await prisma.notificacion.deleteMany({
          where: {
            usuarioId: userId,
            tipo,
            leida: false,
            id: { not: existingUnread.id },
          },
        });
      } else if (forceCreateIfNotExists) {
        // Se crea nueva notificación agrupada si no existe una activa
        await prisma.notificacion.create({
          data: {
            usuarioId: userId,
            tipo: tipo as TipoNotificacion,
            titulo,
            mensaje,
            entidad: "stock",
            productoId: null,
            leida: false,
          },
        });
      } else {
        // En verificación pasiva, crear solo si no hay ninguna reciente en 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await prisma.notificacion.findFirst({
          where: {
            usuarioId: userId,
            tipo,
            createdAt: { gte: oneDayAgo },
          },
        });
        if (!recent) {
          await prisma.notificacion.create({
            data: {
              usuarioId: userId,
              tipo: tipo as TipoNotificacion,
              titulo,
              mensaje,
              entidad: "stock",
              productoId: null,
              leida: false,
            },
          });
        }
      }
    }
  }
}

/**
 * Evalúa el estado del stock después de un movimiento y actualiza las notificaciones
 * agrupadas correspondientes (CRÍTICO, AGOTADO), además de generar las notificaciones
 * individuales de movimiento para el usuario (RESTADO, RECARGADO).
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
  try {
    const { productoId, cantidadAnterior, cantidadNueva, usuarioId, usuarioNombre, motivo } = params;

    // Skip if stock didn't actually change
    if (cantidadAnterior === cantidadNueva) {
      return;
    }

    if (!prisma?.producto?.findUnique) {
      return;
    }

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto || !producto.activo) {
      return;
    }

    const stockMinimo = producto.stockMinimo;
    const esBaja = cantidadNueva < cantidadAnterior;
    const esAlta = cantidadNueva > cantidadAnterior;

    const destinatarios = await getDestinatariosStockAlerta();
    const allUserIds = Array.from(new Set([...destinatarios, usuarioId]));
    const usuarioQuiere = await getFiltroPreferencias(allUserIds);

    // ── 1. Notificaciones individuales de movimiento (RESTADO / RECARGADO) ──
    const destinatariosSet = new Set(destinatarios);
    if (esBaja && !destinatariosSet.has(usuarioId) && usuarioQuiere(usuarioId, "STOCK_RESTADO")) {
      await prisma.notificacion.create({
        data: {
          usuarioId,
          tipo: "STOCK_RESTADO",
          titulo: "Stock reducido",
          mensaje: `${usuarioNombre} restó ${cantidadAnterior - cantidadNueva} unidades de '${producto.nombre}'. Stock: ${cantidadAnterior} → ${cantidadNueva}. Motivo: ${motivo}`,
          entidad: "stock",
          productoId,
        },
      });
    } else if (esAlta && !destinatariosSet.has(usuarioId) && usuarioQuiere(usuarioId, "STOCK_RECARGADO")) {
      await prisma.notificacion.create({
        data: {
          usuarioId,
          tipo: "STOCK_RECARGADO",
          titulo: "Stock recargado",
          mensaje: `${usuarioNombre} agregó ${cantidadNueva - cantidadAnterior} unidades de '${producto.nombre}'. Stock: ${cantidadAnterior} → ${cantidadNueva}.`,
          entidad: "stock",
          productoId,
        },
      });
    }

    // ── 2. Notificaciones agrupadas (STOCK_CRITICO y STOCK_AGOTADO) ──
    const { criticosCount, agotadosCount } = await getConteosStockAlerta();

    const entroCritico = cantidadAnterior > stockMinimo && cantidadNueva <= stockMinimo && cantidadNueva > 0;
    const entroAgotado = cantidadAnterior > 0 && cantidadNueva === 0;

    // Sincronizar Stock Crítico
    await sincronizarNotificacionAgrupada({
      tipo: "STOCK_CRITICO",
      count: criticosCount,
      destinatarios,
      usuarioQuiere,
      forceCreateIfNotExists: entroCritico,
    });

    // Sincronizar Stock Agotado (Sin Stock)
    await sincronizarNotificacionAgrupada({
      tipo: "STOCK_AGOTADO",
      count: agotadosCount,
      destinatarios,
      usuarioQuiere,
      forceCreateIfNotExists: entroAgotado,
    });
  } catch (err) {
    console.error("[stock-notifications] Error in evaluarYNotificarStock:", err);
  }
}

/**
 * Verifica el estado ACTUAL de stock de TODOS los productos activos
 * y asegura que las notificaciones agrupadas de STOCK_CRITICO y STOCK_AGOTADO
 * reflejen fielmente el total de productos afectados.
 *
 * Se llama al abrir la campanita de notificaciones o cargar /notificaciones.
 */
export async function verificarStockActual() {
  try {
    const destinatarios = await getDestinatariosStockAlerta();
    if (destinatarios.length === 0) return;

    const usuarioQuiere = await getFiltroPreferencias(destinatarios);
    const { criticosCount, agotadosCount } = await getConteosStockAlerta();

    await sincronizarNotificacionAgrupada({
      tipo: "STOCK_CRITICO",
      count: criticosCount,
      destinatarios,
      usuarioQuiere,
      forceCreateIfNotExists: false,
    });

    await sincronizarNotificacionAgrupada({
      tipo: "STOCK_AGOTADO",
      count: agotadosCount,
      destinatarios,
      usuarioQuiere,
      forceCreateIfNotExists: false,
    });
  } catch (err) {
    console.error("[stock-notifications] verificarStockActual error:", err);
  }
}
