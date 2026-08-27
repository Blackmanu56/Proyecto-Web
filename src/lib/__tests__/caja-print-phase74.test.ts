import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calcularFlujosImpresion,
  construirDescripcionImpresion,
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
    saldoBanco: 200_000,
    ...overrides,
  };
}

describe("Parte 7.4 — impresión Caja y Banco", () => {
  it("proyecta transferencia y débito como ingreso bancario", () => {
    for (const metodoPago of ["TRANSFERENCIA", "TARJETA_DEBITO"]) {
      const fila = crearFilaImpresionLibroDiario(
        movimiento({
          impactaCaja: false,
          esNoEfectivo: true,
          venta: { id: 10, total: 60_000, metodoPago },
        })
      );

      expect(fila.importe).toBe(60_000);
      expect(fila.ingresoCaja).toBe(0);
      expect(fila.ingresoBanco).toBe(60_000);
      expect(fila.pago).toBe(metodoPago === "TRANSFERENCIA" ? "Transferencia" : "Débito");
    }
  });

  it("proyecta crédito sin Caja/Banco y conserva el importe económico", () => {
    const fila = crearFilaImpresionLibroDiario(
      movimiento({
        monto: 100_000,
        impactaCaja: false,
        esNoEfectivo: true,
        venta: { id: 11, total: 100_000, metodoPago: "TARJETA_CREDITO" },
      })
    );

    expect(fila.pago).toBe("Crédito");
    expect(fila.importe).toBe(100_000);
    expect(fila.ingresoCaja).toBe(0);
    expect(fila.egresoCaja).toBe(0);
    expect(fila.ingresoBanco).toBe(0);
    expect(fila.egresoBanco).toBe(0);
  });

  it("unifica una reposición mixta real y muestra ambos egresos", () => {
    const compraMixta = {
      id: 20,
      total: 60_000,
      proveedor: { id: 1, nombre: "Proveedor" },
      detalles: [],
      pagos: [
        { id: 1, medio: "EFECTIVO_CAJA", monto: 30_000 },
        { id: 2, medio: "TRANSFERENCIA_BANCARIA", monto: 30_000 },
      ],
    };
    const fisico = movimiento({
        tipo: "EGRESO",
        monto: 30_000,
        compraId: 20,
        compra: compraMixta,
        saldoAcumulado: 70_000,
    });
    const bancario: MovimientoFinancieroImpresion = {
      id: 80,
      tipo: "EGRESO",
      monto: 30_000,
      fecha: fisico.fecha,
      descripcion: "Reposición por transferencia",
      usuario: fisico.usuario,
      ventaId: null,
      venta: null,
      compraId: 20,
      compra: compraMixta,
    };

    const modelo = crearModeloImpresionLibroDiario([fisico], [bancario]);
    expect(modelo).toHaveLength(1);
    const fila = crearFilaImpresionLibroDiario(modelo[0]);

    expect(fila.pago).toBe("Mixto");
    expect(fila.importe).toBe(60_000);
    expect(fila.egresoCaja).toBe(30_000);
    expect(fila.egresoBanco).toBe(30_000);
  });

  it("proyecta una reposición en efectivo solo como egreso de Caja", () => {
    const fila = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 247_200,
        saldoAcumulado: 58_800,
        compraId: 22,
        compra: {
          id: 22,
          total: 247_200,
          proveedor: { id: 1, nombre: "Proveedor" },
          detalles: [],
          pagos: [{ id: 1, medio: "EFECTIVO_CAJA", monto: 247_200 }],
        },
      })
    );

    expect(fila.importe).toBe(247_200);
    expect(fila.egresoCaja).toBe(247_200);
    expect(fila.egresoBanco).toBe(0);
  });

  it("incluye una reposición solo bancaria sin crear una fila duplicada", () => {
    const compraTransferencia = {
      id: 30,
      total: 60_000,
      proveedor: { id: 1, nombre: "Proveedor" },
      detalles: [],
      pagos: [{ id: 3, medio: "TRANSFERENCIA_BANCARIA", monto: 60_000 }],
    };
    const bancario: MovimientoFinancieroImpresion = {
      id: 81,
      tipo: "EGRESO",
      monto: 60_000,
      fecha: new Date("2026-08-13T13:00:00-03:00"),
      descripcion: "Reposición solo transferencia",
      usuario: { username: "admin", nombreCompleto: "Administrador" },
      ventaId: null,
      venta: null,
      compraId: 30,
      compra: compraTransferencia,
    };

    const modelo = crearModeloImpresionLibroDiario([], [bancario]);
    expect(modelo).toHaveLength(1);
    const fila = crearFilaImpresionLibroDiario(modelo[0]);
    expect(fila.pago).toBe("Transferencia");
    expect(fila.importe).toBe(60_000);
    expect(fila.egresoCaja).toBe(0);
    expect(fila.egresoBanco).toBe(60_000);
    expect(calcularFlujosImpresion(modelo)).toEqual({
      ingresosCaja: 0,
      egresosCaja: 0,
      ingresosBanco: 0,
      egresosBanco: 60_000,
    });
  });

  it("deduplica una venta bancaria presente en ambos ledgers", () => {
    const venta = { id: 40, total: 30_000, metodoPago: "TARJETA_DEBITO" };
    const proyectado = movimiento({
      id: -100_040,
      monto: 30_000,
      impactaCaja: false,
      esNoEfectivo: true,
      ventaId: 40,
      venta,
    });
    const bancario: MovimientoFinancieroImpresion = {
      id: 82,
      tipo: "INGRESO",
      monto: 30_000,
      fecha: proyectado.fecha,
      descripcion: "Venta débito #40",
      usuario: proyectado.usuario,
      ventaId: 40,
      venta,
      compraId: null,
      compra: null,
    };

    const modelo = crearModeloImpresionLibroDiario([proyectado], [bancario]);
    expect(modelo).toHaveLength(1);
    expect(crearFilaImpresionLibroDiario(modelo[0]).ingresoBanco).toBe(30_000);
  });

  it("usa el comprobante para ventas impresas en lugar del texto técnico de ledger", () => {
    expect(
      construirDescripcionImpresion(
        movimiento({
          descripcion: "Venta #53 · Crédito — Total $ 60.000,00",
          ventaId: 53,
          venta: {
            id: 53,
            total: 60_000,
            metodoPago: "TARJETA_CREDITO",
            tipoComprobante: "FACTURA_C",
          },
        })
      )
    ).toBe("FACTURA C N° 53");
  });

  it("muestra solo el nombre del producto en reposiciones impresas de un ítem", () => {
    expect(
      construirDescripcionImpresion(
        movimiento({
          tipo: "EGRESO",
          descripcion:
            "Reposición — Batería AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada · AGM",
          compraId: 88,
          compra: {
            id: 88,
            total: 60_000,
            proveedor: { id: 1, nombre: "Proveedor" },
            detalles: [
              {
                id: 701,
                cantidad: 1,
                costoUnitario: 60_000,
                subtotal: 60_000,
                producto: {
                  id: 501,
                  nombre:
                    "Batería AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada",
                  marca: "AGM",
                  cantidad: 99,
                  categoria: { id: 10, nombre: "Eléctrico" },
                },
              },
            ],
            pagos: [{ id: 1, medio: "TRANSFERENCIA_BANCARIA", monto: 60_000 }],
          },
        })
      )
    ).toBe("Batería AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada");
  });

  it("mantiene las 14 columnas, los dos resúmenes y A4 landscape sin firmas", () => {
    const component = readFileSync(
      resolve(process.cwd(), "src/components/forms/CajaTerminal.tsx"),
      "utf8"
    );
    const page = readFileSync(resolve(process.cwd(), "src/app/caja/page.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    const headers = [
      "#", "Fecha", "Hora", "Descripción", "Tipo", "Pago", "Importe", "Usuario",
      "Ing. Caja", "Egr. Caja", "Saldo Caja", "Ing. Banco", "Egr. Banco", "Saldo Banco",
    ];
    for (const header of headers) expect(component).toContain(`>${header}</th>`);
    expect(component).not.toContain(">Ingreso Por Acreditar</th>");
    expect(component).not.toContain(">Saldo Por Acreditar</th>");

    for (const label of [
      "Efectivo Inicial", "Efectivo Esperado", "Banco Disponible", "Por Acreditar",
      "Total Disponible", "Ingresos Caja", "Egresos Caja", "Ingresos Banco", "Egresos Banco",
    ]) expect(component).toContain(`>${label}</div>`);

    expect(css).toContain("@page caja-report { size: A4 landscape;");
    expect(css).toContain("display: table-header-group");
    expect(css).toContain("break-inside: avoid");
    expect(component).toContain('<img src="/logo.png" alt="Logo de Chopper Repuestos" className="cj-logo" />');
    expect(component).toContain("errorMessage={cierreErrorMsg}");
    expect(page).toContain("movimientosBanco={movimientosBanco}");
    expect(component).toContain("crearModeloImpresionLibroDiario(");
    expect(component).toContain("movimientosImpresionFiltrados.map");
    expect(component).toContain("const totalDisponibleResumen = resumenInferior.cajaSaldo + resumenInferior.bancoSaldo;");
    expect(component.toLowerCase()).not.toContain("firma del cajero");
    expect(component.toLowerCase()).not.toContain("firma del supervisor");
  });

  // ─── Tests para BUG 1 & BUG 2 ─────────────────────────────────────────────
  it("BUG 2 — distingue correctamente la columna PAGO para reposiciones en efectivo y banco", () => {
    // Reposición en efectivo
    const repoEfectivo = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 40_000,
        descripcion: "Reposición de stock: Bujías (10 u.)",
        impactaCaja: true,
        compraId: 101,
        compra: {
          id: 101,
          total: 40_000,
          proveedor: { id: 1, nombre: "Proveedor" },
          detalles: [],
          origenPago: "EFECTIVO_CAJA",
        },
      })
    );
    expect(repoEfectivo.pago).toBe("Efectivo");

    // Reposición por banco / transferencia
    const repoBanco = crearFilaImpresionLibroDiario(
      movimiento({
        tipo: "EGRESO",
        monto: 75_000,
        descripcion: "Reposición de stock: Cubiertas (2 u.)",
        impactaCaja: false,
        compraId: 102,
        compra: {
          id: 102,
          total: 75_000,
          proveedor: { id: 1, nombre: "Proveedor" },
          detalles: [],
          origenPago: "TRANSFERENCIA_BANCARIA",
        },
      })
    );
    expect(repoBanco.pago).toBe("Transferencia");
  });

  it("BUG 1 — filtrar por usuario preserva los saldos acumulados de las filas sin alterar el acumulado histórico", () => {
    const ventaCreditoEmpleado = movimiento({
      id: -(10 + 100_000),
      tipo: "INGRESO",
      monto: 50_000,
      descripcion: "Venta #10 · Crédito",
      fecha: new Date("2026-08-27T10:00:00-03:00"),
      usuario: { username: "empleado1", nombreCompleto: "Empleado 1" },
      ventaId: 10,
      venta: { id: 10, total: 50_000, metodoPago: "TARJETA_CREDITO" },
      esNoEfectivo: true,
      impactaCaja: false,
    });

    const movBancoAcreditacionAdmin: MovimientoFinancieroImpresion = {
      id: 99,
      tipo: "INGRESO",
      monto: 50_000,
      fecha: new Date("2026-08-27T12:00:00-03:00"),
      descripcion: "Acreditación de fondos — Venta #10",
      usuario: { username: "admin", nombreCompleto: "Administrador" },
      ventaId: 10,
      venta: null,
      compraId: null,
      compra: null,
    };

    const modeloCompleto = crearModeloImpresionLibroDiario(
      [ventaCreditoEmpleado],
      [movBancoAcreditacionAdmin],
      "2026-08-27T08:00:00-03:00",
      100_000
    );

    expect(modeloCompleto).toHaveLength(2);
    expect(modeloCompleto[0].saldoPorAcreditar).toBe(50_000);
    expect(modeloCompleto[1].saldoPorAcreditar).toBe(0);
    expect(modeloCompleto[1].saldoBanco).toBe(150_000);

    // Al filtrar por usuario "admin" (solo queda la fila de acreditación)
    const filtradoAdmin = modeloCompleto.filter((m) => m.usuario.username === "admin");
    expect(filtradoAdmin).toHaveLength(1);

    // La fila de acreditación conserva su saldo real acumulado (saldoPorAcreditar 0, saldoBanco 150.000)
    expect(filtradoAdmin[0].saldoPorAcreditar).toBe(0);
    expect(filtradoAdmin[0].saldoBanco).toBe(150_000);
  });
});
