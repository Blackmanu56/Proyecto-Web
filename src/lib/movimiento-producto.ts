import type { Prisma } from "@prisma/client";

export type TipoMovimientoProducto =
  | "COMPRA"
  | "VENTA"
  | "RESTA_MANUAL"
  | "EDICION"
  | "REPOSICION_DIRECTA"
  | "REPOSICION_APROBADA"
  | "SOLICITUD_RESTA_APROBADA";

export interface RegistrarMovimientoParams {
  productoId: number;
  tipo: TipoMovimientoProducto;
  cantidadAnterior: number;
  cantidadNueva: number;
  compraId?: number;
  ventaId?: number;
  motivo: string;
  observacion?: string;
  cambios?: Array<{ campo: string; anterior: unknown; nuevo: unknown }>;
  usuarioId: number;
}

/**
 * Registra un movimiento de stock en MovimientoProducto.
 * Debe llamarse DENTRO de una transacción Prisma existente.
 * No contiene lógica de negocio — solo persiste el registro de auditoría.
 *
 * `tx` accepts any object with `movimientoProducto.create` (the real Prisma
 * transaction client or a mock with matching shape).
 */
export async function registrarMovimiento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: { movimientoProducto: { create: (...args: any[]) => any } },
  params: RegistrarMovimientoParams
): Promise<void> {
  await tx.movimientoProducto.create({
    data: {
      productoId: params.productoId,
      usuarioId: params.usuarioId,
      tipo: params.tipo,
      cantidadAnterior: params.cantidadAnterior,
      cantidadNueva: params.cantidadNueva,
      compraId: params.compraId ?? null,
      ventaId: params.ventaId ?? null,
      motivo: params.motivo,
      observacion: params.observacion ?? null,
      cambios: (params.cambios as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
