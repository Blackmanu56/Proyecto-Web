-- Backfill only explicit legacy non-cash payment origins.
-- EFECTIVO_CAJA is excluded because it was introduced as the column default and
-- cannot prove historical cash provenance. CUENTA_CORRIENTE_PROVEEDOR represents
-- an obligation rather than a completed payment. Existing payment distributions
-- are preserved in full, including mixed payments.

INSERT INTO "pagos_compra"
  ("compra_id", "medio", "monto", "observacion", "created_at")
SELECT
  c."id",
  c."origen_pago"::text,
  c."total",
  'LEGACY_BACKFILL_EXPLICIT_ORIGIN_V1',
  c."fecha"
FROM "compras" c
WHERE c."total" > 0
  AND c."origen_pago"::text IN (
    'TRANSFERENCIA_BANCARIA',
    'FONDOS_EXTERNOS'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "pagos_compra" p
    WHERE p."compra_id" = c."id"
  );
