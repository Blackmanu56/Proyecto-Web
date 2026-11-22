import { describe, expect, it } from "vitest";
import { formatMovimientoDescripcion } from "../movimiento-format";
import { getConcepto, getTipoVisual, type MovimientoInput } from "../caja-filters";
import { calcularImpactoFinanciero } from "../cuenta-financiera";
import {
  crearFilaImpresionLibroDiario,
  crearModeloImpresionLibroDiario,
  type MovimientoFinancieroImpresion,
} from "../caja-print";

describe("Ajustes de Caja y Banco — visualización e impacto financiero", () => {
  describe("1. formatMovimientoDescripcion", () => {
    it("quita prefijo [AJUSTE_EFECTIVO] de la descripción a mostrar", () => {
      expect(
        formatMovimientoDescripcion("[AJUSTE_EFECTIVO] se agrego efectivo")
      ).toBe("se agrego efectivo");
      expect(
        formatMovimientoDescripcion("[AJUSTE EFECTIVO] se agrego efectivo")
      ).toBe("se agrego efectivo");
    });

    it("quita prefijo [AJUSTE_BANCO] si existiera", () => {
      expect(
        formatMovimientoDescripcion("[AJUSTE_BANCO] se genero rendimientos")
      ).toBe("se genero rendimientos");
    });
  });

  describe("2. getConcepto y getTipoVisual para Ajustes Bancarios", () => {
    it("clasifica ajuste bancario de ingreso como AJUSTE (no como VENTA)", () => {
      const movAjusteBanco: MovimientoInput = {
        id: -2000001,
        tipo: "INGRESO",
        monto: 2000,
        descripcion: "se genero rendimientos",
        esNoEfectivo: false,
        impactaCaja: false,
        ventaId: null,
        venta: null,
        compraId: null,
        compra: null,
      };

      expect(getConcepto(movAjusteBanco)).toBe("AJUSTE");
      const visual = getTipoVisual(movAjusteBanco);
      expect(visual.label).toBe("AJUSTE");
    });

    it("clasifica ajuste bancario de egreso como AJUSTE", () => {
      const movAjusteBancoEgreso: MovimientoInput = {
        id: -2000002,
        tipo: "EGRESO",
        monto: 1500,
        descripcion: "comisión bancaria mantenimiento",
        esNoEfectivo: false,
        impactaCaja: false,
        ventaId: null,
        venta: null,
        compraId: null,
        compra: null,
      };

      expect(getConcepto(movAjusteBancoEgreso)).toBe("AJUSTE");
      const visual = getTipoVisual(movAjusteBancoEgreso);
      expect(visual.label).toBe("AJUSTE");
    });
  });

  describe("3. calcularImpactoFinanciero para Ajustes", () => {
    it("ajuste bancario ingreso suma a ingresoBanco y no a Caja", () => {
      const impacto = calcularImpactoFinanciero({
        tipo: "INGRESO",
        monto: 2000,
        descripcion: "se genero rendimientos",
        impactaCaja: false,
      });

      expect(impacto.ingresoBanco).toBe(2000);
      expect(impacto.egresoBanco).toBe(0);
      expect(impacto.ingresoCaja).toBe(0);
      expect(impacto.egresoCaja).toBe(0);
    });

    it("ajuste bancario egreso suma a egresoBanco y no a Caja", () => {
      const impacto = calcularImpactoFinanciero({
        tipo: "EGRESO",
        monto: 1500,
        descripcion: "gasto bancario",
        impactaCaja: false,
      });

      expect(impacto.ingresoBanco).toBe(0);
      expect(impacto.egresoBanco).toBe(1500);
      expect(impacto.ingresoCaja).toBe(0);
      expect(impacto.egresoCaja).toBe(0);
    });

    it("ajuste efectivo ingreso suma a ingresoCaja", () => {
      const impacto = calcularImpactoFinanciero({
        tipo: "INGRESO",
        monto: 6000,
        descripcion: "[AJUSTE_EFECTIVO] se agrego efectivo",
        impactaCaja: true,
      });

      expect(impacto.ingresoCaja).toBe(6000);
      expect(impacto.egresoCaja).toBe(0);
      expect(impacto.ingresoBanco).toBe(0);
      expect(impacto.egresoBanco).toBe(0);
    });

    it("ajuste efectivo egreso suma a egresoCaja", () => {
      const impacto = calcularImpactoFinanciero({
        tipo: "EGRESO",
        monto: 3000,
        descripcion: "[AJUSTE_EFECTIVO] retiro de caja",
        impactaCaja: true,
      });

      expect(impacto.ingresoCaja).toBe(0);
      expect(impacto.egresoCaja).toBe(3000);
      expect(impacto.ingresoBanco).toBe(0);
      expect(impacto.egresoBanco).toBe(0);
    });
  });

  describe("4. Modelo de impresión y Libro Diario con ajuste bancario", () => {
    it("proyecta ajuste bancario en el modelo con saldoBanco actualizado", () => {
      const movBanco: MovimientoFinancieroImpresion = {
        id: 55,
        tipo: "INGRESO",
        monto: 2000,
        descripcion: "se genero rendimientos",
        fecha: new Date("2026-10-04T18:00:00-03:00"),
        usuario: { username: "admin", nombreCompleto: "Administrador" },
        ventaId: null,
        venta: null,
        compraId: null,
        compra: null,
      };

      const modelo = crearModeloImpresionLibroDiario(
        [],
        [movBanco],
        undefined,
        10000 // saldoBancoInicial
      );

      expect(modelo).toHaveLength(1);
      const row = modelo[0];
      expect(row.saldoBanco).toBe(12000); // 10000 + 2000

      const fila = crearFilaImpresionLibroDiario(row);
      expect(fila.ingresoBanco).toBe(2000);
      expect(fila.egresoBanco).toBe(0);
      expect(fila.saldoBanco).toBe(12000);
      expect(fila.ingresoCaja).toBe(0);
      expect(fila.egresoCaja).toBe(0);
    });
  });
});
