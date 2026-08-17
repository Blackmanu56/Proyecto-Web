import { describe, expect, it } from "vitest";
import { getProductPurchaseCost } from "@/lib/product-purchase-payments";

describe("getProductPurchaseCost mode", () => {
  it("create reads cantidad field", () => {
    const fd = new FormData();
    fd.set("cantidad", "10");
    fd.set("precioCompra", "50");
    expect(getProductPurchaseCost(fd, "create")).toBe(500);
  });

  it("reposicion reads cantidad field (D8: total = cantidad × precioCompra)", () => {
    const fd = new FormData();
    fd.set("cantidad", "5");
    fd.set("precioCompra", "100");
    expect(getProductPurchaseCost(fd, "reposicion")).toBe(500);
  });

  it("edit reads cantidadAReponer field", () => {
    const fd = new FormData();
    fd.set("cantidadAReponer", "3");
    fd.set("precioCompra", "200");
    expect(getProductPurchaseCost(fd, "edit")).toBe(600);
  });
});
