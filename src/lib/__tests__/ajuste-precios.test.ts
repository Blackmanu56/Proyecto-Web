import { describe, it, expect } from "vitest";
import {
  aplicarRedondeo,
  calcularNuevoPrecio,
  calcularMargenGanancia,
  calcularComparacionProducto,
  ajusteIndividualSchema,
  ajusteMasivoSchema,
} from "@/lib/ajuste-precios";

describe("Ajuste de Precios - Cálculos Puros", () => {
  describe("aplicarRedondeo", () => {
    it("aplica SIN_REDONDEO a 2 decimales", () => {
      expect(aplicarRedondeo(1234.5678, "SIN_REDONDEO")).toBe(1234.57);
      expect(aplicarRedondeo(100, "SIN_REDONDEO")).toBe(100);
    });

    it("aplica redondeo al ENTERO más cercano", () => {
      expect(aplicarRedondeo(1050.45, "ENTERO")).toBe(1050);
      expect(aplicarRedondeo(1050.55, "ENTERO")).toBe(1051);
    });

    it("aplica redondeo a MULTIPLO_10", () => {
      expect(aplicarRedondeo(1054, "MULTIPLO_10")).toBe(1050);
      expect(aplicarRedondeo(1056, "MULTIPLO_10")).toBe(1060);
      expect(aplicarRedondeo(1055, "MULTIPLO_10")).toBe(1060);
    });

    it("aplica redondeo a MULTIPLO_100", () => {
      expect(aplicarRedondeo(1240, "MULTIPLO_100")).toBe(1200);
      expect(aplicarRedondeo(1260, "MULTIPLO_100")).toBe(1300);
      expect(aplicarRedondeo(1250, "MULTIPLO_100")).toBe(1300);
    });

    it("aplica redondeo a MULTIPLO_1000", () => {
      expect(aplicarRedondeo(15400, "MULTIPLO_1000")).toBe(15000);
      expect(aplicarRedondeo(15800, "MULTIPLO_1000")).toBe(16000);
      expect(aplicarRedondeo(15500, "MULTIPLO_1000")).toBe(16000);
    });
  });

  describe("calcularNuevoPrecio", () => {
    it("calcula aumento porcentual (+10%)", () => {
      expect(calcularNuevoPrecio(10000, "PORCENTAJE", 10)).toBe(11000);
    });

    it("calcula disminución porcentual (-15%)", () => {
      expect(calcularNuevoPrecio(10000, "PORCENTAJE", -15)).toBe(8500);
    });

    it("calcula aumento por monto fijo (+$500)", () => {
      expect(calcularNuevoPrecio(10000, "MONTO_FIJO", 500)).toBe(10500);
    });

    it("calcula disminución por monto fijo (-$1000)", () => {
      expect(calcularNuevoPrecio(10000, "MONTO_FIJO", -1000)).toBe(9000);
    });

    it("establece valor directo", () => {
      expect(calcularNuevoPrecio(10000, "VALOR_DIRECTO", 18500)).toBe(18500);
    });

    it("combina cálculo porcentual con redondeo", () => {
      // 10000 + 12.5% = 11250 -> MULTIPLO_1000 -> 11000
      expect(calcularNuevoPrecio(10000, "PORCENTAJE", 12.5, "MULTIPLO_1000")).toBe(11000);
      // 10000 + 15% = 11500 -> MULTIPLO_1000 -> 12000
      expect(calcularNuevoPrecio(10000, "PORCENTAJE", 15, "MULTIPLO_1000")).toBe(12000);
    });
  });

  describe("calcularMargenGanancia", () => {
    it("calcula margen correctamente: ((Venta - Compra) / Compra) * 100", () => {
      expect(calcularMargenGanancia(10000, 15000)).toBe(50);
      expect(calcularMargenGanancia(10000, 20000)).toBe(100);
      expect(calcularMargenGanancia(12000, 15000)).toBe(25);
      expect(calcularMargenGanancia(10000, 10000)).toBe(0);
    });

    it("maneja precio de compra 0 o inválido retornando null", () => {
      expect(calcularMargenGanancia(0, 15000)).toBeNull();
      expect(calcularMargenGanancia(-100, 15000)).toBeNull();
      expect(calcularMargenGanancia(NaN, 15000)).toBeNull();
    });
  });

  describe("calcularComparacionProducto", () => {
    it("genera comparativa completa con diferencias y márgenes", () => {
      const result = calcularComparacionProducto({
        productoId: 1,
        nombre: "Pastilla de Freno",
        codigo: "PF-001",
        marca: "Honda",
        categoria: "Frenos",
        proveedor: "Motomax",
        precioCompraActual: 10000,
        precioVentaActual: 15000,
        nuevoPrecioCompra: 12000,
        nuevoPrecioVenta: 18000,
      });

      expect(result.productoId).toBe(1);
      expect(result.nombre).toBe("Pastilla de Freno");
      expect(result.precioCompraAnterior).toBe(10000);
      expect(result.precioCompraNuevo).toBe(12000);
      expect(result.diferenciaCompra).toBe(2000);
      expect(result.porcentajeVariacionCompra).toBe(20);
      expect(result.precioVentaAnterior).toBe(15000);
      expect(result.precioVentaNuevo).toBe(18000);
      expect(result.diferenciaVenta).toBe(3000);
      expect(result.porcentajeVariacionVenta).toBe(20);
      expect(result.margenAnterior).toBe(50);
      expect(result.margenNuevo).toBe(50);
    });
  });
});

describe("Ajuste de Precios - Validaciones Zod", () => {
  describe("ajusteIndividualSchema", () => {
    it("valida ajuste individual correcto", () => {
      const valid = ajusteIndividualSchema.safeParse({
        productoId: 1,
        ajustarVenta: true,
        metodoVenta: "PORCENTAJE",
        valorVenta: 10,
        motivo: "Ajuste por inflación",
      });

      expect(valid.success).toBe(true);
    });

    it("falla si no se selecciona ni compra ni venta", () => {
      const invalid = ajusteIndividualSchema.safeParse({
        productoId: 1,
        ajustarCompra: false,
        ajustarVenta: false,
        motivo: "Ajuste",
      });

      expect(invalid.success).toBe(false);
    });

    it("falla si el motivo es menor a 3 caracteres", () => {
      const invalid = ajusteIndividualSchema.safeParse({
        productoId: 1,
        ajustarVenta: true,
        metodoVenta: "PORCENTAJE",
        valorVenta: 10,
        motivo: "Ok",
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe("ajusteMasivoSchema", () => {
    it("valida configuración masiva correcta", () => {
      const valid = ajusteMasivoSchema.safeParse({
        tipoAjuste: "PORCENTAJE",
        valorAjuste: 15,
        preciosAfectados: "SOLO_VENTA",
        filtros: {
          categoriaId: 2,
          marca: "Honda",
          proveedorId: "all",
          estado: "activos",
        },
        redondeo: "MULTIPLO_100",
        motivo: "Actualización general de lista de precios",
      });

      expect(valid.success).toBe(true);
    });

    it("permite valores negativos (disminución)", () => {
      const valid = ajusteMasivoSchema.safeParse({
        tipoAjuste: "PORCENTAJE",
        valorAjuste: -10,
        preciosAfectados: "AMBOS",
        filtros: {
          categoriaId: "all",
          marca: "all",
          proveedorId: "all",
          estado: "todos",
        },
        redondeo: "SIN_REDONDEO",
        motivo: "Descuento de temporada",
      });

      expect(valid.success).toBe(true);
    });

    it("falla si el valor de ajuste es 0", () => {
      const invalid = ajusteMasivoSchema.safeParse({
        tipoAjuste: "PORCENTAJE",
        valorAjuste: 0,
        preciosAfectados: "SOLO_VENTA",
        filtros: {
          categoriaId: "all",
          marca: "all",
          proveedorId: "all",
          estado: "activos",
        },
        motivo: "Prueba",
      });

      expect(invalid.success).toBe(false);
    });
  });
});
