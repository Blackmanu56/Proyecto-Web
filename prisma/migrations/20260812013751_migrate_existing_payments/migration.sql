-- Migrate existing single-payment data to the new PagoCompra table
-- This ensures backward compatibility while supporting multiple payment methods

INSERT INTO "pagos_compra" ("compra_id", "medio", "monto", "observacion", "created_at")
SELECT 
  "id" as "compra_id",
  "origen_pago" as "medio",
  "total" as "monto",
  NULL as "observacion",
  "fecha" as "created_at"
FROM "compras"
WHERE "total" > 0;

-- Verify the migration
-- SELECT "compra_id", "medio", "monto" FROM "pagos_compra" ORDER BY "compra_id";