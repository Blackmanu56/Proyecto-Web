import { describe, it, expect } from "vitest";
import {
  AJUSTE_CAJA_0001_TOKENS,
  estadoAjusteReposiciones,
  shouldCreateCajaEgreso,
  esOrigenPagoValido,
  ORIGENES_PAGO_COMPRA,
  AJUSTE_CAJA_0001_DESCRIPCIONES,
  assertCajaAjuste0001PostState,
} from "../caja-ajuste";

function estadoAplicado() {
  return {
    caja: { id: 1, montoInicial: 100000, totalVentas: -53400 },
    compras: [
      { id: 8, total: 400000, origenPago: "TRANSFERENCIA_BANCARIA" },
      { id: 9, total: 1120000, origenPago: "TRANSFERENCIA_BANCARIA" },
    ],
    movimientos: [
      {
        id: 1,
        compraId: null,
        tipo: "INGRESO",
        monto: 100000,
        descripcion: "Saldo inicial de apertura",
        fecha: new Date("2026-06-01T12:00:00.000Z"),
      },
      {
        id: 12,
        compraId: 8,
        tipo: "EGRESO",
        monto: 400000,
        descripcion: "Reposición #8",
        fecha: new Date("2026-06-01T12:00:00.000Z"),
      },
      {
        id: 13,
        compraId: 9,
        tipo: "EGRESO",
        monto: 1120000,
        descripcion: "Reposición #9",
        fecha: new Date("2026-06-01T12:00:00.000Z"),
      },
      {
        id: 20,
        compraId: null,
        tipo: "EGRESO",
        monto: 53400,
        descripcion: "Otros movimientos netos del turno",
        fecha: new Date("2026-06-01T13:00:00.000Z"),
      },
      {
        id: 79,
        compraId: null,
        tipo: "INGRESO",
        monto: 400000,
        descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion8,
        fecha: new Date("2026-08-05T12:00:00.000-03:00"),
      },
      {
        id: 80,
        compraId: null,
        tipo: "INGRESO",
        monto: 1120000,
        descripcion: AJUSTE_CAJA_0001_DESCRIPCIONES.reposicion9,
        fecha: new Date("2026-08-05T12:00:00.000-03:00"),
      },
    ],
  };
}

describe("estadoAjusteReposiciones (guard de idempotencia)", () => {
  const token8 = AJUSTE_CAJA_0001_TOKENS.reposicion8;
  const token9 = AJUSTE_CAJA_0001_TOKENS.reposicion9;

  it("devuelve 'none' si no existe ninguno de los tokens", () => {
    expect(estadoAjusteReposiciones([{ descripcion: "Reposición normal" }])).toBe("none");
    expect(estadoAjusteReposiciones([])).toBe("none");
  });

  it("devuelve 'applied' cuando AMBOS tokens existen (no duplicar)", () => {
    const movimientos = [
      { descripcion: `Ajuste histórico [${token8}]` },
      { descripcion: `Ajuste histórico [${token9}]` },
    ];
    expect(estadoAjusteReposiciones(movimientos)).toBe("applied");
  });

  it("devuelve 'partial' si solo existe UNO de los tokens (abortar sin aplicar a medias)", () => {
    expect(estadoAjusteReposiciones([{ descripcion: `Ajuste [${token8}]` }])).toBe("partial");
    expect(estadoAjusteReposiciones([{ descripcion: `Ajuste [${token9}]` }])).toBe("partial");
  });

  it("es case-insensitive y null-safe", () => {
    const movimientos = [
      { descripcion: `ajuste historico [${token8.toLowerCase()}]` },
      { descripcion: null },
      { descripcion: undefined },
    ];
    expect(estadoAjusteReposiciones(movimientos as { descripcion?: string | null }[])).toBe("partial");
    expect(estadoAjusteReposiciones(null as unknown as { descripcion?: string | null }[])).toBe("none");
  });
});

describe("shouldCreateCajaEgreso", () => {
  it("solo el efectivo de caja genera egreso de caja", () => {
    expect(shouldCreateCajaEgreso("EFECTIVO_CAJA")).toBe(true);
    expect(shouldCreateCajaEgreso("TRANSFERENCIA_BANCARIA")).toBe(false);
    expect(shouldCreateCajaEgreso("CUENTA_CORRIENTE_PROVEEDOR")).toBe(false);
    expect(shouldCreateCajaEgreso("FONDOS_EXTERNOS")).toBe(false);
  });

  it("preserva el comportamiento histórico para valores ausentes (default EFECTIVO_CAJA)", () => {
    expect(shouldCreateCajaEgreso(undefined)).toBe(true);
    expect(shouldCreateCajaEgreso(null)).toBe(true);
    expect(shouldCreateCajaEgreso("")).toBe(true);
  });
});

describe("esOrigenPagoValido", () => {
  it("acepta los 4 orígenes definidos", () => {
    for (const origen of ORIGENES_PAGO_COMPRA) {
      expect(esOrigenPagoValido(origen)).toBe(true);
    }
  });

  it("rechaza valores desconocidos, null y undefined", () => {
    expect(esOrigenPagoValido("BANCO_PERSONAL")).toBe(false);
    expect(esOrigenPagoValido("")).toBe(false);
    expect(esOrigenPagoValido(null)).toBe(false);
    expect(esOrigenPagoValido(undefined)).toBe(false);
  });
});

describe("assertCajaAjuste0001PostState", () => {
  it("locks the two approved audit descriptions exactly", () => {
    expect(AJUSTE_CAJA_0001_DESCRIPCIONES).toEqual({
      reposicion8:
        "Ajuste histórico realizado el 05/08/2026 — Reposición #8 del 01/06/2026 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0008]",
      reposicion9:
        "Ajuste histórico realizado el 05/08/2026 — Reposición #9 del 01/06/2026 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0009]",
    });
  });

  it("accepts the exact approved applied state", () => {
    expect(assertCajaAjuste0001PostState(estadoAplicado())).toEqual({
      totalVentas: -53400,
      displayedBalance: 46600,
      movementBalance: 46600,
      adjustmentMovementIds: [79, 80],
    });
  });

  it.each([
    ["missing original egress", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos = state.movimientos.filter((movimiento) => movimiento.id !== 12);
    }],
    ["wrong original amount", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.find((movimiento) => movimiento.id === 12)!.monto = 399999;
    }],
    ["wrong original compraId", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.find((movimiento) => movimiento.id === 12)!.compraId = 9;
    }],
    ["duplicate original egress", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.push({
        ...state.movimientos.find((movimiento) => movimiento.id === 12)!,
        id: 82,
      });
    }],
  ])("rejects %s", (_label, mutate) => {
    const state = estadoAplicado();
    mutate(state);
    expect(() => assertCajaAjuste0001PostState(state)).toThrow();
  });

  it.each([
    ["missing token", (state: ReturnType<typeof estadoAplicado>) => state.movimientos.pop()],
    ["partial state", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos = state.movimientos.filter((m) => m.id !== 79);
    }],
    ["duplicate token", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.push({
        ...state.movimientos.at(-2)!,
        id: 81,
        descripcion: state.movimientos.at(-2)!.descripcion.toLowerCase(),
      });
    }],
    ["wrong amount", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.at(-2)!.monto = 399999;
    }],
    ["wrong type", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.at(-2)!.tipo = "EGRESO";
    }],
    ["wrong description", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.at(-2)!.descripcion += " ";
    }],
    ["wrong date", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos.at(-2)!.fecha = new Date("2026-08-04T12:00:00.000-03:00");
    }],
    ["wrong purchase origin", (state: ReturnType<typeof estadoAplicado>) => {
      state.compras[0].origenPago = "EFECTIVO_CAJA";
    }],
    ["wrong totalVentas", (state: ReturnType<typeof estadoAplicado>) => {
      state.caja.totalVentas = -53401;
    }],
    ["wrong displayed balance", (state: ReturnType<typeof estadoAplicado>) => {
      state.caja.montoInicial = 99999;
    }],
    ["wrong movement balance", (state: ReturnType<typeof estadoAplicado>) => {
      state.movimientos[3].monto -= 1;
    }],
  ])("rejects %s", (_label, mutate) => {
    const state = estadoAplicado();
    mutate(state);
    expect(() => assertCajaAjuste0001PostState(state)).toThrow();
  });
});
