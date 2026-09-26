-- CreateEnum
CREATE TYPE "TipoSolicitudStock" AS ENUM ('RESTA', 'REPOSICION');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('SOLICITUD_CREADA', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA', 'SOLICITUD_CANCELADA', 'STOCK_CRITICO', 'STOCK_AGOTADO', 'STOCK_RESTADO', 'STOCK_RECARGADO', 'VENTA_CREADA', 'CAJA_APERTURA_PENDIENTE', 'SOLICITUD_CAJA_CREADA');

-- AlterEnum
ALTER TYPE "TipoMovimientoProducto" ADD VALUE 'SOLICITUD_RESTA_APROBADA';

-- AlterTable
ALTER TABLE "cajas" ADD COLUMN     "monto_inicial_banco" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "movimientos_producto" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "solicitudes_stock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "tipo" "TipoSolicitudStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "solicitanteId" INTEGER NOT NULL,
    "resueltoPorId" INTEGER,
    "observacionResolucion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "solicitudes_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_caja" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "solicitante_id" INTEGER NOT NULL,
    "aprobador_id" INTEGER,
    "monto" DOUBLE PRECISION,
    "motivo" TEXT,
    "motivo_rechazo" TEXT,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMP(3),
    "datos_extra" JSONB,

    CONSTRAINT "solicitudes_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_precio" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "solicitante_id" INTEGER NOT NULL,
    "aprobador_id" INTEGER,
    "precio_compra_actual" DOUBLE PRECISION NOT NULL,
    "precio_compra_nuevo" DOUBLE PRECISION NOT NULL,
    "precio_venta_actual" DOUBLE PRECISION NOT NULL,
    "precio_venta_nuevo" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "observacion_resolucion" TEXT,
    "ajuste_precio_id" INTEGER,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMP(3),

    CONSTRAINT "solicitudes_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "solicitudStockId" INTEGER,
    "solicitudReposicionId" INTEGER,
    "solicitud_caja_id" INTEGER,
    "solicitud_precio_id" INTEGER,
    "caja_id" INTEGER,
    "productoId" INTEGER,
    "entidad" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_notificacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferencias_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_precio" (
    "id" SERIAL NOT NULL,
    "tipo_ajuste" TEXT NOT NULL,
    "valor" DOUBLE PRECISION,
    "precios_afectados" TEXT NOT NULL,
    "filtros" JSONB,
    "redondeo" TEXT NOT NULL DEFAULT 'SIN_REDONDEO',
    "motivo" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "cantidad_productos" INTEGER NOT NULL DEFAULT 1,
    "es_masivo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuste_precio_detalles" (
    "id" SERIAL NOT NULL,
    "ajuste_precio_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "precio_compra_anterior" DOUBLE PRECISION NOT NULL,
    "precio_compra_nuevo" DOUBLE PRECISION NOT NULL,
    "precio_venta_anterior" DOUBLE PRECISION NOT NULL,
    "precio_venta_nuevo" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ajuste_precio_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_stock_productoId_idx" ON "solicitudes_stock"("productoId");

-- CreateIndex
CREATE INDEX "solicitudes_stock_solicitanteId_idx" ON "solicitudes_stock"("solicitanteId");

-- CreateIndex
CREATE INDEX "solicitudes_stock_estado_idx" ON "solicitudes_stock"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_stock_createdAt_idx" ON "solicitudes_stock"("createdAt");

-- CreateIndex
CREATE INDEX "solicitudes_precio_producto_id_idx" ON "solicitudes_precio"("producto_id");

-- CreateIndex
CREATE INDEX "solicitudes_precio_solicitante_id_idx" ON "solicitudes_precio"("solicitante_id");

-- CreateIndex
CREATE INDEX "solicitudes_precio_estado_idx" ON "solicitudes_precio"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_precio_fecha_solicitud_idx" ON "solicitudes_precio"("fecha_solicitud");

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_leida_idx" ON "notificaciones"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "notificaciones_createdAt_idx" ON "notificaciones"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_notificacion_usuarioId_tipo_key" ON "preferencias_notificacion"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "ajustes_precio_usuario_id_idx" ON "ajustes_precio"("usuario_id");

-- CreateIndex
CREATE INDEX "ajustes_precio_created_at_idx" ON "ajustes_precio"("created_at");

-- CreateIndex
CREATE INDEX "ajuste_precio_detalles_ajuste_precio_id_idx" ON "ajuste_precio_detalles"("ajuste_precio_id");

-- CreateIndex
CREATE INDEX "ajuste_precio_detalles_producto_id_idx" ON "ajuste_precio_detalles"("producto_id");

-- AddForeignKey
ALTER TABLE "solicitudes_stock" ADD CONSTRAINT "solicitudes_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_stock" ADD CONSTRAINT "solicitudes_stock_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_stock" ADD CONSTRAINT "solicitudes_stock_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_caja" ADD CONSTRAINT "solicitudes_caja_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_caja" ADD CONSTRAINT "solicitudes_caja_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_precio" ADD CONSTRAINT "solicitudes_precio_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_precio" ADD CONSTRAINT "solicitudes_precio_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_precio" ADD CONSTRAINT "solicitudes_precio_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_solicitudStockId_fkey" FOREIGN KEY ("solicitudStockId") REFERENCES "solicitudes_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_solicitudReposicionId_fkey" FOREIGN KEY ("solicitudReposicionId") REFERENCES "solicitudes_reposicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_solicitud_caja_id_fkey" FOREIGN KEY ("solicitud_caja_id") REFERENCES "solicitudes_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_solicitud_precio_id_fkey" FOREIGN KEY ("solicitud_precio_id") REFERENCES "solicitudes_precio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_notificacion" ADD CONSTRAINT "preferencias_notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_precio" ADD CONSTRAINT "ajustes_precio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_precio_detalles" ADD CONSTRAINT "ajuste_precio_detalles_ajuste_precio_id_fkey" FOREIGN KEY ("ajuste_precio_id") REFERENCES "ajustes_precio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_precio_detalles" ADD CONSTRAINT "ajuste_precio_detalles_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
