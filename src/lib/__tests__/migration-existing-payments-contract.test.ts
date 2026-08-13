import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260812013751_migrate_existing_payments",
  "migration.sql",
);

const sql = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .trim();

describe("historical PagoCompra backfill migration", () => {
  it("backfills only explicit non-cash origins without touching existing payments", () => {
    expect(sql).toMatch(/c\."total"\s*>\s*0/i);
    expect(sql).toMatch(
      /c\."origen_pago"::text\s+IN\s*\(\s*'TRANSFERENCIA_BANCARIA'\s*,\s*'FONDOS_EXTERNOS'\s*\)/i,
    );
    expect(sql).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM "pagos_compra" p WHERE p\."compra_id"\s*=\s*c\."id"\s*\)/i,
    );
  });

  it("preserves provenance and the original purchase timestamp", () => {
    expect(sql).toContain("'LEGACY_BACKFILL_EXPLICIT_ORIGIN_V1'");
    expect(sql).toMatch(/c\."fecha"\s+FROM "compras" c/i);
  });

  it("does not hardcode purchase identities or ambiguous origins", () => {
    expect(sql).not.toMatch(/c\."id"\s+IN\s*\(/i);
    expect(sql).not.toMatch(/c\."id"\s*=\s*\d+/i);
    expect(sql).not.toMatch(/IN\s*\([^)]*'EFECTIVO_CAJA'/i);
    expect(sql).not.toMatch(/IN\s*\([^)]*'CUENTA_CORRIENTE_PROVEEDOR'/i);
  });
});
