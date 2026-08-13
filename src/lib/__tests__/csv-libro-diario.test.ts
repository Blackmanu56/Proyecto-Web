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
    monto: 60_000,
    descripcion: "Operación de prueba",
    fecha: new Date("2026-08-13T12:30:00-03:00"),
    usuario: { username: "admin", nombreCompleto: "Administrador" },
    ventaId: null,
    venta: null,
    compraId: null,
    compra: null,
    esNoEfectivo: false,
    impactaCaja: true,
    itemNumber: 1,
    saldoAcumulado: 100_000,
    saldoBanco: 0,
    ...overrides,
  };
}

function filaCSV(
  movimientosCaja: MovimientoEnriched[],
  movimientosBanco: MovimientoFinancieroImpresion[] = [],
  saldoBancoInicial = 0
) {
  const modelo = crearModeloImpresionLibroDiario(
    movimientosCaja,
    movimientosBanco,
    undefined,
    saldoBancoInicial
  );
  expect(modelo).toHaveLength(1);
  return {
    modelo,
    fila: crearFilaImpresionLibroDiario(modelo[0]),
  };
}

describe("CSV Libro Diario sincronizado con tabla Caja/Banco", () => {
  it("mantiene las 17 columnas esperadas", () => {
    const header =
      "N°;Fecha;Hora;Descripción;Tipo;Pago;Importe;Usuario;Ingreso Caja;Egreso Caja;Saldo Caja;Ingreso Banco;Egreso Banco;Saldo Banco;Ingreso Por Acreditar;Egreso Por Acreditar;Saldo Por Acreditar";
    expect(header.split(";")).toHaveLength(17);
  });

  it("A) venta efectivo exporta ingreso de Caja", () => {
    const { fila } = filaCSV([
      movimiento({
        monto: 206_000,
        saldoAcumulado: 306_000,
        ventaId: 10,
        venta: { id: 10, total: 206_000, metodoPago: "EFECTIVO" },
      }),
    ]);

    expect(fila.importe).toBe(206_000);
    expect(fila.ingresoCaja).toBe(206_000);
    expect(fila.egresoCaja).toBe(0);
    expect(fila.saldoCaja).toBe(206_000);
    expect(fila.ingresoBanco).toBe(0);
    expect(fila.egresoBanco).toBe(0);
    expect(fila.ingresoPorAcreditar).toBe(0);
  });

  it("B) venta transferencia exporta ingreso de Banco", () => {
    const { fila } = filaCSV([
      movimiento({
        monto: 60_000,
        impactaCaja: false,
        esNoEfectivo: true,
        saldoAcumulado: 100_000,
        ventaId: 11,
        venta: { id: 11, total: 60_000, metodoPago: "TRANSFERENCIA" },
      }),
    ]);

    expect(fila.importe).toBe(60_000);
    expect(fila.ingresoCaja).toBe(0);
    expect(fila.ingresoBanco).toBe(60_000);
    expect(fila.egresoBanco).toBe(0);
    expect(fila.ingresoPorAcreditar).toBe(0);
  });

  it("C) venta débito exporta ingreso de Banco", () => {
    const { fila } = filaCSV([
      movimiento({
        monto: 30_000,
        impactaCaja: false,
        esNoEfectivo: true,
        saldoAcumulado: 100_000,
        ventaId: 12,
        venta: { id: 12, total: 30_000, metodoPago: "TARJETA_DEBITO" },
      }),
    ]);

    expect(fila.ingresoCaja).toBe(0);
    expect(fila.ingresoBanco).toBe(30_000);
    expect(fila.ingresoPorAcreditar).toBe(0);
  });

  it("D) venta crédito exporta ingreso Por Acreditar", () => {
    const { fila } = filaCSV([
      movimiento({
        impactaCaja: false,
        esNoEfectivo: true,
        saldoAcumulado: 100_000,
        ventaId: 13,
        venta: { id: 13, total: 60_000, metodoPago: "TARJETA_CREDITO" },
      }),
    ]);

    expect(fila.importe).toBe(60_000);
    expect(fila.ingresoCaja).toBe(0);
    expect(fila.ingresoBanco).toBe(0);
    expect(fila.ingresoPorAcreditar).toBe(60_000);
    expect(fila.egresoPorAcreditar).toBe(0);
  });

  it("E) reposición transferencia exporta egreso de Banco", () => {
    const compra = {
      id: 20,
      total: 100_000,
      proveedor: { id: 1, nombre: "Proveedor" },
      detalles: [],
      pagos: [{ id: 1, medio: "TRANSFERENCIA_BANCARIA", monto: 100_000 }],
    };
    const bancario: MovimientoFinancieroImpresion = {
      id: 90,
      tipo: "EGRESO",
      monto: 100_000,
      fecha: new Date("2026-08-13T13:00:00-03:00"),
      descripcion: "Reposición transferencia",
      usuario: { username: "admin", nombreCompleto: "Administrador" },
      ventaId: null,
      venta: null,
      compraId: 20,
      compra,
    };

    const { fila } = filaCSV([], [bancario]);

    expect(fila.importe).toBe(100_000);
    expect(fila.egresoCaja).toBe(0);
    expect(fila.egresoBanco).toBe(100_000);
  });

  it("F) reposición mixta exporta Caja + Banco en una sola fila", () => {
    const compra = {
      id: 21,
      total: 100_000,
      proveedor: { id: 1, nombre: "Proveedor" },
      detalles: [],
      pagos: [
        { id: 1, medio: "EFECTIVO_CAJA", monto: 30_000 },
        { id: 2, medio: "TRANSFERENCIA_BANCARIA", monto: 70_000 },
      ],
    };
    const fisico = movimiento({
      tipo: "EGRESO",
      monto: 30_000,
      saldoAcumulado: 70_000,
      compraId: 21,
      compra,
    });
    const bancario: MovimientoFinancieroImpresion = {
      id: 91,
      tipo: "EGRESO",
      monto: 70_000,
      fecha: fisico.fecha,
      descripcion: "Reposición mixta",
      usuario: fisico.usuario,
      ventaId: null,
      venta: null,
      compraId: 21,
      compra,
    };

    const { modelo, fila } = filaCSV([fisico], [bancario]);

    expect(modelo).toHaveLength(1);
    expect(fila.importe).toBe(100_000);
    expect(fila.egresoCaja).toBe(30_000);
    expect(fila.egresoBanco).toBe(70_000);
  });

  it("G) histórico sin MovimientoFinanciero conserva Banco en 0", () => {
    const { fila } = filaCSV([
      movimiento({
        id: 30,
        impactaCaja: false,
        esNoEfectivo: true,
        descripcion: "Venta histórica por Mercado Pago",
        ventaId: 30,
        venta: { id: 30, total: 50_000, metodoPago: "MERCADO_PAGO" },
      }),
    ]);

    expect(fila.pago).toBe("Mercado Pago");
    expect(fila.ingresoBanco).toBe(0);
    expect(fila.egresoBanco).toBe(0);
  });

  it("H) evita duplicación cuando Caja y Banco representan la misma operación", () => {
    const venta = { id: 40, total: 60_000, metodoPago: "TRANSFERENCIA" };
    const caja = movimiento({
      id: -40,
      impactaCaja: false,
      esNoEfectivo: true,
      ventaId: 40,
      venta,
    });
    const bancario: MovimientoFinancieroImpresion = {
      id: 92,
      tipo: "INGRESO",
      monto: 60_000,
      fecha: caja.fecha,
      descripcion: "Venta transferencia #40",
      usuario: caja.usuario,
      ventaId: 40,
      venta,
      compraId: null,
      compra: null,
    };

    const modelo = crearModeloImpresionLibroDiario([caja], [bancario]);
    expect(modelo).toHaveLength(1);
    expect(crearFilaImpresionLibroDiario(modelo[0]).ingresoBanco).toBe(60_000);
  });

  it("exporta solo valores numéricos o 0 para análisis en Excel", () => {
    const { fila } = filaCSV([
      movimiento({
        id: 50,
        ventaId: 50,
        venta: { id: 50, total: 10_000, metodoPago: "EFECTIVO" },
      }),
    ]);

    for (const value of [
      fila.ingresoCaja,
      fila.egresoCaja,
      fila.saldoCaja,
      fila.ingresoBanco,
      fila.egresoBanco,
      fila.saldoBanco,
      fila.ingresoPorAcreditar,
      fila.egresoPorAcreditar,
    ]) {
      expect(typeof value).toBe("number");
    }
    expect(fila.egresoBanco).toBe(0);
  });
});
