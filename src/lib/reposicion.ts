/**
 * Helper de reposición de stock — extraído de `updateProducto` (design D2).
 *
 * MOVER, no reescribir: la semántica de validación (distribución, caja, banco)
 * y de escritura (Compra, PagoCompra, MovimientoCaja, MovimientoFinanciero)
 * es idéntica a la que vivía en `src/actions/productos.ts`.
 *
 * Fases:
 * - `validarReposicion` — validaciones ANTES de tocar `Producto.cantidad`.
 * - `ejecutarReposicionEscrituras` — writes financieros DESPUÉS del write del caller.
 * - `ejecutarReposicion` — ambas fases juntas (flujo de aprobación).
 *
 * `Producto.cantidad` queda en el caller (D3).
 */
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { shouldCreateCajaEgreso, type OrigenPagoCompraValue } from "@/lib/caja-ajuste";
import { calcularEfectivoFisico, type MovimientoFisicoCaja } from "@/lib/caja-balance";
import { calcularSaldoCuentaFinanciera } from "@/lib/cuenta-financiera";

// ─── Esquema de pagos (movido desde productos.ts) ────────────────────────────

export const pagoSchema = z.object({
  medio: z.enum(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  observacion: z.string().optional(),
});

export type PagoValidado = z.infer<typeof pagoSchema>;

// ─── Error de negocio (movido desde productos.ts) ────────────────────────────

export class ProductoBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductoBusinessError";
  }
}

export function failBusiness(message: string): never {
  throw new ProductoBusinessError(message);
}

// ─── Helpers de validación (movidos desde productos.ts) ──────────────────────

function validatePaymentDistribution(
  pagos: PagoValidado[] | undefined,
  totalCosto: number
) {
  if (!pagos || pagos.length === 0) return;

  const totalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
  if (Math.abs(totalPagos - totalCosto) > 0.01) {
    failBusiness(
      `La suma de los pagos ($${totalPagos.toFixed(2)}) no coincide con el total ($${totalCosto.toFixed(2)}).`
    );
  }

  const medios = pagos.map((pago) => pago.medio);
  if (new Set(medios).size !== medios.length) {
    failBusiness("No se permiten métodos de pago duplicados.");
  }
}

function getEfectivoCajaAsignado(pagos: PagoValidado[] | undefined) {
  return (pagos ?? []).reduce(
    (total, pago) =>
      pago.medio === "EFECTIVO_CAJA" ? total + pago.monto : total,
    0
  );
}

function formatPurchaseAmount(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getPurchaseMovementDescription(
  prefix: string,
  totalCosto: number,
  efectivoCaja: number
) {
  const totalLabel = formatPurchaseAmount(totalCosto);
  if (efectivoCaja <= 0) {
    return `${prefix} (Total: ${totalLabel}; sin impacto en efectivo de Caja)`;
  }

  return `${prefix} (Total: ${totalLabel}; efectivo de Caja: ${formatPurchaseAmount(efectivoCaja)})`;
}

function assertCajaSupportsCash(
  cajaAbierta: { movimientos: MovimientoFisicoCaja[] } | null,
  efectivoCaja: number
) {
  if (efectivoCaja <= 0) return;
  if (!cajaAbierta) {
    failBusiness(
      "No hay una caja abierta. Para utilizar Efectivo de Caja primero debe abrir una caja o seleccionar otro medio de pago."
    );
  }

  const cajaActual = calcularEfectivoFisico(
    cajaAbierta.movimientos
  ).efectivoEsperado;
  if (efectivoCaja > cajaActual) {
    failBusiness(
      `Fondos insuficientes en Caja. Disponible: $${cajaActual.toFixed(2)}, Solicitado: $${efectivoCaja.toFixed(2)}, Faltante: $${(efectivoCaja - cajaActual).toFixed(2)}.`
    );
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CajaReposicion {
  id: number;
  movimientos: MovimientoFisicoCaja[];
}

export interface CuentaBancoReposicion {
  id: number;
  saldoInicial: number;
  movimientos: MovimientoFisicoCaja[];
}

/**
 * Superficie mínima de la transacción que el helper consume.
 * Se deriva de los delegates reales de Prisma (misma instanciación que
 * `Prisma.TransactionClient`) y la satisface cualquier mock en los tests.
 */
export type ReposicionTx = {
  caja: Pick<PrismaClient["caja"], "findFirst" | "update">;
  cuentaFinanciera: Pick<PrismaClient["cuentaFinanciera"], "findFirst">;
  compra: Pick<PrismaClient["compra"], "create">;
  pagoCompra: Pick<PrismaClient["pagoCompra"], "createMany">;
  movimientoCaja: Pick<PrismaClient["movimientoCaja"], "create">;
  movimientoFinanciero: Pick<PrismaClient["movimientoFinanciero"], "create">;
};

export interface EjecutarReposicionParams {
  productoId: number;
  nombreProducto: string;
  cantidad: number;
  costoUnitario: number;
  proveedorId: number;
  origenPago: OrigenPagoCompraValue;
  pagos?: PagoValidado[];
  usuarioId: number;
  descripcionPrefijo: string;
}

export interface ValidarReposicionParams {
  cantidad: number;
  costoUnitario: number;
  origenPago: OrigenPagoCompraValue;
  pagos?: PagoValidado[];
}

export interface ReposicionValidada {
  totalCosto: number;
  efectivoCaja: number;
  montoTransferencia: number;
  usaEfectivoLegacy: boolean;
  tieneDistribucion: boolean;
  cajaAbierta: CajaReposicion | null;
  cuentaBancoPrincipal: CuentaBancoReposicion | null;
}

export interface ResultadoReposicion {
  compraId: number;
  cajaMovimientoCreado: boolean;
  bancoMovimientoCreado: boolean;
}

// ─── Fase 1: validaciones (bloque movido de updateProducto) ─────────────────

export async function validarReposicion(
  tx: ReposicionTx,
  params: ValidarReposicionParams
): Promise<ReposicionValidada> {
  const { cantidad, costoUnitario, origenPago, pagos } = params;

  const totalCosto = cantidad * costoUnitario;

  validatePaymentDistribution(pagos, totalCosto);

  const efectivoCaja = getEfectivoCajaAsignado(pagos);
  const usaEfectivoLegacy =
    (!pagos || pagos.length === 0) && shouldCreateCajaEgreso(origenPago);
  const tieneDistribucion = !!pagos && pagos.length > 0;
  const debeBuscarCaja = tieneDistribucion || usaEfectivoLegacy;
  const cajaAbierta = debeBuscarCaja
    ? await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
        include: {
          movimientos: { select: { tipo: true, monto: true } },
        },
      })
    : null;

  if (usaEfectivoLegacy && !cajaAbierta) {
    failBusiness("No hay una caja abierta para registrar el pago en efectivo.");
  }
  assertCajaSupportsCash(
    cajaAbierta,
    usaEfectivoLegacy ? totalCosto : efectivoCaja
  );

  // Validación anticipada de saldo Banco para transferencias
  const montoTransferencia = (pagos ?? []).reduce(
    (sum, pago) => pago.medio === "TRANSFERENCIA_BANCARIA" ? sum + pago.monto : sum,
    0
  );
  let cuentaBancoPrincipal: CuentaBancoReposicion | null = null;
  if (montoTransferencia > 0) {
    cuentaBancoPrincipal = await tx.cuentaFinanciera.findFirst({
      where: { tipo: "BANCO", esPrincipal: true, activa: true },
      include: { movimientos: { select: { tipo: true, monto: true } } },
    });
    if (!cuentaBancoPrincipal) {
      failBusiness("No hay una cuenta bancaria principal configurada.");
    }
    const saldoBanco = calcularSaldoCuentaFinanciera(
      cuentaBancoPrincipal.saldoInicial,
      cuentaBancoPrincipal.movimientos
    ).saldoActual;
    if (montoTransferencia > saldoBanco) {
      failBusiness(
        `Saldo bancario insuficiente. Disponible: $${saldoBanco.toFixed(2)}, Solicitado: $${montoTransferencia.toFixed(2)}, Faltante: $${(montoTransferencia - saldoBanco).toFixed(2)}.`
      );
    }
  }

  return {
    totalCosto,
    efectivoCaja,
    montoTransferencia,
    usaEfectivoLegacy,
    tieneDistribucion,
    cajaAbierta,
    cuentaBancoPrincipal,
  };
}

// ─── Fase 2: escrituras financieras (bloque movido de updateProducto) ────────

export async function ejecutarReposicionEscrituras(
  tx: ReposicionTx,
  validada: ReposicionValidada,
  params: EjecutarReposicionParams
): Promise<ResultadoReposicion> {
  const {
    productoId,
    cantidad,
    costoUnitario,
    proveedorId,
    origenPago,
    pagos,
    usuarioId,
    descripcionPrefijo,
  } = params;
  const {
    totalCosto,
    efectivoCaja,
    montoTransferencia,
    cajaAbierta,
    cuentaBancoPrincipal,
  } = validada;

  let cajaMovimientoCreado = false;
  let bancoMovimientoCreado = false;

  // La compra contable existe para cualquier origen y no depende de una caja abierta.
  const compra = await tx.compra.create({
    data: {
      proveedorId,
      usuarioId,
      total: totalCosto,
      origenPago,
      detalles: {
        create: {
          productoId,
          cantidad,
          costoUnitario,
          subtotal: totalCosto,
        },
      },
    },
  });

  // Handle multiple payments if provided
  if (pagos && pagos.length > 0) {
    // Create payment records
    await tx.pagoCompra.createMany({
      data: pagos.map(pago => ({
        compraId: compra.id,
        medio: pago.medio,
        monto: pago.monto,
        observacion: pago.observacion || null,
      })),
    });

    // Ancla en Caja solo si hay efectivo físico
    if (efectivoCaja > 0 && cajaAbierta) {
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId,
          compraId: compra.id,
          tipo: "EGRESO",
          monto: efectivoCaja,
          descripcion: getPurchaseMovementDescription(
            `${descripcionPrefijo} x${cantidad}`,
            totalCosto,
            efectivoCaja
          ),
        },
      });
      cajaMovimientoCreado = true;

      await tx.caja.update({
        where: { id: cajaAbierta.id },
        data: {
          totalVentas: {
            decrement: efectivoCaja,
          },
        },
      });
    }

    // MovimientoFinanciero para la parte transferida (Banco)
    if (montoTransferencia > 0 && cuentaBancoPrincipal) {
      await tx.movimientoFinanciero.create({
        data: {
          cuentaFinancieraId: cuentaBancoPrincipal.id,
          usuarioId,
          compraId: compra.id,
          tipo: "EGRESO",
          monto: montoTransferencia,
          descripcion: `${descripcionPrefijo} x${cantidad} (transferencia)`,
        },
      });
      bancoMovimientoCreado = true;
    }
  } else {
    // Legacy behavior: single payment method
    // Solo el efectivo de caja genera movimiento y decrementa el saldo físico.
    if (cajaAbierta && shouldCreateCajaEgreso(origenPago)) {
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId,
          compraId: compra.id,
          tipo: "EGRESO",
          monto: totalCosto,
          descripcion: `${descripcionPrefijo} x${cantidad}`,
        },
      });
      cajaMovimientoCreado = true;

      await tx.caja.update({
        where: { id: cajaAbierta.id },
        data: {
          totalVentas: {
            decrement: totalCosto,
          },
        },
      });
    }
  }

  return { compraId: compra.id, cajaMovimientoCreado, bancoMovimientoCreado };
}

// ─── Helper completo (fase 1 + fase 2) ───────────────────────────────────────

export async function ejecutarReposicion(
  tx: ReposicionTx,
  params: EjecutarReposicionParams
): Promise<ResultadoReposicion> {
  const validada = await validarReposicion(tx, params);
  return ejecutarReposicionEscrituras(tx, validada, params);
}
