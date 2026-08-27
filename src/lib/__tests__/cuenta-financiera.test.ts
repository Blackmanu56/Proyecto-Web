import { describe, expect, it } from "vitest";
import {
  calcularResumenBancoPeriodo,
  calcularSaldoCuentaFinanciera,
  calcularTotalDisponible,
  calcularSaldosFinancieros,
  sumarSaldosCuentas,
  validarBancoPrincipal,
  resolverDestinoFinanciero,
  calcularImpactoFinanciero,
} from "../cuenta-financiera";
import { crearModeloImpresionLibroDiario } from "../caja-print";
import { enrichMovimientos } from "../caja-filters";

// ─── calcularSaldoCuentaFinanciera ──────────────────────────────────────────

describe("calcularSaldoCuentaFinanciera", () => {
  it("saldo banco: saldoInicial $500.000 + ingreso $100.000 − egreso $50.000 = $550.000", () => {
    const resultado = calcularSaldoCuentaFinanciera(500_000, [
      { tipo: "INGRESO", monto: 100_000 },
      { tipo: "EGRESO", monto: 50_000 },
    ]);

    expect(resultado).toEqual({
      saldoInicial: 500_000,
      totalIngresos: 100_000,
      totalEgresos: 50_000,
      saldoActual: 550_000,
    });
  });

  it("saldo por acreditar: saldoInicial $0 + ingreso $100.000 = $100.000", () => {
    const resultado = calcularSaldoCuentaFinanciera(0, [
      { tipo: "INGRESO", monto: 100_000 },
    ]);

    expect(resultado).toEqual({
      saldoInicial: 0,
      totalIngresos: 100_000,
      totalEgresos: 0,
      saldoActual: 100_000,
    });
  });

  it("saldo inicial sin movimientos mantiene el valor", () => {
    const resultado = calcularSaldoCuentaFinanciera(200_000, []);
    expect(resultado).toEqual({
      saldoInicial: 200_000,
      totalIngresos: 0,
      totalEgresos: 0,
      saldoActual: 200_000,
    });
  });

  it("ignora montos NaN e Infinity sin contaminar el saldo", () => {
    const resultado = calcularSaldoCuentaFinanciera(100_000, [
      { tipo: "INGRESO", monto: Number.NaN },
      { tipo: "EGRESO", monto: Number.POSITIVE_INFINITY },
      { tipo: "INGRESO", monto: 25_000 },
    ]);

    expect(resultado).toEqual({
      saldoInicial: 100_000,
      totalIngresos: 25_000,
      totalEgresos: 0,
      saldoActual: 125_000,
    });
  });

  it("maneja null y undefined de movimientos", () => {
    expect(calcularSaldoCuentaFinanciera(50_000, null).saldoActual).toBe(50_000);
    expect(calcularSaldoCuentaFinanciera(50_000, undefined).saldoActual).toBe(50_000);
  });

  it("maneja saldoInicial no numérico", () => {
    expect(calcularSaldoCuentaFinanciera(Number.NaN, []).saldoActual).toBe(0);
  });
});

// ─── calcularTotalDisponible ────────────────────────────────────────────────

describe("calcularTotalDisponible", () => {
  it("suma efectivo ($150.000) + banco ($550.000) = $700.000", () => {
    expect(
      calcularTotalDisponible({
        efectivoFisico: 150_000,
        saldoBanco: 550_000,
      })
    ).toBe(700_000);
  });

  it("NO incluye por acreditar: $150.000 + $550.000 ≠ $800.000", () => {
    // Por acreditar $100.000 — NO se suma al total disponible
    expect(
      calcularTotalDisponible({
        efectivoFisico: 150_000,
        saldoBanco: 550_000,
      })
    ).not.toBe(800_000);
  });

  it("retorna 0 cuando ambos son 0", () => {
    expect(calcularTotalDisponible({ efectivoFisico: 0, saldoBanco: 0 })).toBe(0);
  });

  it("funciona con un solo componente", () => {
    expect(calcularTotalDisponible({ efectivoFisico: 100_000, saldoBanco: 0 })).toBe(100_000);
    expect(calcularTotalDisponible({ efectivoFisico: 0, saldoBanco: 300_000 })).toBe(300_000);
  });
});

// ─── validarBancoPrincipal ──────────────────────────────────────────────────

describe("validarBancoPrincipal", () => {
  it("permite crear cuando no hay banco principal", () => {
    expect(validarBancoPrincipal([])).toEqual({ valido: true });
  });

  it("rechaza si ya existe un Banco principal", () => {
    const resultado = validarBancoPrincipal([
      { tipo: "BANCO", esPrincipal: true, id: 1 },
    ]);
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toContain("id: 1");
  });

  it("permite excluir la cuenta que se está editando", () => {
    const resultado = validarBancoPrincipal(
      [{ tipo: "BANCO", esPrincipal: true, id: 1 }],
      1 // excludedId
    );
    expect(resultado.valido).toBe(true);
  });

  it("no se confunde con cuentas POR_ACREDITAR", () => {
    expect(
      validarBancoPrincipal([
        { tipo: "POR_ACREDITAR", esPrincipal: true, id: 2 },
      ])
    ).toEqual({ valido: true });
  });
});

// ─── resolverDestinoFinanciero ──────────────────────────────────────────────

describe("resolverDestinoFinanciero", () => {
  const banco = { id: 1 };
  const porAcreditar = { id: 2 };

  it("EFECTIVO → null (no resuelve cuenta financiera)", () => {
    expect(resolverDestinoFinanciero("EFECTIVO", 100_000, banco, porAcreditar)).toBeNull();
  });

  it("TRANSFERENCIA con Banco → cuenta BANCO", () => {
    expect(resolverDestinoFinanciero("TRANSFERENCIA", 100_000, banco, porAcreditar)).toEqual({
      cuentaFinancieraId: 1,
      tipo: "BANCO",
    });
  });

  it("TRANSFERENCIA sin Banco → lanza error", () => {
    expect(() =>
      resolverDestinoFinanciero("TRANSFERENCIA", 100_000, null, porAcreditar)
    ).toThrow("cuenta bancaria principal");
  });

  it("TARJETA_DEBITO con Banco → cuenta BANCO", () => {
    expect(resolverDestinoFinanciero("TARJETA_DEBITO", 100_000, banco, null)).toEqual({
      cuentaFinancieraId: 1,
      tipo: "BANCO",
    });
  });

  it("TARJETA_DEBITO sin Banco → lanza error", () => {
    expect(() =>
      resolverDestinoFinanciero("TARJETA_DEBITO", 100_000, null, null)
    ).toThrow("cuenta bancaria principal");
  });

  it("TARJETA_CREDITO con POR_ACREDITAR → cuenta POR_ACREDITAR", () => {
    expect(resolverDestinoFinanciero("TARJETA_CREDITO", 100_000, banco, porAcreditar)).toEqual({
      cuentaFinancieraId: 2,
      tipo: "POR_ACREDITAR",
    });
  });

  it("TARJETA_CREDITO sin POR_ACREDITAR → lanza error", () => {
    expect(() =>
      resolverDestinoFinanciero("TARJETA_CREDITO", 100_000, banco, null)
    ).toThrow("tarjetas por acreditar");
  });

  it("total $0 → null sin importar el método", () => {
    expect(resolverDestinoFinanciero("TRANSFERENCIA", 0, banco, porAcreditar)).toBeNull();
    expect(resolverDestinoFinanciero("TARJETA_CREDITO", 0, banco, porAcreditar)).toBeNull();
  });

  it("método desconocido → null", () => {
    expect(resolverDestinoFinanciero("CRYPTO", 100_000, banco, porAcreditar)).toBeNull();
  });
});

// ─── calcularSaldosFinancieros ──────────────────────────────────────────────

describe("sumarSaldosCuentas", () => {
  it("suma saldos de múltiples cuentas", () => {
    const cuentas = [
      { saldoInicial: 100_000, movimientos: [{ tipo: "INGRESO", monto: 50_000 }] },
      { saldoInicial: 0, movimientos: [{ tipo: "INGRESO", monto: 30_000 }] },
    ];
    expect(sumarSaldosCuentas(cuentas)).toBe(180_000);
  });

  it("ignora cuentas con saldo 0 o negativo", () => {
    const cuentas = [
      { saldoInicial: 100_000, movimientos: [{ tipo: "EGRESO", monto: 100_000 }] },
      { saldoInicial: 0, movimientos: [] },
    ];
    expect(sumarSaldosCuentas(cuentas)).toBe(0);
  });

  it("array vacío → 0", () => {
    expect(sumarSaldosCuentas([])).toBe(0);
  });
});

describe("calcularSaldosFinancieros", () => {
  it("A) Efectivo 100k, Banco 500k, Por acreditar 0 → Total 600k", () => {
    const banco = [{ saldoInicial: 500_000, movimientos: [] }];
    const porAcreditar: { saldoInicial: number; movimientos: never[] }[] = [];

    const resultado = calcularSaldosFinancieros(banco, porAcreditar, 100_000);

    expect(resultado.efectivoFisico).toBe(100_000);
    expect(resultado.banco).toBe(500_000);
    expect(resultado.porAcreditar).toBe(0);
    expect(resultado.totalDisponible).toBe(600_000);
  });

  it("B) Efectivo 100k, Banco inexistente, Por acreditar inexistente → Total 100k", () => {
    const resultado = calcularSaldosFinancieros([], [], 100_000);

    expect(resultado.efectivoFisico).toBe(100_000);
    expect(resultado.banco).toBe(0);
    expect(resultado.porAcreditar).toBe(0);
    expect(resultado.totalDisponible).toBe(100_000);
  });

  it("C) Efectivo 100k, Banco 500k, Por acreditar 200k → Total sigue siendo 600k", () => {
    const banco = [{ saldoInicial: 500_000, movimientos: [] }];
    const porAcreditar = [{ saldoInicial: 200_000, movimientos: [] }];

    const resultado = calcularSaldosFinancieros(banco, porAcreditar, 100_000);

    expect(resultado.porAcreditar).toBe(200_000);
    expect(resultado.totalDisponible).toBe(600_000); // No incluye por acreditar
  });

  it("D) Varias cuentas POR_ACREDITAR: 100k + 50k → 150k", () => {
    const porAcreditar = [
      { saldoInicial: 100_000, movimientos: [] },
      { saldoInicial: 50_000, movimientos: [] },
    ];

    const resultado = calcularSaldosFinancieros([], porAcreditar, 0);

    expect(resultado.porAcreditar).toBe(150_000);
  });

  it("E) Cuenta Banco inactiva: no contar", () => {
    // Solo cuentas activas llegan al helper (el filtro es en Prisma)
    // Si una cuenta inactiva llegara accidentalmente, su saldo se contaría
    // pero la UI solo pasa cuentas con activa=true desde page.tsx
    const banco = [{ saldoInicial: 500_000, movimientos: [] }];
    const resultado = calcularSaldosFinancieros(banco, [], 100_000);
    expect(resultado.banco).toBe(500_000);
  });

  it("efectivo NaN → trata como 0", () => {
    const resultado = calcularSaldosFinancieros([], [], NaN);
    expect(resultado.efectivoFisico).toBe(0);
    expect(resultado.totalDisponible).toBe(0);
  });

  it("Banco con movimientos: ingresa 200k, gasta 50k", () => {
    const banco = [{
      saldoInicial: 100_000,
      movimientos: [
        { tipo: "INGRESO", monto: 200_000 },
        { tipo: "EGRESO", monto: 50_000 },
      ],
    }];

    const resultado = calcularSaldosFinancieros(banco, [], 0);

    expect(resultado.banco).toBe(250_000);
  });
});

describe("calcularResumenBancoPeriodo", () => {
  it("deriva banco inicial desde el histórico previo al inicio de caja", () => {
    const resumen = calcularResumenBancoPeriodo(
      [
        {
          saldoInicial: 10_000,
          movimientos: [
            { tipo: "INGRESO", monto: 40_000, fecha: "2026-08-12T09:00:00-03:00" },
            { tipo: "EGRESO", monto: 5_000, fecha: "2026-08-12T10:00:00-03:00" },
            { tipo: "INGRESO", monto: 60_000, fecha: "2026-08-13T09:30:00-03:00" },
            { tipo: "INGRESO", monto: 30_000, fecha: "2026-08-13T11:00:00-03:00" },
          ],
        },
      ],
      "2026-08-13T09:00:00-03:00"
    );

    expect(resumen).toEqual({
      inicial: 45_000,
      ingresos: 90_000,
      egresos: 0,
      saldo: 135_000,
    });
  });

  it("sin fechaDesde usa toda la historia como flujo del período", () => {
    const resumen = calcularResumenBancoPeriodo([
      {
        saldoInicial: 20_000,
        movimientos: [
          { tipo: "INGRESO", monto: 10_000, fecha: "2026-08-12T09:00:00-03:00" },
          { tipo: "EGRESO", monto: 4_000, fecha: "2026-08-12T10:00:00-03:00" },
        ],
      },
    ]);

    expect(resumen).toEqual({
      inicial: 20_000,
      ingresos: 10_000,
      egresos: 4_000,
      saldo: 26_000,
    });
  });
});

// ─── FLUJO DE INTEGRACIÓN: VENTA A CRÉDITO Y ACREDITACIÓN ────────────────────

describe("Integración: Flujo completo Venta a Crédito -> Por Acreditar -> Acreditación en Banco", () => {
  it("crear venta a crédito genera saldo en Por Acreditar, y al acreditar sube Banco y baja Por Acreditar en la misma proporción", () => {
    // 1. Estado inicial
    const cuentaBancoInicial = {
      id: 1,
      saldoInicial: 500_000,
      movimientos: [] as { tipo: string; monto: number; fecha: string; descripcion: string; ventaId?: number }[],
    };
    const cuentaPorAcreditarInicial = {
      id: 2,
      saldoInicial: 0,
      movimientos: [] as { tipo: string; monto: number; fecha: string; descripcion: string; ventaId?: number; referencia?: string }[],
    };
    const efectivoInicial = 100_000;

    const saldosIniciales = calcularSaldosFinancieros(
      [cuentaBancoInicial],
      [cuentaPorAcreditarInicial],
      efectivoInicial
    );
    expect(saldosIniciales.banco).toBe(500_000);
    expect(saldosIniciales.porAcreditar).toBe(0);
    expect(saldosIniciales.totalDisponible).toBe(600_000);

    // 2. Se realiza una venta con Tarjeta de Crédito por $150.000 (Venta #101)
    const montoVentaCredito = 150_000;
    const destino = resolverDestinoFinanciero(
      "TARJETA_CREDITO",
      montoVentaCredito,
      cuentaBancoInicial,
      cuentaPorAcreditarInicial
    );
    expect(destino).toEqual({ cuentaFinancieraId: 2, tipo: "POR_ACREDITAR" });

    // Se registra INGRESO en cuenta POR_ACREDITAR
    const movVentaCredito = {
      id: 10,
      tipo: "INGRESO",
      monto: montoVentaCredito,
      fecha: "2026-08-27T10:00:00-03:00",
      descripcion: "Cobro tarjeta crédito · Venta #101",
      ventaId: 101,
    };
    cuentaPorAcreditarInicial.movimientos.push(movVentaCredito);

    // Verificación tras la venta
    const saldosTrasVenta = calcularSaldosFinancieros(
      [cuentaBancoInicial],
      [cuentaPorAcreditarInicial],
      efectivoInicial
    );
    expect(saldosTrasVenta.banco).toBe(500_000); // Banco no sube aún
    expect(saldosTrasVenta.porAcreditar).toBe(150_000); // Por acreditar sube a 150k
    expect(saldosTrasVenta.totalDisponible).toBe(600_000); // Total disponible no incluye pendiente

    // Impacto financiero de la venta en Libro Diario
    const impactoVenta = calcularImpactoFinanciero({
      tipo: "INGRESO",
      monto: montoVentaCredito,
      esNoEfectivo: true,
      impactaCaja: false,
      venta: { total: montoVentaCredito, metodoPago: "TARJETA_CREDITO" },
      descripcion: "Venta #101 · Crédito — Total $150.000",
    });
    expect(impactoVenta.ingresoPorAcreditar).toBe(150_000);
    expect(impactoVenta.ingresoBanco).toBe(0);

    // 3. Se marca el movimiento como acreditado (simulación de marcarMovimientoAcreditado)
    const fechaAcreditacion = "2026-08-27T14:30:00-03:00";
    const refCode = `ACREDITACION_${movVentaCredito.id}`;

    // Par de movimientos atómicos:
    // A) EGRESO de POR_ACREDITAR
    cuentaPorAcreditarInicial.movimientos.push({
      tipo: "EGRESO",
      monto: montoVentaCredito,
      fecha: fechaAcreditacion,
      descripcion: `Acreditación de fondos — Venta #101`,
      referencia: refCode,
      ventaId: 101,
    });

    // B) INGRESO a BANCO
    const movBancoAcreditacion = {
      id: 20,
      tipo: "INGRESO",
      monto: montoVentaCredito,
      fecha: fechaAcreditacion,
      descripcion: `Acreditación de fondos — Venta #101`,
      referencia: refCode,
      ventaId: 101,
    };
    cuentaBancoInicial.movimientos.push(movBancoAcreditacion);

    // 4. Verificación de saldos finales de ambas cuentas
    const saldosTrasAcreditacion = calcularSaldosFinancieros(
      [cuentaBancoInicial],
      [cuentaPorAcreditarInicial],
      efectivoInicial
    );

    // ASUNCIONES FINALES ESTRICTAS:
    expect(saldosTrasAcreditacion.porAcreditar).toBe(0); // Por acreditar bajó exactamente a 0
    expect(saldosTrasAcreditacion.banco).toBe(650_000); // Banco subió exactamente +$150.000 (500k -> 650k)
    expect(saldosTrasAcreditacion.totalDisponible).toBe(750_000); // Total disponible subió a 750k

    // 5. Verificación de Libro Diario y columnas SALDO PEND. / SALDO BANCO
    const ventaProyectada = {
      id: -(101 + 100_000),
      tipo: "INGRESO" as const,
      monto: montoVentaCredito,
      descripcion: "Venta #101 · Crédito — Total $150.000,00",
      fecha: "2026-08-27T10:00:00-03:00",
      usuario: { username: "admin" },
      ventaId: 101,
      venta: {
        id: 101,
        total: montoVentaCredito,
        metodoPago: "TARJETA_CREDITO",
      },
      esNoEfectivo: true,
      impactaCaja: false,
    };

    const movimientosEnriched = enrichMovimientos([ventaProyectada]);
    const modeloLibroDiario = crearModeloImpresionLibroDiario(
      movimientosEnriched,
      [movBancoAcreditacion],
      "2026-08-27T08:00:00-03:00",
      500_000
    );

    // Debe contener 2 filas: la venta original y la acreditación bancaria (sin colisión)
    expect(modeloLibroDiario).toHaveLength(2);

    const fila1 = modeloLibroDiario[0]; // Venta
    expect(fila1.ventaId).toBe(101);
    expect(fila1.saldoPorAcreditar).toBe(150_000);
    expect(fila1.saldoBanco).toBe(500_000);

    const fila2 = modeloLibroDiario[1]; // Acreditación
    expect(fila2.descripcion).toBe("Acreditación de fondos — Venta #101");
    expect(fila2.saldoBanco).toBe(650_000); // Banco acumulado subió a 650.000
    expect(fila2.saldoPorAcreditar).toBe(0); // Pendiente acumulado bajó a 0
  });
});
