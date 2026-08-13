import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  formatMovimientoDescripcion,
  formatReposicionCorta,
  formatReposicionFila,
  formatTipoComprobante,
} from "../movimiento-format";

const cajaTerminalSource = readFileSync(
  new URL("../../components/forms/CajaTerminal.tsx", import.meta.url),
  "utf8"
);

describe("formatTipoComprobante", () => {
  it("convierte enums con underscores a forma legible", () => {
    expect(formatTipoComprobante("FACTURA_A")).toBe("FACTURA A");
    expect(formatTipoComprobante("FACTURA_B")).toBe("FACTURA B");
    expect(formatTipoComprobante("FACTURA_C")).toBe("FACTURA C");
    expect(formatTipoComprobante("TICKET")).toBe("TICKET");
  });

  it("recorta espacios extra", () => {
    expect(formatTipoComprobante(" FACTURA_A ")).toBe("FACTURA A");
  });

  it("retorna el input intacto si es vacío", () => {
    expect(formatTipoComprobante("")).toBe("");
  });
});

describe("formatMovimientoDescripcion", () => {
  it("corrige underscore + N? corrupto en registros viejos", () => {
    expect(formatMovimientoDescripcion("FACTURA_C N? 40 - EFECTIVO")).toBe(
      "FACTURA C N° 40 - EFECTIVO"
    );
  });

  it("corrige el símbolo de grado en variantes con espacios", () => {
    expect(formatMovimientoDescripcion("FACTURA_A N ? 3")).toBe("FACTURA A N° 3");
    expect(formatMovimientoDescripcion("FACTURA_B N?12 - TARJETA")).toBe(
      "FACTURA B N°12 - TARJETA"
    );
  });

  it("es idempotente con textos ya correctos", () => {
    const ok = "FACTURA C N° 40 - EFECTIVO";
    expect(formatMovimientoDescripcion(ok)).toBe(ok);
  });

  it("no toca guiones internos sin espacios (foo-bar)", () => {
    expect(formatMovimientoDescripcion("foo-bar")).toBe("foo-bar");
    expect(formatMovimientoDescripcion("N°12-EFECTIVO")).toBe("N°12-EFECTIVO");
  });

  it("asegura espacios alrededor del separador '-'", () => {
    expect(formatMovimientoDescripcion("X -Y")).toBe("X - Y");
    expect(formatMovimientoDescripcion("X- Y")).toBe("X - Y");
    expect(formatMovimientoDescripcion("X - Y")).toBe("X - Y");
    expect(formatMovimientoDescripcion("X  -  Y")).toBe("X - Y");
  });

  it("colapsa espacios múltiples y recorta", () => {
    expect(formatMovimientoDescripcion("  FACTURA_C   N? 40   -  EFECTIVO  ")).toBe(
      "FACTURA C N° 40 - EFECTIVO"
    );
  });

  it("conserva tildes", () => {
    expect(formatMovimientoDescripcion("Reposición de 'X' x5")).toBe(
      "Reposición de 'X' x5"
    );
  });

  it("retorna el input intacto si es vacío o null/undefined", () => {
    expect(formatMovimientoDescripcion("")).toBe("");
    expect(formatMovimientoDescripcion(null as unknown as string)).toBeNull();
    expect(formatMovimientoDescripcion(undefined as unknown as string)).toBeUndefined();
  });

  it("mantiene el sufijo de descuento intacto", () => {
    expect(
      formatMovimientoDescripcion("FACTURA_C N? 40 - EFECTIVO (Dto: $10.50)")
    ).toBe("FACTURA C N° 40 - EFECTIVO (Dto: $10.50)");
  });
});

describe("formatReposicionCorta", () => {
  const detalle = {
    cantidad: 2,
    producto: { nombre: "Batería AGM", marca: "Yamaha" },
  };

  it("mantiene exactamente el formato histórico por defecto aunque Compra tenga total", () => {
    expect(formatReposicionCorta({ total: 247_200, detalles: [detalle] })).toBe(
      "Reposición — Batería AGM · Yamaha"
    );
  });

  it("incluye el total primero solo cuando la fila visible lo solicita", () => {
    const text = formatReposicionCorta(
      { total: 247_200, detalles: [detalle] },
      { includeTotal: true }
    );

    expect(text).toContain("Batería AGM · Yamaha");
    expect(text).toContain("247.200,00");
    expect(text?.indexOf("247.200,00")).toBeLessThan(
      text?.indexOf("Batería AGM") ?? Number.POSITIVE_INFINITY
    );
  });

  it("mantiene el texto histórico sin total cuando el dato no está disponible", () => {
    expect(formatReposicionCorta({ detalles: [detalle] })).toBe(
      "Reposición — Batería AGM · Yamaha"
    );
    expect(
      formatReposicionCorta({ total: Number.NaN, detalles: [detalle] })
    ).toBe("Reposición — Batería AGM · Yamaha");
  });

  it("conserva el fallback nulo cuando no existen detalles", () => {
    expect(formatReposicionCorta({ total: 247_200, detalles: [] })).toBeNull();
  });

  it("usa el helper unificado de impresión/CSV y no vuelve a depender del texto corto histórico", () => {
    const calls = cajaTerminalSource
      .split(/\r?\n/)
      .filter((line) => line.includes("formatReposicionCorta(mov.compra"));

    expect(calls).toHaveLength(0);
    expect(cajaTerminalSource).toContain("construirDescripcionImpresion(mov)");
    expect(cajaTerminalSource).toContain("crearFilaImpresionLibroDiario(mov)");
  });
});

describe("formatReposicionFila", () => {
  const detalle = {
    cantidad: 2,
    producto: { nombre: "Batería AGM", marca: "Yamaha" },
  };

  const compra = (medios?: string[]) => ({
    total: 60_000,
    detalles: [detalle],
    ...(medios === undefined
      ? {}
      : { pagos: medios.map((medio, index) => ({ id: index + 1, medio, monto: 60_000 })) }),
  });

  it.each([
    ["EFECTIVO_CAJA", "Efectivo"],
    ["TRANSFERENCIA_BANCARIA", "Transferencia"],
    ["CUENTA_CORRIENTE_PROVEEDOR", "Cta. Cte."],
    ["FONDOS_EXTERNOS", "Fondos externos"],
    ["MERCADO_PAGO", "Mercado Pago"],
  ])("muestra el medio único %s como %s", (medio, etiqueta) => {
    expect(formatReposicionFila(compra([medio]))).toEqual({
      principal: "Batería AGM · Yamaha",
      secundaria: `Total $ 60.000,00 · ${etiqueta}`,
    });
  });

  it("resume dos o más medios distintos como Mixto", () => {
    expect(
      formatReposicionFila(compra(["EFECTIVO_CAJA", "TRANSFERENCIA_BANCARIA"]))
    ).toEqual({
      principal: "Batería AGM · Yamaha",
      secundaria: "Total $ 60.000,00 · Mixto",
    });
  });

  it("usa Compra.total y nunca el monto físico del movimiento", () => {
    expect(formatReposicionFila(compra(["EFECTIVO_CAJA"]))?.secundaria).toContain(
      "60.000,00"
    );
  });

  it("mantiene el resumen existente para múltiples productos", () => {
    expect(
      formatReposicionFila({
        total: 90_000,
        detalles: [
          detalle,
          { cantidad: 3, producto: { nombre: "Pastillas", marca: "Honda" } },
        ],
        pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 90_000 }],
      })
    ).toEqual({
      principal: "5 productos",
      secundaria: "Total $ 90.000,00 · Transferencia",
    });
  });

  it("tolera reposiciones históricas sin pagos sin inventar un medio", () => {
    expect(formatReposicionFila(compra())).toEqual({
      principal: "Batería AGM · Yamaha",
      secundaria: "Total $ 60.000,00",
    });
    expect(formatReposicionFila(compra([]))).toEqual({
      principal: "Batería AGM · Yamaha",
      secundaria: "Total $ 60.000,00",
    });
  });

  it("omite un medio histórico desconocido que no puede presentar con seguridad", () => {
    expect(formatReposicionFila(compra(["LEGACY_UNKNOWN"]))?.secundaria).toBe(
      "Total $ 60.000,00"
    );
  });

});
