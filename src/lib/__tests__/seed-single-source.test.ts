import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEMO_PASSWORD,
  buildRoleSeedData,
  PRODUCT_DEMOS,
  getSeedInvariantErrors,
  SALE_DEMOS,
  REPOSICION_DEMOS,
  FINANCIAL_ACCOUNT_DEMOS,
} from "../../../prisma/seed";

describe("seed única oficial", () => {
  it("integra permisos de roles en la seed principal", () => {
    const roles = buildRoleSeedData();
    expect(roles).toHaveLength(3);
    expect(roles.every((rol) => rol.permisos.includes('"permisos"'))).toBe(true);
    expect(roles.find((rol) => rol.nombre === "ADMINISTRADOR")?.permisos).toContain("productos.ver");
  });

  it("mantiene un dataset demo financiero coherente", () => {
    expect(DEMO_PASSWORD).toBe("1234");
    expect(new Set(SALE_DEMOS.map((sale) => sale.metodoPago))).toEqual(
      new Set(["EFECTIVO", "TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO"])
    );
    expect(new Set(REPOSICION_DEMOS.map((purchase) => purchase.kind))).toEqual(
      new Set(["EFECTIVO", "TRANSFERENCIA", "MIXTO"])
    );
    expect(FINANCIAL_ACCOUNT_DEMOS.filter((account) => account.tipo === "BANCO" && account.esPrincipal)).toHaveLength(1);
    expect(FINANCIAL_ACCOUNT_DEMOS.filter((account) => account.tipo === "POR_ACREDITAR")).toHaveLength(1);
    expect(getSeedInvariantErrors()).toEqual([]);
  });

  it("versiona los assets demo de productos dentro del repositorio", () => {
    expect(PRODUCT_DEMOS).toHaveLength(100);

    const productsWithImage = PRODUCT_DEMOS.filter((product) => product.imagen);
    const productsWithoutImage = PRODUCT_DEMOS.filter((product) => !product.imagen);

    expect(productsWithImage).toHaveLength(100);
    expect(productsWithoutImage).toHaveLength(0);

    productsWithImage.forEach((product) => {
      expect(product.imagen).toMatch(/^\/(uploads|seed\/productos)\/.+\.(jpg|jpeg|png|webp|gif)$/);

      const assetPath = path.join(process.cwd(), "public", product.imagen!.replace(/^\//, ""));
      expect(existsSync(assetPath), `${product.key} should reference an existing demo asset`).toBe(true);
    });
  });
});
