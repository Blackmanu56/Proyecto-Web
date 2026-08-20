-- CreateEnum
CREATE TYPE "TipoMovimientoProducto" AS ENUM ('COMPRA', 'VENTA', 'RESTA_MANUAL', 'EDICION', 'REPOSICION_DIRECTA', 'REPOSICION_APROBADA');

-- CreateTable
CREATE TABLE "movimientos_producto" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoMovimientoProducto" NOT NULL,
    "cantidad_anterior" INTEGER NOT NULL,
    "cantidad_nueva" INTEGER NOT NULL,
    "compra_id" INTEGER,
    "venta_id" INTEGER,
    "motivo" TEXT NOT NULL,
    "observacion" TEXT,
    "cambios" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_producto_producto_id_created_at_idx" ON "movimientos_producto"("producto_id", "created_at");

-- CreateIndex
CREATE INDEX "movimientos_producto_usuario_id_idx" ON "movimientos_producto"("usuario_id");

-- CreateIndex
CREATE INDEX "movimientos_producto_tipo_idx" ON "movimientos_producto"("tipo");

-- AddForeignKey
ALTER TABLE "movimientos_producto" ADD CONSTRAINT "movimientos_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_producto" ADD CONSTRAINT "movimientos_producto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_producto" ADD CONSTRAINT "movimientos_producto_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_producto" ADD CONSTRAINT "movimientos_producto_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
