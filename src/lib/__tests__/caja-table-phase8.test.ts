import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  crearFilaImpresionLibroDiario,
  crearModeloImpresionLibroDiario,
  type MovimientoFinancieroImpresion,
} from "../caja-print";
import type { MovimientoEnriched } from "../caja-filters";

function movimiento(
  overrides: Partial<MovimientoEnriched>
): MovimientoEnriched {
  return {
    id: 1,
    tipo: "INGRESO",
    monto: 0,
    descripcion: "Movimiento",
    fecha: new Date("2026-08-13T09:00:00-03:00"),
    usuario: { username: "admin", nombreCompleto: "Administrador" },
    ventaId: null,
    venta: null,
    compraId: null,
    compra: null,
    esNoEfectivo: false,
    impactaCaja: true,
    itemNumber: 1,
    saldoAcumulado: 0,
    saldoBanco: 0,
    ...overrides,
  };
}

describe("Parte 8 — tabla Libro Diario Caja/Banco", () => {
  it("muestra las columnas separadas de Caja y Banco", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/forms/CajaTerminal.tsx"),
      "utf8"
    );

    for (const label of [
      "Ing. Caja",
      "Egr. Caja",
      "Saldo Caja",
      "Ing. Banco",
      "Egr. Banco",
      "Saldo Banco",
      "Ing. Pend.",
      "Saldo Pend.",
    ]) {
      expect(source).toContain(label);
    }

    expect(source).toContain('min-w-[1720px]');
    expect(source).toContain('movimientosLibroDiarioFiltrados.map');
  });

  it("A) venta efectivo muestra ingreso Caja", () => {
    const fila = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "INGRESO",
        monto: 206_000,
        ventaId: 1,
        venta: { id: 1, total: 206_000, metodoPago: "EFECTIVO", tipoComprobante: "FACTURA_B" },
      })
    );

    expect(fila.ingresoCaja).toBe(206_000);
    expect(fila.ingresoBanco).toBe(0);
  });

  it("B/C/D) transferencia y débito ingresan Banco, crédito genera pendiente", () => {
    const transferencia = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "INGRESO",
        monto: 60_000,
        impactaCaja: false,
        esNoEfectivo: true,
        ventaId: 2,
        venta: { id: 2, total: 60_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
      })
    );
    const debito = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "INGRESO",
        monto: 30_000,
        impactaCaja: false,
        esNoEfectivo: true,
        ventaId: 3,
        venta: { id: 3, total: 30_000, metodoPago: "TARJETA_DEBITO", tipoComprobante: "FACTURA_C" },
      })
    );
    const credito = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "INGRESO",
        monto: 60_000,
        impactaCaja: false,
        esNoEfectivo: true,
        ventaId: 4,
        venta: { id: 4, total: 60_000, metodoPago: "TARJETA_CREDITO", tipoComprobante: "FACTURA_C" },
      })
    );

    expect(transferencia.ingresoBanco).toBe(60_000);
    expect(debito.ingresoBanco).toBe(30_000);
    expect(credito.ingresoBanco).toBe(0);
    expect(credito.egresoBanco).toBe(0);
    expect(credito.ingresoCaja).toBe(0);
    expect(credito.ingresoPorAcreditar).toBe(60_000);
  });

  it("E/F/G) reposición efectivo, transferencia y mixta impactan donde corresponde", () => {
    const egresoCaja = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 247_200,
        compraId: 10,
        compra: {
          id: 10,
          total: 247_200,
          proveedor: { id: 1, nombre: "Proveedor" },
          pagos: [{ id: 1, medio: "EFECTIVO_CAJA", monto: 247_200 }],
          detalles: [],
        },
      })
    );
    const egresoBanco = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 70_000,
        impactaCaja: false,
        compraId: 11,
        compra: {
          id: 11,
          total: 70_000,
          proveedor: { id: 1, nombre: "Proveedor" },
          pagos: [{ id: 2, medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 }],
          detalles: [],
        },
      })
    );
    const mixta = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 30_000,
        compraId: 12,
        compra: {
          id: 12,
          total: 100_000,
          proveedor: { id: 1, nombre: "Proveedor" },
          pagos: [
            { id: 3, medio: "EFECTIVO_CAJA", monto: 30_000 },
            { id: 4, medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
          ],
          detalles: [],
        },
      })
    );

    expect(egresoCaja.egresoCaja).toBe(247_200);
    expect(egresoCaja.egresoBanco).toBe(0);
    expect(egresoBanco.egresoCaja).toBe(0);
    expect(egresoBanco.egresoBanco).toBe(70_000);
    expect(mixta.importe).toBe(100_000);
    expect(mixta.egresoCaja).toBe(30_000);
    expect(mixta.egresoBanco).toBe(70_000);
  });

  it("H/I/J) saldo Caja y Banco acumulados correctos sin duplicar operaciones", () => {
    const apertura = new Date("2026-08-13T09:00:00-03:00");
    const cajaRows: MovimientoEnriched[] = [
      movimiento({
        id: 1,
        tipo: "INGRESO",
        monto: 100_000,
        descripcion: "Saldo inicial de apertura de caja",
        fecha: apertura,
      }),
      movimiento({
        id: 2,
        tipo: "INGRESO",
        monto: 206_000,
        descripcion: "Factura B N° 1 - EFECTIVO",
        fecha: new Date("2026-08-13T10:00:00-03:00"),
        ventaId: 1,
        venta: { id: 1, total: 206_000, metodoPago: "EFECTIVO", tipoComprobante: "FACTURA_B" },
      }),
      movimiento({
        id: -100_002,
        tipo: "INGRESO",
        monto: 60_000,
        descripcion: "Factura C N° 2 - TRANSFERENCIA",
        fecha: new Date("2026-08-13T11:00:00-03:00"),
        ventaId: 2,
        venta: { id: 2, total: 60_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
      movimiento({
        id: 4,
        tipo: "EGRESO",
        monto: 247_200,
        descripcion: "Reposición de stock",
        fecha: new Date("2026-08-13T12:00:00-03:00"),
        compraId: 20,
        compra: {
          id: 20,
          total: 247_200,
          proveedor: { id: 1, nombre: "Proveedor" },
          pagos: [{ id: 1, medio: "EFECTIVO_CAJA", monto: 247_200 }],
          detalles: [],
        },
      }),
      movimiento({
        id: -100_005,
        tipo: "INGRESO",
        monto: 30_000,
        descripcion: "Factura C N° 3 - TARJETA_DEBITO",
        fecha: new Date("2026-08-13T13:00:00-03:00"),
        ventaId: 3,
        venta: { id: 3, total: 30_000, metodoPago: "TARJETA_DEBITO", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
      movimiento({
        id: -100_006,
        tipo: "INGRESO",
        monto: 60_000,
        descripcion: "Factura C N° 4 - TARJETA_CREDITO",
        fecha: new Date("2026-08-13T14:00:00-03:00"),
        ventaId: 4,
        venta: { id: 4, total: 60_000, metodoPago: "TARJETA_CREDITO", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
    ];

    const bancoRows: MovimientoFinancieroImpresion[] = [
      {
        id: 90,
        tipo: "INGRESO",
        monto: 60_000,
        fecha: new Date("2026-08-13T11:00:00-03:00"),
        descripcion: "Venta transferencia",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        ventaId: 2,
        venta: { id: 2, total: 60_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
      },
      {
        id: 91,
        tipo: "INGRESO",
        monto: 30_000,
        fecha: new Date("2026-08-13T13:00:00-03:00"),
        descripcion: "Venta débito",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        ventaId: 3,
        venta: { id: 3, total: 30_000, metodoPago: "TARJETA_DEBITO", tipoComprobante: "FACTURA_C" },
      },
    ];

    const modelo = crearModeloImpresionLibroDiario(cajaRows, bancoRows, apertura, 0);
    expect(modelo).toHaveLength(6);
    expect(modelo.filter((mov) => mov.ventaId === 2)).toHaveLength(1);
    expect(modelo.filter((mov) => mov.ventaId === 3)).toHaveLength(1);

    const ultimaFila = crearFilaImpresionLibroDiario(modelo[modelo.length - 1]);
    expect(ultimaFila.saldoCaja).toBe(58_800);
    expect(ultimaFila.saldoBanco).toBe(90_000);
  });

  it("K) el render visual usa raya en lugar de $0", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/forms/CajaTerminal.tsx"),
      "utf8"
    );

    expect(source).toContain('opacity-50">{"\\u2014"}<');
    expect(source).not.toContain("text-[var(--text-secondary)] opacity-50\">$0<");
  });

  it("L) saldo pendiente acumulado se mantiene histórico por fila", () => {
    const apertura = new Date("2026-08-13T09:00:00-03:00");
    const modelo = crearModeloImpresionLibroDiario(
      [
        movimiento({
          id: 1,
          tipo: "INGRESO",
          monto: 60_000,
          fecha: new Date("2026-08-13T10:00:00-03:00"),
          ventaId: 10,
          venta: { id: 10, total: 60_000, metodoPago: "TARJETA_CREDITO", tipoComprobante: "FACTURA_C" },
          impactaCaja: false,
          esNoEfectivo: true,
        }),
        movimiento({
          id: 2,
          tipo: "INGRESO",
          monto: 30_000,
          fecha: new Date("2026-08-13T11:00:00-03:00"),
          ventaId: 11,
          venta: { id: 11, total: 30_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
          impactaCaja: false,
          esNoEfectivo: true,
        }),
      ],
      [],
      apertura,
      0
    );

    const credito = crearFilaImpresionLibroDiario(modelo[0]);
    const transferencia = crearFilaImpresionLibroDiario(modelo[1]);

    expect(credito.ingresoPorAcreditar).toBe(60_000);
    expect(credito.saldoPorAcreditar).toBe(60_000);
    expect(transferencia.ingresoPorAcreditar).toBe(0);
    expect(transferencia.saldoPorAcreditar).toBe(60_000);
  });

  it("M) histórico sin movimiento financiero real no inventa pendiente", () => {
    const fila = crearFilaImpresionLibroDiario(
      movimiento({
        id: 99,
        tipo: "INGRESO",
        monto: 50_000,
        descripcion: "Venta histórica por Mercado Pago",
        impactaCaja: false,
        esNoEfectivo: true,
        ventaId: 99,
        venta: { id: 99, total: 50_000, metodoPago: "MERCADO_PAGO", tipoComprobante: "FACTURA_C" },
      })
    );

    expect(fila.ingresoPorAcreditar).toBe(0);
    expect(fila.saldoPorAcreditar).toBe(0);
  });
});
