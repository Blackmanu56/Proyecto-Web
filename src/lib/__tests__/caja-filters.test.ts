import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getConcepto,
  getTipoVisual,
  getMetodoPago,
  enrichMovimientos,
  filtrarMovimientos,
  getUsuariosUnicos,
  calcularTotales,
  type MovimientoInput,
  type MovimientoEnriched,
} from "../caja-filters";

// ─── HELPERS ──────────────────────────────────────────────────

function mov(overrides: Partial<MovimientoInput> = {}): MovimientoInput {
  return {
    id: 1,
    tipo: "INGRESO",
    monto: 100,
    descripcion: "Venta #001",
    fecha: new Date("2025-07-23T10:00:00Z"),
    usuario: { username: "admin", nombreCompleto: "Admin General" },
    ...overrides,
  };
}

function enriched(overrides: Partial<MovimientoEnriched> = {}): MovimientoEnriched {
  return {
    id: 1,
    tipo: "INGRESO",
    monto: 100,
    descripcion: "Venta #001",
    fecha: new Date("2025-07-23T10:00:00Z"),
    usuario: { username: "admin", nombreCompleto: "Admin General" },
    ventaId: null,
    compraId: null,
    itemNumber: 1,
    saldoAcumulado: 100,
    saldoBanco: 0,
    ...overrides,
  };
}

// ─── getConcepto ──────────────────────────────────────────────

describe("getConcepto", () => {
  it("clasifica ventas correctamente", () => {
    expect(getConcepto(mov({ tipo: "INGRESO", descripcion: "Venta #001" }))).toBe("VENTA");
  });

  it("clasifica gastos correctamente", () => {
    expect(getConcepto(mov({ tipo: "EGRESO", descripcion: "Gasto: Artículos de limpieza" }))).toBe("GASTO");
  });

  it("clasifica reposiciones por descripción", () => {
    expect(getConcepto(mov({ tipo: "EGRESO", descripcion: "Reposición de stock" }))).toBe("REPOSICION");
  });

  it("clasifica reposiciones por compraId", () => {
    expect(getConcepto(mov({ tipo: "EGRESO", descripcion: "Compra proveedor", compraId: 42 }))).toBe("REPOSICION");
  });

  it("clasifica reposiciones por stock inicial", () => {
    expect(getConcepto(mov({ tipo: "EGRESO", descripcion: "Stock inicial proveedor" }))).toBe("REPOSICION");
  });

  it("clasifica apertura como APERTURA", () => {
    expect(getConcepto(mov({ tipo: "INGRESO", descripcion: "Saldo inicial de apertura de caja" }))).toBe("APERTURA");
  });

  it("clasifica ajuste histórico como AJUSTE, NO como reposición aunque diga 'Reposición'", () => {
    const ajuste = mov({
      tipo: "INGRESO",
      descripcion: "Ajuste histórico — Reposición #8 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0008]",
    });
    expect(getConcepto(ajuste)).toBe("AJUSTE");
  });

  it("no clasifica un ajuste histórico como VENTA", () => {
    const ajuste = mov({
      tipo: "INGRESO",
      descripcion: "Ajuste histórico — Reposición #9 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0009]",
    });
    expect(getConcepto(ajuste)).not.toBe("VENTA");
  });

  // ── Null-safety: NUNCA debe crashear ──

  it("no crashea con null", () => {
    expect(getConcepto(null as unknown as MovimientoInput)).toBe("VENTA");
  });

  it("no crashea con undefined", () => {
    expect(getConcepto(undefined as unknown as MovimientoInput)).toBe("VENTA");
  });

  it("no crashea con objeto vacío", () => {
    // Sin tipo ni descripcion → default GASTO (no VENTA)
    expect(getConcepto({})).toBe("GASTO");
  });

  it("no crashea con descripcion undefined", () => {
    expect(getConcepto(mov({ descripcion: undefined }))).toBe("VENTA");
  });

  it("no crashea con descripcion null", () => {
    expect(getConcepto(mov({ descripcion: null as unknown as string }))).toBe("VENTA");
  });

  it("no crashea con descripcion vacía", () => {
    expect(getConcepto(mov({ descripcion: "" }))).toBe("VENTA");
  });

  it("no crashea con tipo undefined", () => {
    // Sin tipo explícito → default GASTO
    expect(getConcepto(mov({ tipo: undefined }))).toBe("GASTO");
  });

  it("no crashea con usuario undefined", () => {
    expect(getConcepto(mov({ usuario: undefined }))).toBe("VENTA");
  });

  it("retorna solo valores válidos para filtro", () => {
    const valoresValidos = ["VENTA", "REPOSICION", "GASTO", "APERTURA", "AJUSTE"];
    const casos: MovimientoInput[] = [
      mov({ descripcion: "Venta #001" }),
      mov({ descripcion: "Gasto: Limpieza" }),
      mov({ descripcion: "Reposición stock" }),
      mov({ descripcion: "Stock inicial" }),
      mov({ compraId: 1 }),
      mov({ tipo: "INGRESO", descripcion: "Apertura" }),
      mov({ tipo: "INGRESO", descripcion: "Ajuste histórico — Reposición #8 [AJUSTE-CAJA-0001-REPOSICION-0008]" }),
      mov({ tipo: "EGRESO", descripcion: "Cualquier cosa" }),
      mov({ descripcion: "" }),
      mov({}),
    ];
    for (const c of casos) {
      expect(valoresValidos).toContain(getConcepto(c));
    }
  });
});

describe("CajaTerminal concept selector", () => {
  it("exposes AJUSTE as a selectable concept", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "../../components/forms/CajaTerminal.tsx"),
      "utf8"
    );

    expect(source).toContain('{ value: "AJUSTE", label: "Ajustes"');
  });
});

// ─── getTipoVisual ────────────────────────────────────────────

describe("getTipoVisual", () => {
  it("detecta apertura", () => {
    const v = getTipoVisual(mov({ descripcion: "Saldo inicial de apertura de caja" }));
    expect(v.label).toBe("APERTURA");
    expect(v.variant).toBe("info");
  });

  it("detecta cierre", () => {
    const v = getTipoVisual(mov({ descripcion: "Cierre de caja" }));
    expect(v.label).toBe("CIERRE");
  });

  it("detecta gasto", () => {
    const v = getTipoVisual(mov({ tipo: "EGRESO", descripcion: "Gasto: Limpieza" }));
    expect(v.label).toBe("GASTO");
    expect(v.variant).toBe("warning");
  });

  it("detecta reposición por descripción", () => {
    const v = getTipoVisual(mov({ tipo: "EGRESO", descripcion: "Reposición de stock" }));
    expect(v.label).toBe("REPOSICIÓN");
    expect(v.variant).toBe("warning");
  });

  it("detecta reposición por compraId", () => {
    const v = getTipoVisual(mov({ tipo: "EGRESO", descripcion: "Proveedor", compraId: 5 }));
    expect(v.label).toBe("REPOSICIÓN");
  });

  it("detecta venta", () => {
    const v = getTipoVisual(mov({ tipo: "INGRESO", descripcion: "Venta #001" }));
    expect(v.label).toBe("VENTA");
    expect(v.variant).toBe("success");
  });

  it("clasifica un ajuste histórico como AJUSTE y NO como REPOSICIÓN aunque diga 'Reposición'", () => {
    const v = getTipoVisual(mov({
      tipo: "INGRESO",
      descripcion: "Ajuste histórico — Reposición #8 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0008]",
    }));
    expect(v.label).toBe("AJUSTE");
    expect(v.variant).toBe("default");
  });

  it("no clasifica un ajuste histórico como VENTA", () => {
    const v = getTipoVisual(mov({
      tipo: "INGRESO",
      descripcion: "Ajuste histórico — Reposición #9 pagada mediante transferencia bancaria [AJUSTE-CAJA-0001-REPOSICION-0009]",
    }));
    expect(v.label).not.toBe("VENTA");
    expect(v.label).not.toBe("REPOSICIÓN");
  });

  it("no crashea con null", () => {
    expect(getTipoVisual(null as unknown as MovimientoInput)).toEqual({ label: "MOVIMIENTO", variant: "default" });
  });

  it("no crashea con undefined", () => {
    expect(getTipoVisual(undefined as unknown as MovimientoInput)).toEqual({ label: "MOVIMIENTO", variant: "default" });
  });

  it("no crashea con descripcion undefined", () => {
    const v = getTipoVisual(mov({ descripcion: undefined }));
    expect(v.variant).toBeDefined();
  });

  it("no crashea con objeto vacío", () => {
    const v = getTipoVisual({});
    expect(v.label).toBeDefined();
    expect(v.variant).toBeDefined();
  });
});

// ─── enrichMovimientos ────────────────────────────────────────

describe("enrichMovimientos", () => {
  it("retorna [] con null", () => {
    expect(enrichMovimientos(null)).toEqual([]);
  });

  it("retorna [] con undefined", () => {
    expect(enrichMovimientos(undefined)).toEqual([]);
  });

  it("retorna [] con array vacío", () => {
    expect(enrichMovimientos([])).toEqual([]);
  });

  it("retorna [] con no-array", () => {
    expect(enrichMovimientos("not an array" as unknown as MovimientoInput[])).toEqual([]);
  });

  it("ordena por fecha ascendente", () => {
    const result = enrichMovimientos([
      mov({ id: 2, fecha: new Date("2025-07-23T12:00:00Z") }),
      mov({ id: 1, fecha: new Date("2025-07-23T10:00:00Z") }),
    ]);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("calcula saldo acumulado correctamente", () => {
    const result = enrichMovimientos([
      mov({ tipo: "INGRESO", monto: 1000, fecha: new Date("2025-07-23T10:00:00Z") }),
      mov({ tipo: "EGRESO", monto: 200, fecha: new Date("2025-07-23T11:00:00Z") }),
      mov({ tipo: "INGRESO", monto: 500, fecha: new Date("2025-07-23T12:00:00Z") }),
    ]);
    expect(result[0].saldoAcumulado).toBe(1000);
    expect(result[1].saldoAcumulado).toBe(800);
    expect(result[2].saldoAcumulado).toBe(1300);
  });

  it("asigna itemNumber secuencial", () => {
    const result = enrichMovimientos([mov({ id: 1 }), mov({ id: 2 }), mov({ id: 3 })]);
    expect(result.map((m) => m.itemNumber)).toEqual([1, 2, 3]);
  });

  it("filtra movimientos sin descripcion", () => {
    const result = enrichMovimientos([
      mov({ descripcion: "OK" }),
      mov({ descripcion: undefined }),
      mov({ descripcion: "También OK" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("maneja movimientos con monto undefined", () => {
    const result = enrichMovimientos([mov({ monto: undefined })]);
    expect(result[0].monto).toBe(0);
  });
});

// ─── filtrarMovimientos ───────────────────────────────────────

describe("filtrarMovimientos", () => {
  const base: MovimientoEnriched[] = [
    enriched({ id: 1, tipo: "INGRESO", descripcion: "Venta #001", monto: 1000, usuario: { username: "admin", nombreCompleto: "Admin" } }),
    enriched({ id: 2, tipo: "INGRESO", descripcion: "Venta #002", monto: 500, usuario: { username: "juan", nombreCompleto: "Juan Pérez" } }),
    enriched({ id: 3, tipo: "EGRESO", descripcion: "Gasto: Limpieza", monto: 100, usuario: { username: "admin", nombreCompleto: "Admin" } }),
    enriched({ id: 4, tipo: "EGRESO", descripcion: "Reposición de stock", monto: 300, usuario: { username: "admin", nombreCompleto: "Admin" }, compraId: 10 }),
    enriched({ id: 5, tipo: "INGRESO", descripcion: "Saldo inicial de apertura de caja", monto: 5000, usuario: { username: "admin", nombreCompleto: "Admin" } }),
  ];

  const empty: MovimientoEnriched[] = [];
  const noFiltros = { naturaleza: "", concepto: "", usuario: "", busqueda: "" };

  // ── Sin filtros ──

  it("retorna todos con filtros vacíos", () => {
    expect(filtrarMovimientos(base, noFiltros)).toHaveLength(5);
  });

  it("retorna [] con array vacío", () => {
    expect(filtrarMovimientos(empty, noFiltros)).toEqual([]);
  });

  it("retorna [] con null", () => {
    expect(filtrarMovimientos(null as unknown as MovimientoEnriched[], noFiltros)).toEqual([]);
  });

  it("retorna todos con null filtros", () => {
    expect(filtrarMovimientos(base, null as unknown as Parameters<typeof filtrarMovimientos>[1])).toHaveLength(5);
  });

  // ── Naturaleza ──

  it("filtra por Ingresos", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "INGRESO" });
    expect(result).toHaveLength(3);
    expect(result.every((m) => m.tipo === "INGRESO")).toBe(true);
  });

  it("filtra por Egresos", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "EGRESO" });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.tipo === "EGRESO")).toBe(true);
  });

  // ── Concepto ──

  it("filtra por Venta", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, concepto: "VENTA" });
    expect(result).toHaveLength(2); // Venta #001, Venta #002
    expect(result.every((m) => m.descripcion.includes("Venta"))).toBe(true);
  });

  it("filtra por Gasto", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, concepto: "GASTO" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((m) => {
      expect(getConcepto(m)).toBe("GASTO");
    });
  });

  it("filtra por Reposición", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, concepto: "REPOSICION" });
    expect(result).toHaveLength(1);
    expect(result[0].descripcion).toContain("Reposición");
  });

  it("filtra por Apertura", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, concepto: "APERTURA" });
    expect(result).toHaveLength(1);
    expect(result[0].descripcion).toContain("apertura");
  });

  it("NO muestra aperturas al filtrar por Venta", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, concepto: "VENTA" });
    expect(result.every((m) => getConcepto(m) !== "APERTURA")).toBe(true);
  });

  // ── Usuario ──

  it("filtra por usuario", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, usuario: "juan" });
    expect(result).toHaveLength(1);
    expect(result[0].usuario.username).toBe("juan");
  });

  it("filtra por usuario admin", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, usuario: "admin" });
    expect(result).toHaveLength(4); // todos menos juan
  });

  // ── Búsqueda ──

  it("busca por descripción", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, busqueda: "Venta" });
    expect(result).toHaveLength(2);
  });

  it("busca por username", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, busqueda: "juan" });
    expect(result).toHaveLength(1);
  });

  it("busca por nombre completo", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, busqueda: "Juan Pérez" });
    expect(result).toHaveLength(1);
  });

  it("busca por ID", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, busqueda: "3" });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("retorna vacío si la búsqueda no matchea nada", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, busqueda: "xyz123nonexistent" });
    expect(result).toHaveLength(0);
  });

  // ── Combinaciones ──

  it("Naturaleza INGRESO + Concepto VENTA", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "INGRESO", concepto: "VENTA" });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.tipo === "INGRESO")).toBe(true);
  });

  it("Naturaleza EGRESO + Concepto REPOSICION", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "EGRESO", concepto: "REPOSICION" });
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe("EGRESO");
    expect(getConcepto(result[0])).toBe("REPOSICION");
  });

  it("Naturaleza EGRESO + Concepto GASTO + Usuario admin", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "EGRESO", concepto: "GASTO", usuario: "admin" });
    expect(result).toHaveLength(1);
    expect(result[0].descripcion).toContain("Gasto");
  });

  it("todos los filtros juntos que no matchean → vacío", () => {
    // INGRESO + REPOSICION no combinan (no hay ingreso que sea reposición)
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "INGRESO", concepto: "REPOSICION" });
    expect(result).toHaveLength(0);
  });

  it("filtros combinados con búsqueda", () => {
    const result = filtrarMovimientos(base, { ...noFiltros, naturaleza: "INGRESO", busqueda: "002" });
    expect(result).toHaveLength(1);
    expect(result[0].descripcion).toContain("002");
  });

  // ── Limpiar filtros equivale a todo vacío ──

  it("limpiar filtros retorna todos", () => {
    const filtrado = filtrarMovimientos(base, { naturaleza: "EGRESO", concepto: "GASTO", usuario: "admin", busqueda: "x" });
    expect(filtrado.length).toBeLessThan(base.length);
    const limpio = filtrarMovimientos(base, noFiltros);
    expect(limpio).toHaveLength(base.length);
  });
});

// ─── getUsuariosUnicos ────────────────────────────────────────

describe("getUsuariosUnicos", () => {
  it("retorna [] con null", () => {
    expect(getUsuariosUnicos(null as unknown as MovimientoEnriched[])).toEqual([]);
  });

  it("retorna [] con array vacío", () => {
    expect(getUsuariosUnicos([])).toEqual([]);
  });

  it("retorna usuarios únicos ordenados por nombre", () => {
    const result = getUsuariosUnicos([
      enriched({ usuario: { username: "juan", nombreCompleto: "Juan" } }),
      enriched({ usuario: { username: "admin", nombreCompleto: "Admin" } }),
      enriched({ usuario: { username: "juan", nombreCompleto: "Juan" } }), // duplicado
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe("admin"); // alfabético
    expect(result[1].username).toBe("juan");
  });

  it("usa username como fallback si no hay nombreCompleto", () => {
    const result = getUsuariosUnicos([
      enriched({ usuario: { username: "sin_nombre" } }),
    ]);
    expect(result[0].nombreCompleto).toBe("sin_nombre");
  });

  it("ignora movimientos sin usuario", () => {
    const result = getUsuariosUnicos([
      enriched({ usuario: undefined }),
      enriched({ usuario: { username: "admin" } }),
    ]);
    expect(result).toHaveLength(1);
  });
});

// ─── calcularTotales ──────────────────────────────────────────

describe("calcularTotales", () => {
  it("retorna ceros con null", () => {
    expect(calcularTotales(null as unknown as MovimientoEnriched[])).toEqual({ totalIngresos: 0, totalEgresos: 0, saldoFinal: 0 });
  });

  it("retorna ceros con array vacío", () => {
    expect(calcularTotales([])).toEqual({ totalIngresos: 0, totalEgresos: 0, saldoFinal: 0 });
  });

  it("calcula totales correctamente", () => {
    const result = calcularTotales([
      enriched({ tipo: "INGRESO", monto: 1000 }),
      enriched({ tipo: "INGRESO", monto: 500 }),
      enriched({ tipo: "EGRESO", monto: 200 }),
    ]);
    expect(result.totalIngresos).toBe(1500);
    expect(result.totalEgresos).toBe(200);
    expect(result.saldoFinal).toBe(1300);
  });

  it("saldo negativo cuando egresos > ingresos", () => {
    const result = calcularTotales([
      enriched({ tipo: "INGRESO", monto: 100 }),
      enriched({ tipo: "EGRESO", monto: 500 }),
    ]);
    expect(result.saldoFinal).toBe(-400);
  });
});

// ─── ESCENARIOS REALES (crash repro) ──────────────────────────

describe("Escenarios de crash previos", () => {
  it("caja vacía + filtro VENTA no crashea", () => {
    const result = filtrarMovimientos([], { naturaleza: "", concepto: "VENTA", usuario: "", busqueda: "" });
    expect(result).toEqual([]);
  });

  it("caja vacía + filtro GASTO no crashea", () => {
    const result = filtrarMovimientos([], { naturaleza: "", concepto: "GASTO", usuario: "", busqueda: "" });
    expect(result).toEqual([]);
  });

  it("caja vacía + filtro REPOSICION no crashea", () => {
    const result = filtrarMovimientos([], { naturaleza: "", concepto: "REPOSICION", usuario: "", busqueda: "" });
    expect(result).toEqual([]);
  });

  it("caja vacía + filtro EGRESO no crashea", () => {
    const result = filtrarMovimientos([], { naturaleza: "EGRESO", concepto: "", usuario: "", busqueda: "" });
    expect(result).toEqual([]);
  });

  it("caja vacía + filtro INGRESO no crashea", () => {
    const result = filtrarMovimientos([], { naturaleza: "INGRESO", concepto: "", usuario: "", busqueda: "" });
    expect(result).toEqual([]);
  });

  it("movimientos con usuario null + filtro concepto no crashea", () => {
    const data: MovimientoEnriched[] = [
      enriched({ usuario: { username: "test" }, tipo: "EGRESO", descripcion: "Gasto: test" }),
    ];
    const result = filtrarMovimientos(data, { naturaleza: "", concepto: "GASTO", usuario: "", busqueda: "" });
    expect(result).toHaveLength(1);
  });

  it("movimientos con campos undefined no crashea", () => {
    const data: MovimientoEnriched[] = [
      enriched({ descripcion: "", tipo: "INGRESO", monto: 0 }),
    ];
    const result = filtrarMovimientos(data, { naturaleza: "", concepto: "VENTA", usuario: "", busqueda: "" });
    expect(result).toHaveLength(1);
  });

  it("múltiples filtros activos con 0 resultados no crashea", () => {
    const data: MovimientoEnriched[] = [
      enriched({ tipo: "INGRESO", descripcion: "Venta", usuario: { username: "admin" } }),
    ];
    const result = filtrarMovimientos(data, {
      naturaleza: "EGRESO",
      concepto: "GASTO",
      usuario: "otro",
      busqueda: "xyz",
    });
    expect(result).toHaveLength(0);
  });

  // ─── getMetodoPago & filtro Método de Pago ───────────────────
  describe("getMetodoPago y filtro Método de Pago", () => {
    it("identifica EFECTIVO para ventas en efectivo y gastos de caja", () => {
      expect(getMetodoPago(mov({ venta: { id: 1, total: 100, metodoPago: "EFECTIVO" } }))).toBe("EFECTIVO");
      expect(getMetodoPago(mov({ descripcion: "Gasto: Limpieza", impactaCaja: true }))).toBe("EFECTIVO");
    });

    it("identifica BANCO para transferencias, tarjetas y reposiciones por banco", () => {
      expect(getMetodoPago(mov({ venta: { id: 2, total: 200, metodoPago: "TRANSFERENCIA" } }))).toBe("BANCO");
      expect(getMetodoPago(mov({ venta: { id: 3, total: 300, metodoPago: "TARJETA_CREDITO" } }))).toBe("BANCO");
      expect(getMetodoPago(mov({ compra: { id: 1, total: 500, proveedor: { id: 1, nombre: "P" }, detalles: [], origenPago: "TRANSFERENCIA_BANCARIA" } }))).toBe("BANCO");
    });

    it("filtra correctamente por metodoPago: EFECTIVO vs BANCO", () => {
      const movimientos: MovimientoEnriched[] = [
        enriched({ id: 1, venta: { id: 1, total: 100, metodoPago: "EFECTIVO" } }),
        enriched({ id: 2, venta: { id: 2, total: 200, metodoPago: "TRANSFERENCIA" }, esNoEfectivo: true, impactaCaja: false }),
        enriched({ id: 3, descripcion: "Gasto: Caja", impactaCaja: true }),
      ];

      const soloEfectivo = filtrarMovimientos(movimientos, {
        metodoPago: "EFECTIVO",
        concepto: "",
        usuario: "",
        busqueda: "",
      });
      expect(soloEfectivo).toHaveLength(2);
      expect(soloEfectivo.map((m) => m.id)).toEqual([1, 3]);

      const soloBanco = filtrarMovimientos(movimientos, {
        metodoPago: "BANCO",
        concepto: "",
        usuario: "",
        busqueda: "",
      });
      expect(soloBanco).toHaveLength(1);
      expect(soloBanco[0].id).toBe(2);
    });
  });
});
