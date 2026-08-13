import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularResumenBancoPeriodo } from "../cuenta-financiera";
import {
  calcularFlujosImpresion,
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

describe("Parte 7.5 — resumen inferior Caja/Banco", () => {
  it("mantiene separadas operación económica, Caja, Banco, pendiente y total", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/forms/CajaTerminal.tsx"),
      "utf8"
    );

    for (const label of [
      "Operación económica",
      "Inicial Caja",
      "Ingresos Caja",
      "Egresos Caja",
      "Saldo Caja",
      "Inicial Banco",
      "Ingresos Banco",
      "Egresos Banco",
      "Saldo Banco",
      "Por acreditar",
      "Total disponible",
    ]) {
      expect(source).toContain(label);
    }
  });

  it("reproduce el ejemplo esperado del usuario sin mezclar Caja y Banco", () => {
    const apertura = new Date("2026-08-13T09:00:00-03:00");

    const movimientosCaja: MovimientoEnriched[] = [
      movimiento({
        id: 1,
        tipo: "INGRESO",
        monto: 100_000,
        descripcion: "Apertura de caja",
        fecha: apertura,
        impactaCaja: true,
      }),
      movimiento({
        id: 2,
        tipo: "INGRESO",
        monto: 206_000,
        descripcion: "Factura B N° 1 - EFECTIVO",
        fecha: new Date("2026-08-13T10:00:00-03:00"),
        ventaId: 1,
        venta: { id: 1, total: 206_000, metodoPago: "EFECTIVO", tipoComprobante: "FACTURA_B" },
        impactaCaja: true,
      }),
      movimiento({
        id: -100_002,
        tipo: "INGRESO",
        monto: 60_000,
        descripcion: "Factura C N° 2 - TRANSFERENCIA",
        fecha: new Date("2026-08-13T10:30:00-03:00"),
        ventaId: 2,
        venta: { id: 2, total: 60_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
      movimiento({
        id: -100_003,
        tipo: "INGRESO",
        monto: 30_000,
        descripcion: "Factura C N° 3 - TARJETA_DEBITO",
        fecha: new Date("2026-08-13T11:00:00-03:00"),
        ventaId: 3,
        venta: { id: 3, total: 30_000, metodoPago: "TARJETA_DEBITO", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
      movimiento({
        id: -100_004,
        tipo: "INGRESO",
        monto: 60_000,
        descripcion: "Factura C N° 4 - TARJETA_CREDITO",
        fecha: new Date("2026-08-13T11:30:00-03:00"),
        ventaId: 4,
        venta: { id: 4, total: 60_000, metodoPago: "TARJETA_CREDITO", tipoComprobante: "FACTURA_C" },
        impactaCaja: false,
        esNoEfectivo: true,
      }),
      movimiento({
        id: 5,
        tipo: "EGRESO",
        monto: 247_200,
        descripcion: "Reposición de stock",
        fecha: new Date("2026-08-13T12:00:00-03:00"),
        compraId: 50,
        compra: {
          id: 50,
          total: 247_200,
          proveedor: { id: 1, nombre: "Proveedor" },
          pagos: [{ id: 1, medio: "EFECTIVO_CAJA", monto: 247_200 }],
          detalles: [],
        },
        impactaCaja: true,
      }),
    ];

    const movimientosBanco: MovimientoFinancieroImpresion[] = [
      {
        id: 90,
        tipo: "INGRESO",
        monto: 60_000,
        fecha: new Date("2026-08-13T10:30:00-03:00"),
        descripcion: "Venta transferencia",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        ventaId: 2,
        venta: { id: 2, total: 60_000, metodoPago: "TRANSFERENCIA", tipoComprobante: "FACTURA_C" },
      },
      {
        id: 91,
        tipo: "INGRESO",
        monto: 30_000,
        fecha: new Date("2026-08-13T11:00:00-03:00"),
        descripcion: "Venta débito",
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        ventaId: 3,
        venta: { id: 3, total: 30_000, metodoPago: "TARJETA_DEBITO", tipoComprobante: "FACTURA_C" },
      },
    ];

    const modelo = crearModeloImpresionLibroDiario(movimientosCaja, movimientosBanco, apertura);
    const flujos = calcularFlujosImpresion(modelo);
    const ventas = modelo
      .filter((mov) => mov.ventaId != null)
      .reduce((total, mov) => total + crearFilaImpresionLibroDiario(mov).importe, 0);
    const reposiciones = modelo
      .filter((mov) => mov.compraId != null)
      .reduce((total, mov) => total + crearFilaImpresionLibroDiario(mov).importe, 0);
    const porAcreditar = modelo.reduce((total, mov) => {
      if (mov.venta?.metodoPago === "TARJETA_CREDITO") return total + mov.venta.total;
      return total;
    }, 0);
    const resumenBanco = calcularResumenBancoPeriodo(
      [
        {
          saldoInicial: 0,
          movimientos: movimientosBanco.map((mov) => ({
            tipo: mov.tipo,
            monto: mov.monto,
            fecha: mov.fecha,
          })),
        },
      ],
      apertura
    );

    expect(flujos.ingresosCaja - flujos.egresosCaja).toBe(58_800);
    expect(resumenBanco).toEqual({
      inicial: 0,
      ingresos: 90_000,
      egresos: 0,
      saldo: 90_000,
    });
    expect(porAcreditar).toBe(60_000);
    expect(ventas).toBe(356_000);
    expect(reposiciones).toBe(247_200);
    expect(58_800 + resumenBanco.saldo).toBe(148_800);
  });
});
