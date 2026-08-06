import { describe, it, expect } from "vitest";
import {
  formatMovimientoDescripcion,
  formatTipoComprobante,
} from "../movimiento-format";

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
