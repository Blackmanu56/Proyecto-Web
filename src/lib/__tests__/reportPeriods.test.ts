import { describe, it, expect } from "vitest";
import {
  formatLocalDate,
  formatLocalDateTimeStart,
  getCierresDateRange,
  toApiDate,
} from "../reportPeriods";

// Convención F1: las strings que cruzan el límite servidor son datetime local
// completo sin Z ("2026-08-01T00:00:00"). Todas las bases usan constructores
// locales (new Date(2026, 7, 1, ...)) para que las aserciones sean
// independientes de la zona horaria de la máquina que corre los tests.

// ─── formatLocalDate ──────────────────────────────────────────────

describe("formatLocalDate", () => {
  it("formatea yyyy-MM-dd con padding", () => {
    expect(formatLocalDate(new Date(2026, 7, 1))).toBe("2026-08-01");
  });

  it("formatea día de un dígito con cero a la izquierda", () => {
    expect(formatLocalDate(new Date(2026, 11, 5))).toBe("2026-12-05");
  });

  it("formatea enero correctamente", () => {
    expect(formatLocalDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

// ─── formatLocalDateTimeStart ─────────────────────────────────────

describe("formatLocalDateTimeStart", () => {
  it("emite datetime local completo sin Z, descartando la hora", () => {
    expect(formatLocalDateTimeStart(new Date(2026, 7, 1, 23, 30))).toBe("2026-08-01T00:00:00");
  });

  it("emite la misma forma para medianoche local", () => {
    expect(formatLocalDateTimeStart(new Date(2026, 7, 1))).toBe("2026-08-01T00:00:00");
  });
});

// ─── getCierresDateRange: Día ─────────────────────────────────────

describe("getCierresDateRange — dia", () => {
  it("abarca el mismo día local", () => {
    const r = getCierresDateRange("dia", new Date(2026, 7, 1, 12, 0));
    expect(r).toEqual({ desde: "2026-08-01T00:00:00", hasta: "2026-08-01T00:00:00" });
  });

  it("límite UTC-3: 23:30 local del 08-01 → Día 08-01, NO 08-02", () => {
    // base local = 2026-08-01 23:30. En UTC-3, toISOString daría "2026-08-02"
    // (00:30 del día siguiente en UTC) — la implementación local lo evita.
    const base = new Date(2026, 7, 1, 23, 30);
    const r = getCierresDateRange("dia", base);
    expect(r.desde).toBe("2026-08-01T00:00:00");
    expect(r.hasta).toBe("2026-08-01T00:00:00");
  });

  it("abarca la madrugada local sin correrse al día previo", () => {
    const r = getCierresDateRange("dia", new Date(2026, 7, 1, 0, 5));
    expect(r).toEqual({ desde: "2026-08-01T00:00:00", hasta: "2026-08-01T00:00:00" });
  });
});

// ─── getCierresDateRange: Semana ──────────────────────────────────

describe("getCierresDateRange — semana", () => {
  it("sábado 2026-08-01 → lunes 07-27 / domingo 08-02", () => {
    // 2026-08-01 es sábado (getDay() === 6)
    const r = getCierresDateRange("semana", new Date(2026, 7, 1, 15, 0));
    expect(r).toEqual({
      desde: "2026-07-27T00:00:00",
      hasta: "2026-08-02T00:00:00",
    });
  });

  it("la semana empieza en lunes: base lunes → semana completa desde el lunes mismo", () => {
    // 2026-08-03 es lunes
    const r = getCierresDateRange("semana", new Date(2026, 7, 3, 9, 30));
    expect(r).toEqual({
      desde: "2026-08-03T00:00:00",
      hasta: "2026-08-09T00:00:00",
    });
  });

  it("miércoles 2026-07-29 → semana del 07-27 al 08-02", () => {
    const r = getCierresDateRange("semana", new Date(2026, 6, 29, 12, 0));
    expect(r).toEqual({
      desde: "2026-07-27T00:00:00",
      hasta: "2026-08-02T00:00:00",
    });
  });

  it("domingo 2026-08-02 → semana del 07-27 al 08-02 (el domingo cierra la semana)", () => {
    const r = getCierresDateRange("semana", new Date(2026, 7, 2, 20, 0));
    expect(r).toEqual({
      desde: "2026-07-27T00:00:00",
      hasta: "2026-08-02T00:00:00",
    });
  });
});

// ─── getCierresDateRange: Mes ─────────────────────────────────────

describe("getCierresDateRange — mes", () => {
  it("agosto 2026 → 01 al 31", () => {
    const r = getCierresDateRange("mes", new Date(2026, 7, 15));
    expect(r).toEqual({
      desde: "2026-08-01T00:00:00",
      hasta: "2026-08-31T00:00:00",
    });
  });

  it("febrero 2026 (no bisiesto) → 01 al 28, sin literal 31", () => {
    const r = getCierresDateRange("mes", new Date(2026, 1, 10));
    expect(r).toEqual({
      desde: "2026-02-01T00:00:00",
      hasta: "2026-02-28T00:00:00",
    });
  });

  it("diciembre 2026 → 01 al 31", () => {
    const r = getCierresDateRange("mes", new Date(2026, 11, 25));
    expect(r.hasta).toBe("2026-12-31T00:00:00");
  });
});

// ─── getCierresDateRange: Año ─────────────────────────────────────

describe("getCierresDateRange — anio", () => {
  it("2026 → 01-01 al 31-12", () => {
    const r = getCierresDateRange("anio", new Date(2026, 5, 20));
    expect(r).toEqual({
      desde: "2026-01-01T00:00:00",
      hasta: "2026-12-31T00:00:00",
    });
  });
});

// ─── Semántica F1 (strings sin Z = hora local) ────────────────────

describe("F1 — strings datetime local sin Z", () => {
  it("new Date('2026-08-01T00:00:00').getHours() === 0 en cualquier zona", () => {
    // Forma sin offset se interpreta como hora LOCAL (no UTC como '2026-08-01')
    expect(new Date("2026-08-01T00:00:00").getHours()).toBe(0);
  });

  it("ventana de día local completo = 86399999 ms", () => {
    const diff = new Date("2026-08-01T23:59:59.999").getTime() - new Date("2026-08-01T00:00:00").getTime();
    expect(diff).toBe(86399999);
  });

  it("ventana de día local completa con constructores locales", () => {
    const diff = new Date(2026, 7, 1, 23, 59, 59, 999).getTime() - new Date(2026, 7, 1).getTime();
    expect(diff).toBe(86399999);
  });

  it("'2026-08-01' (date-only) NO es lo mismo: se interpreta UTC", () => {
    // getUTCHours() === 0 garantizado; getHours() depende de la zona (UTC-3 → 21 del día previo)
    expect(new Date("2026-08-01").getUTCHours()).toBe(0);
  });
});

// ─── Día 0 del mes siguiente = último día real (sin literal 31) ───

describe("fin de mes real vía new Date(y, m, 0)", () => {
  it("febrero 2026 → 28 días (día 0 de marzo)", () => {
    expect(new Date(2026, 2, 0).getDate()).toBe(28);
  });

  it("agosto 2026 → 31 días (día 0 de septiembre)", () => {
    expect(new Date(2026, 8, 0).getDate()).toBe(31);
  });

  it("documenta el índice: new Date(2026, 1, 0) es el último día de enero (31)", () => {
    // El día 0 del mes m es el último día del mes m-1
    expect(new Date(2026, 1, 0).getDate()).toBe(31);
  });
});

// ─── toApiDate ────────────────────────────────────────────────────

describe("toApiDate", () => {
  it("normaliza date-only → datetime local completo", () => {
    expect(toApiDate("2026-08-01")).toBe("2026-08-01T00:00:00");
    expect(toApiDate("2026-02-28")).toBe("2026-02-28T00:00:00");
  });

  it("undefined pasa directo", () => {
    expect(toApiDate(undefined)).toBeUndefined();
  });

  it("string vacía → undefined", () => {
    expect(toApiDate("")).toBeUndefined();
  });
});
