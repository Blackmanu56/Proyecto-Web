/**
 * `ejecutarReposicion` — helper de reposición extraído de `updateProducto`
 * (ver design.md D2: mover, no reescribir).
 *
 * Escenarios movidos desde:
 * - `reposicion-banco-integration.test.ts` (A–J, L): efectivo, banco, mixto
 * - `productos-payment-distribution.test.ts`: fondos de Caja, legacy, duplicados
 *
 * El helper valida distribución, caja abierta + fondos, y saldo de Banco
 * ANTES de escribir. `Producto.cantidad` queda en el caller (D3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ejecutarReposicion,
  ProductoBusinessError,
  type EjecutarReposicionParams,
} from "../reposicion";

type Pago = {
  medio: "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA";
  monto: number;
  observacion?: string;
};

/* ── Fixtures ──────────────────────────────────────────────────────────────── */

const OPEN_CAJA = {
  id: 30,
  movimientos: [{ tipo: "INGRESO", monto: 204_840 }],
};

const BANK_ACCOUNT = {
  id: 1,
  saldoInicial: 500_000,
  movimientos: [],
};

const tx = {
  caja: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cuentaFinanciera: {
    findFirst: vi.fn(),
  },
  compra: { create: vi.fn() },
  pagoCompra: { createMany: vi.fn() },
  movimientoCaja: { create: vi.fn() },
  movimientoFinanciero: { create: vi.fn() },
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function params(overrides: Partial<EjecutarReposicionParams> = {}): EjecutarReposicionParams {
  return {
    productoId: 10,
    nombreProducto: "Kit transmisión",
    cantidad: 2,
    costoUnitario: 123_600,
    proveedorId: 3,
    origenPago: "EFECTIVO_CAJA",
    pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }],
    usuarioId: 1,
    descripcionPrefijo: "Reposición de 'Kit transmisión'",
    ...overrides,
  };
}

function expectNoWrites() {
  expect(tx.compra.create).not.toHaveBeenCalled();
  expect(tx.pagoCompra.createMany).not.toHaveBeenCalled();
  expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  expect(tx.caja.update).not.toHaveBeenCalled();
  expect(tx.movimientoFinanciero.create).not.toHaveBeenCalled();
}

function expectNoCajaImpact() {
  expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  expect(tx.caja.update).not.toHaveBeenCalled();
}

function expectNoFinancieroImpact() {
  expect(tx.movimientoFinanciero.create).not.toHaveBeenCalled();
}

/* ── Setup ─────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  tx.caja.findFirst.mockResolvedValue(OPEN_CAJA);
  tx.cuentaFinanciera.findFirst.mockResolvedValue(BANK_ACCOUNT);
  tx.compra.create.mockResolvedValue({ id: 50 });
  tx.pagoCompra.createMany.mockResolvedValue({ count: 1 });
  tx.movimientoCaja.create.mockResolvedValue({ id: 70 });
  tx.caja.update.mockResolvedValue({ id: 30 });
  tx.movimientoFinanciero.create.mockResolvedValue({ id: 80 });
});

afterEach(() => vi.restoreAllMocks());

/* ── Tests ─────────────────────────────────────────────────────────────────── */

describe("ejecutarReposicion", () => {
  describe("validaciones de distribución", () => {
    it("rechaza métodos de pago duplicados antes de cualquier write", async () => {
      const pagos: Pago[] = [
        { medio: "TRANSFERENCIA_BANCARIA", monto: 120_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 127_200 },
      ];

      await expect(ejecutarReposicion(tx, params({ pagos }))).rejects.toThrow(
        "No se permiten métodos de pago duplicados."
      );
      expectNoWrites();
    });

    it("rechaza una distribución que no suma el total antes de cualquier write", async () => {
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 200_000 }];

      await expect(ejecutarReposicion(tx, params({ pagos }))).rejects.toThrow(
        "La suma de los pagos ($200000.00) no coincide con el total ($247200.00)."
      );
      expectNoWrites();
    });

    it("lanza ProductoBusinessError para errores de negocio", async () => {
      const pagos: Pago[] = [
        { medio: "TRANSFERENCIA_BANCARIA", monto: 120_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 127_200 },
      ];

      await expect(ejecutarReposicion(tx, params({ pagos }))).rejects.toBeInstanceOf(
        ProductoBusinessError
      );
    });
  });

  describe("efectivo de Caja", () => {
    it("A) efectivo con Caja abierta: crea MovimientoCaja EGRESO, no toca Banco", async () => {
      const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 100_000 }];

      const result = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(result).toEqual({
        compraId: 50,
        cajaMovimientoCreado: true,
        bancoMovimientoCreado: false,
      });
      expect(tx.compra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total: 100_000 }),
        })
      );
      expect(tx.pagoCompra.createMany).toHaveBeenCalledOnce();
      expect(tx.movimientoCaja.create).toHaveBeenCalledOnce();
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipo: "EGRESO", monto: 100_000 }),
        })
      );
      expect(tx.caja.update).toHaveBeenCalledWith({
        where: { id: 30 },
        data: { totalVentas: { decrement: 100_000 } },
      });
      expectNoFinancieroImpact();
    });

    it("B) efectivo sin Caja abierta: rechaza atómicamente", async () => {
      tx.caja.findFirst.mockResolvedValueOnce(null);
      const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 100_000 }];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 100_000, pagos }))
      ).rejects.toThrow("No hay una caja abierta");
      expectNoWrites();
    });

    it("rechaza todo-efectivo por encima del saldo de Caja antes de cualquier write", async () => {
      const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 247_200 }];

      await expect(ejecutarReposicion(tx, params({ pagos }))).rejects.toThrow(
        "Fondos insuficientes en Caja"
      );
      expectNoWrites();
    });

    it("rechaza mixto cuando solo la parte de efectivo excede el saldo de Caja", async () => {
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 220_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 27_200 },
      ];

      await expect(ejecutarReposicion(tx, params({ pagos }))).rejects.toThrow(
        "Fondos insuficientes en Caja"
      );
      expectNoWrites();
    });

    it("valida los fondos desde movimientos y no desde totalVentas", async () => {
      tx.caja.findFirst.mockResolvedValueOnce({
        id: 30,
        movimientos: [{ tipo: "INGRESO", monto: 100_000 }],
      });
      const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 123_600 }];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 123_600, pagos }))
      ).rejects.toThrow("Fondos insuficientes en Caja");
      expectNoWrites();
    });

    it("acepta efectivo exactamente igual al saldo disponible junto a una transferencia", async () => {
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 204_840 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 42_360 },
      ];

      const result = await ejecutarReposicion(tx, params({ pagos }));

      expect(result.cajaMovimientoCreado).toBe(true);
      expect(result.bancoMovimientoCreado).toBe(true);
      expect(tx.movimientoCaja.create).toHaveBeenCalledOnce();
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ monto: 204_840 }),
        })
      );
      expect(tx.caja.update).toHaveBeenCalledWith({
        where: { id: 30 },
        data: { totalVentas: { decrement: 204_840 } },
      });
    });
  });

  describe("Banco", () => {
    it("C) transferencia con Banco suficiente: crea MovimientoFinanciero EGRESO, no toca Caja", async () => {
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

      const result = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(result).toEqual({
        compraId: 50,
        cajaMovimientoCreado: false,
        bancoMovimientoCreado: true,
      });
      expect(tx.compra.create).toHaveBeenCalledOnce();
      expect(tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expect(tx.movimientoFinanciero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuentaFinancieraId: 1,
            tipo: "EGRESO",
            monto: 100_000,
            compraId: 50,
          }),
        })
      );
      expectNoCajaImpact();
    });

    it("D) transferencia con Caja cerrada: permite la operación", async () => {
      tx.caja.findFirst.mockResolvedValueOnce(null);
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

      const result = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(result).toEqual({
        compraId: 50,
        cajaMovimientoCreado: false,
        bancoMovimientoCreado: true,
      });
      expect(tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expectNoCajaImpact();
    });

    it("E) transferencia sin Banco principal: falla", async () => {
      tx.cuentaFinanciera.findFirst.mockResolvedValueOnce(null);
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 100_000, pagos }))
      ).rejects.toThrow("No hay una cuenta bancaria principal configurada.");
      expectNoWrites();
    });

    it("F) transferencia con saldo Banco insuficiente: falla", async () => {
      tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
        ...BANK_ACCOUNT,
        saldoInicial: 50_000,
      });
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }];

      const error = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProductoBusinessError);
      expect((error as Error).message).toContain("Saldo bancario insuficiente");
      expect((error as Error).message).toContain("Disponible: $50000.00");
      expect((error as Error).message).toContain("Solicitado: $100000.00");
      expectNoWrites();
    });
  });

  describe("mixto", () => {
    it("G) mixto: crea MovimientoCaja EGRESO + MovimientoFinanciero EGRESO", async () => {
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 30_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
      ];

      const result = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(result).toEqual({
        compraId: 50,
        cajaMovimientoCreado: true,
        bancoMovimientoCreado: true,
      });
      expect(tx.compra.create).toHaveBeenCalledOnce();

      expect(tx.pagoCompra.createMany).toHaveBeenCalledOnce();
      expect(tx.pagoCompra.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ medio: "EFECTIVO_CAJA", monto: 30_000 }),
          expect.objectContaining({ medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 }),
        ]),
      });

      expect(tx.movimientoCaja.create).toHaveBeenCalledOnce();
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipo: "EGRESO", monto: 30_000 }),
        })
      );

      expect(tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expect(tx.movimientoFinanciero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuentaFinancieraId: 1,
            tipo: "EGRESO",
            monto: 70_000,
          }),
        })
      );
    });

    it("H) mixto sin Caja abierta con efectivo > 0: falla", async () => {
      tx.caja.findFirst.mockResolvedValueOnce(null);
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 30_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
      ];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 100_000, pagos }))
      ).rejects.toThrow("No hay una caja abierta");
      expectNoWrites();
    });

    it("I) mixto con efectivo insuficiente: falla", async () => {
      tx.caja.findFirst.mockResolvedValueOnce({
        ...OPEN_CAJA,
        movimientos: [{ tipo: "INGRESO", monto: 10_000 }],
      });
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 50_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 50_000 },
      ];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 100_000, pagos }))
      ).rejects.toThrow("Fondos insuficientes en Caja");
      expectNoWrites();
    });

    it("J) mixto con Banco insuficiente: falla", async () => {
      tx.cuentaFinanciera.findFirst.mockResolvedValueOnce({
        ...BANK_ACCOUNT,
        saldoInicial: 10_000,
      });
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 30_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
      ];

      await expect(
        ejecutarReposicion(tx, params({ cantidad: 1, costoUnitario: 100_000, pagos }))
      ).rejects.toThrow("Saldo bancario insuficiente");
      expectNoWrites();
    });

    it("L) crea Compra con DetalleCompra correcto", async () => {
      const pagos: Pago[] = [
        { medio: "EFECTIVO_CAJA", monto: 30_000 },
        { medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
      ];

      await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(tx.compra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proveedorId: 3,
            usuarioId: 1,
            total: 100_000,
            origenPago: "EFECTIVO_CAJA",
            detalles: {
              create: expect.objectContaining({
                productoId: 10,
                cantidad: 1,
                costoUnitario: 100_000,
                subtotal: 100_000,
              }),
            },
          }),
        })
      );
    });
  });

  describe("legacy (sin distribución de pagos)", () => {
    it("rechaza efectivo legacy por encima del saldo de Caja antes de cualquier write", async () => {
      await expect(ejecutarReposicion(tx, params({ pagos: undefined }))).rejects.toThrow(
        "Fondos insuficientes en Caja"
      );
      expectNoWrites();
    });

    it("rechaza efectivo legacy sin Caja abierta antes de cualquier write", async () => {
      tx.caja.findFirst.mockResolvedValueOnce(null);

      await expect(
        ejecutarReposicion(tx, params({ pagos: undefined }))
      ).rejects.toThrow("No hay una caja abierta para registrar el pago en efectivo.");
      expectNoWrites();
    });

    it("crea un único egreso por el total cuando hay Caja abierta", async () => {
      const result = await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos: undefined })
      );

      expect(result).toEqual({
        compraId: 50,
        cajaMovimientoCreado: true,
        bancoMovimientoCreado: false,
      });
      expect(tx.movimientoCaja.create).toHaveBeenCalledOnce();
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: "EGRESO",
            monto: 100_000,
            compraId: 50,
            descripcion: "Reposición de 'Kit transmisión' x1",
          }),
        })
      );
      expect(tx.caja.update).toHaveBeenCalledWith({
        where: { id: 30 },
        data: { totalVentas: { decrement: 100_000 } },
      });
      expectNoFinancieroImpact();
    });
  });

  describe("descripciones", () => {
    it("registra la transferencia con sufijo (transferencia)", async () => {
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

      await ejecutarReposicion(tx, params({ pagos }));

      expect(tx.movimientoFinanciero.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            descripcion: "Reposición de 'Kit transmisión' x2 (transferencia)",
          }),
        })
      );
    });

    it("describe el detalle de efectivo en la distribución de pagos", async () => {
      const pagos: Pago[] = [{ medio: "EFECTIVO_CAJA", monto: 100_000 }];

      await ejecutarReposicion(
        tx,
        params({ cantidad: 1, costoUnitario: 100_000, pagos })
      );

      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            descripcion: expect.stringContaining("Total:"),
          }),
        })
      );
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            descripcion: expect.stringContaining("efectivo de Caja:"),
          }),
        })
      );
    });
  });

  describe("transferencia sin anclaje", () => {
    it("persiste una transferencia sin Caja abierta y crea el MovimientoFinanciero", async () => {
      tx.caja.findFirst.mockResolvedValueOnce(null);
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

      const result = await ejecutarReposicion(tx, params({ pagos }));

      expect(result.bancoMovimientoCreado).toBe(true);
      expect(tx.movimientoFinanciero.create).toHaveBeenCalledOnce();
      expectNoCajaImpact();
    });

    it("acepta una transferencia de 247200 con solo 204840 en Caja y consulta Caja una vez", async () => {
      const pagos: Pago[] = [{ medio: "TRANSFERENCIA_BANCARIA", monto: 247_200 }];

      const result = await ejecutarReposicion(tx, params({ pagos }));

      expect(result.bancoMovimientoCreado).toBe(true);
      expect(result.cajaMovimientoCreado).toBe(false);
      expect(tx.compra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total: 247_200 }),
        })
      );
      expect(tx.caja.findFirst).toHaveBeenCalledOnce();
      expectNoCajaImpact();
    });
  });
});
