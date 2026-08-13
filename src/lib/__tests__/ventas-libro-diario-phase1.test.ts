import { describe, expect, it } from "vitest";
import {
  enrichMovimientos,
  type MovimientoInput,
  type MovimientoVenta,
} from "../caja-filters";

// ── Helpers ──────────────────────────────────────────────────────────

function makeFisico(overrides: Partial<MovimientoInput> = {}): MovimientoInput {
  return {
    id: 1,
    tipo: "INGRESO",
    monto: 50_000,
    descripcion: "Factura C N° 22 - EFECTIVO",
    fecha: new Date("2026-08-12T10:00:00"),
    usuario: { username: "cajero1", nombreCompleto: "Juan Cajero" },
    ventaId: 22,
    venta: null,
    compraId: null,
    compra: null,
    esNoEfectivo: false,
    impactaCaja: true,
    ...overrides,
  };
}

function makeVentaNoEfectiva(
  id: number,
  metodoPago: string,
  total: number,
  fecha: Date,
  detalles: MovimientoVenta["detalles"] = []
): MovimientoInput {
  return {
    id: -(id + 100_000),
    tipo: "INGRESO",
    monto: total,
    descripcion: `Venta #${id} · ${metodoPago} — Total $${total.toLocaleString("es-AR")}`,
    fecha,
    usuario: { username: "cajero1", nombreCompleto: "Juan Cajero" },
    ventaId: id,
    venta: {
      id,
      total,
      fecha,
      metodoPago,
      descuentoTipo: null,
      montoDescuento: null,
      tipoComprobante: "FACTURA_C",
      cliente: { id: 1, nombre: "Cliente Test", dni: "12345678" },
      usuario: { username: "cajero1", nombreCompleto: "Juan Cajero" },
      detalles,
    },
    compraId: null,
    compra: null,
    esNoEfectivo: true,
    impactaCaja: false,
  };
}

function makeApertura(monto: number): MovimientoInput {
  return {
    id: 100,
    tipo: "INGRESO",
    monto,
    descripcion: "Saldo inicial de apertura de caja",
    fecha: new Date("2026-08-12T08:00:00"),
    usuario: { username: "cajero1" },
    ventaId: null,
    compraId: null,
    compra: null,
    esNoEfectivo: false,
    impactaCaja: true,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Ventas en Libro Diario — Phase 1", () => {
  // Test A: Venta en efectivo aparece una sola vez con ingreso físico correcto
  it("A — cash sale appears once with correct physical income", () => {
    const apertura = makeApertura(100_000);
    const ventaEfectivo = makeFisico({
      id: 1,
      monto: 50_000,
      ventaId: 22,
      fecha: new Date("2026-08-12T10:00:00"),
    });

    const enriched = enrichMovimientos([apertura, ventaEfectivo]);

    expect(enriched).toHaveLength(2);

    const ventaRow = enriched.find((m) => m.ventaId === 22);
    expect(ventaRow).toBeDefined();
    expect(ventaRow!.monto).toBe(50_000);
    expect(ventaRow!.impactaCaja).toBe(true);
    expect(ventaRow!.esNoEfectivo).toBe(false);
    // Saldo = apertura 100k + venta 50k = 150k
    expect(ventaRow!.saldoAcumulado).toBe(150_000);
  });

  // Test B: Venta por transferencia aparece sin MovimientoCaja y sin cambiar saldo
  it("B — bank transfer sale appears in ledger without changing accumulated balance", () => {
    const apertura = makeApertura(100_000);
    const ventaTransferencia = makeVentaNoEfectiva(
      30,
      "TRANSFERENCIA",
      80_000,
      new Date("2026-08-12T11:00:00")
    );

    const enriched = enrichMovimientos([apertura, ventaTransferencia]);

    expect(enriched).toHaveLength(2);

    const transRow = enriched.find((m) => m.ventaId === 30);
    expect(transRow).toBeDefined();
    expect(transRow!.esNoEfectivo).toBe(true);
    expect(transRow!.impactaCaja).toBe(false);
    expect(transRow!.monto).toBe(80_000);
    // Saldo acumulado must NOT change — stays at apertura = 100k
    expect(transRow!.saldoAcumulado).toBe(100_000);
  });

  // Test C: Venta por tarjeta de débito aparece sin cambiar saldo
  it("C — debit card sale appears in ledger without changing accumulated balance", () => {
    const apertura = makeApertura(100_000);
    const ventaDebito = makeVentaNoEfectiva(
      31,
      "TARJETA_DEBITO",
      45_000,
      new Date("2026-08-12T12:00:00")
    );

    const enriched = enrichMovimientos([apertura, ventaDebito]);

    const debitoRow = enriched.find((m) => m.ventaId === 31);
    expect(debitoRow).toBeDefined();
    expect(debitoRow!.esNoEfectivo).toBe(true);
    expect(debitoRow!.impactaCaja).toBe(false);
    // Balance unchanged
    expect(debitoRow!.saldoAcumulado).toBe(100_000);
  });

  // Test D: Venta por tarjeta de crédito aparece sin cambiar saldo
  it("D — credit card sale appears in ledger without changing accumulated balance", () => {
    const apertura = makeApertura(100_000);
    const ventaCredito = makeVentaNoEfectiva(
      32,
      "TARJETA_CREDITO",
      120_000,
      new Date("2026-08-12T13:00:00")
    );

    const enriched = enrichMovimientos([apertura, ventaCredito]);

    const creditoRow = enriched.find((m) => m.ventaId === 32);
    expect(creditoRow).toBeDefined();
    expect(creditoRow!.esNoEfectivo).toBe(true);
    expect(creditoRow!.impactaCaja).toBe(false);
    // Balance unchanged
    expect(creditoRow!.saldoAcumulado).toBe(100_000);
  });

  // Test E: Sale detail with 1 product shows product, qty, unit price, subtotal, total
  it("E — single product sale detail carries historical price data", () => {
    const detalle = [
      {
        id: 1,
        cantidad: 2,
        precioUnitario: 30_000,
        subtotal: 60_000,
        producto: {
          id: 10,
          nombre: "Batería AGM",
          marca: "Yuasa",
          categoria: { id: 1, nombre: "Baterías" },
        },
      },
    ];
    const ventaTrans = makeVentaNoEfectiva(
      40,
      "TRANSFERENCIA",
      60_000,
      new Date("2026-08-12T14:00:00"),
      detalle
    );

    const enriched = enrichMovimientos([ventaTrans]);
    const row = enriched[0];

    expect(row.venta).toBeDefined();
    expect(row.venta!.detalles).toHaveLength(1);

    const d = row.venta!.detalles![0];
    expect(d.producto.nombre).toBe("Batería AGM");
    expect(d.producto.marca).toBe("Yuasa");
    expect(d.producto.categoria?.nombre).toBe("Baterías");
    expect(d.cantidad).toBe(2);
    expect(d.precioUnitario).toBe(30_000);
    expect(d.subtotal).toBe(60_000);
    expect(row.venta!.total).toBe(60_000);
  });

  // Test F: Sale detail with 3 products shows all 3
  it("F — three product sale detail shows all three items", () => {
    const detalles = [
      {
        id: 1,
        cantidad: 1,
        precioUnitario: 10_000,
        subtotal: 10_000,
        producto: { id: 1, nombre: "Producto A", marca: null, categoria: null },
      },
      {
        id: 2,
        cantidad: 3,
        precioUnitario: 5_000,
        subtotal: 15_000,
        producto: { id: 2, nombre: "Producto B", marca: "Marca X", categoria: { id: 1, nombre: "Cat 1" } },
      },
      {
        id: 3,
        cantidad: 2,
        precioUnitario: 7_500,
        subtotal: 15_000,
        producto: { id: 3, nombre: "Producto C", marca: null, categoria: { id: 2, nombre: "Cat 2" } },
      },
    ];

    const venta = makeVentaNoEfectiva(
      50,
      "TARJETA_DEBITO",
      40_000,
      new Date("2026-08-12T15:00:00"),
      detalles
    );

    const enriched = enrichMovimientos([venta]);
    expect(enriched[0].venta!.detalles).toHaveLength(3);
    expect(enriched[0].venta!.detalles!.map((d) => d.producto.nombre)).toEqual([
      "Producto A",
      "Producto B",
      "Producto C",
    ]);
  });

  // Test G: Historical price — precioUnitario in DetalleVenta is independent of Producto.precioVenta
  it("G — historical price from DetalleVenta.precioUnitario is preserved", () => {
    const detalle = [
      {
        id: 1,
        cantidad: 1,
        precioUnitario: 25_000,
        subtotal: 25_000,
        producto: {
          id: 10,
          nombre: "Producto X",
          marca: null,
          categoria: null,
          // Even if the current product price were 35_000, DetalleVenta preserves 25_000
        },
      },
    ];

    const venta = makeVentaNoEfectiva(
      60,
      "TRANSFERENCIA",
      25_000,
      new Date("2026-08-12T16:00:00"),
      detalle
    );

    const enriched = enrichMovimientos([venta]);
    const d = enriched[0].venta!.detalles![0];

    // Must be the historical price, not a hypothetical current price
    expect(d.precioUnitario).toBe(25_000);
    expect(d.subtotal).toBe(25_000);
  });

  // Test H: Cash sale does NOT duplicate in the projection
  it("H — cash sale (with physical MovimientoCaja) is not duplicated", () => {
    const apertura = makeApertura(100_000);
    const ventaEfectivo = makeFisico({
      id: 1,
      monto: 50_000,
      ventaId: 22,
      fecha: new Date("2026-08-12T10:00:00"),
    });
    // Simulate: no non-cash projected row for ventaId=22 should exist,
    // because the projection only includes non-cash sales (esNoEfectivo=true).
    // A cash sale is represented by its physical MovimientoCaja only.

    const enriched = enrichMovimientos([apertura, ventaEfectivo]);

    const ventaRows = enriched.filter((m) => m.ventaId === 22);
    expect(ventaRows).toHaveLength(1);
    expect(ventaRows[0].esNoEfectivo).toBe(false);
    expect(ventaRows[0].impactaCaja).toBe(true);
  });

  // Test I: Existing Reposición modal detail remains intact
  it("I — reposición row retains compra details without interference", () => {
    const apertura = makeApertura(100_000);
    const reposicion: MovimientoInput = {
      id: 5,
      tipo: "EGRESO",
      monto: 30_000,
      descripcion: "Reposición de stock — Proveedor ABC",
      fecha: new Date("2026-08-12T09:00:00"),
      usuario: { username: "cajero1" },
      ventaId: null,
      compraId: 15,
      compra: {
        id: 15,
        total: 30_000,
        proveedor: { id: 1, nombre: "Proveedor ABC" },
        detalles: [
          {
            id: 1,
            cantidad: 5,
            costoUnitario: 6_000,
            subtotal: 30_000,
            producto: {
              id: 7,
              nombre: "Filtro Aceite",
              marca: "Mahle",
              cantidad: 10,
              categoria: { id: 3, nombre: "Filtros" },
            },
          },
        ],
      },
      esNoEfectivo: false,
      impactaCaja: true,
    };

    const enriched = enrichMovimientos([apertura, reposicion]);

    const repoRow = enriched.find((m) => m.compraId === 15);
    expect(repoRow).toBeDefined();
    expect(repoRow!.compra).toBeDefined();
    expect(repoRow!.compra!.proveedor.nombre).toBe("Proveedor ABC");
    expect(repoRow!.compra!.detalles).toHaveLength(1);
    expect(repoRow!.compra!.detalles[0].producto.nombre).toBe("Filtro Aceite");
    // Balance: apertura 100k - egreso 30k = 70k
    expect(repoRow!.saldoAcumulado).toBe(70_000);
  });

  // ── Chronological ordering ────────────────────────────────────────

  it("mixed cash and non-cash movements are sorted chronologically", () => {
    const apertura = makeApertura(100_000);

    const ventaEfectivo = makeFisico({
      id: 2,
      monto: 30_000,
      ventaId: 20,
      fecha: new Date("2026-08-12T10:30:00"),
    });

    const ventaTransferencia = makeVentaNoEfectiva(
      21,
      "TRANSFERENCIA",
      50_000,
      new Date("2026-08-12T10:00:00")
    );

    const ventaDebito = makeVentaNoEfectiva(
      22,
      "TARJETA_DEBITO",
      25_000,
      new Date("2026-08-12T11:00:00")
    );

    const enriched = enrichMovimientos([
      apertura,
      ventaEfectivo,
      ventaTransferencia,
      ventaDebito,
    ]);

    expect(enriched).toHaveLength(4);

    // Chronological order: apertura (08:00), transfer (10:00), cash (10:30), debit (11:00)
    expect(enriched[0].descripcion).toContain("apertura");
    expect(enriched[1].ventaId).toBe(21); // transfer
    expect(enriched[2].ventaId).toBe(20); // cash
    expect(enriched[3].ventaId).toBe(22); // debit

    // Accumulated balance:
    // 08:00 apertura: +100k => 100k
    // 10:00 transfer: +0 => 100k (no cash impact)
    // 10:30 cash: +30k => 130k
    // 11:00 debit: +0 => 130k (no cash impact)
    expect(enriched[0].saldoAcumulado).toBe(100_000);
    expect(enriched[1].saldoAcumulado).toBe(100_000);
    expect(enriched[2].saldoAcumulado).toBe(130_000);
    expect(enriched[3].saldoAcumulado).toBe(130_000);
  });

  // ── calcularTotales only counts physical ───────────────────────────

  it("calcularTotales excludes non-cash projected rows from physical totals", async () => {
    const { calcularTotales } = await import("../caja-filters");

    const apertura = makeApertura(100_000);
    const ventaEfectivo = makeFisico({
      id: 2,
      monto: 50_000,
      ventaId: 20,
      fecha: new Date("2026-08-12T10:00:00"),
    });
    const ventaTransferencia = makeVentaNoEfectiva(
      21,
      "TRANSFERENCIA",
      80_000,
      new Date("2026-08-12T11:00:00")
    );

    const enriched = enrichMovimientos([apertura, ventaEfectivo, ventaTransferencia]);
    const totales = calcularTotales(enriched);

    // Only physical: apertura 100k + venta 50k = 150k ingresos, 0 egresos
    expect(totales.totalIngresos).toBe(150_000);
    expect(totales.totalEgresos).toBe(0);
    expect(totales.saldoFinal).toBe(150_000);
  });
});
