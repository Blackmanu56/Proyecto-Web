-- CreateTable
CREATE TABLE "pagos_compra" (
    "id" SERIAL NOT NULL,
    "compra_id" INTEGER NOT NULL,
    "medio" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "observacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_compra_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pagos_compra" ADD CONSTRAINT "pagos_compra_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
