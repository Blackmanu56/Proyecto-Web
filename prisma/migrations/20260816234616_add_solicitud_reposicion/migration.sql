-- CreateTable
CREATE TABLE "solicitudes_reposicion" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "origen_pago" "OrigenPagoCompra" NOT NULL DEFAULT 'EFECTIVO_CAJA',
    "pagos" JSONB,
    "motivo" TEXT,
    "respuesta" TEXT,
    "solicitante_id" INTEGER NOT NULL,
    "aprobador_id" INTEGER,
    "compra_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto_en" TIMESTAMP(3),

    CONSTRAINT "solicitudes_reposicion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_reposicion_compra_id_key" ON "solicitudes_reposicion"("compra_id");

-- CreateIndex
CREATE INDEX "solicitudes_reposicion_estado_created_at_idx" ON "solicitudes_reposicion"("estado", "created_at");

-- CreateIndex
CREATE INDEX "solicitudes_reposicion_producto_id_idx" ON "solicitudes_reposicion"("producto_id");

-- AddForeignKey
ALTER TABLE "solicitudes_reposicion" ADD CONSTRAINT "solicitudes_reposicion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reposicion" ADD CONSTRAINT "solicitudes_reposicion_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reposicion" ADD CONSTRAINT "solicitudes_reposicion_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reposicion" ADD CONSTRAINT "solicitudes_reposicion_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reposicion" ADD CONSTRAINT "solicitudes_reposicion_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
