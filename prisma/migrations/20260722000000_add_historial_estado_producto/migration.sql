-- Create enums
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE "MotivoEstadoProducto" AS ENUM ('VENCIDO', 'DEFECTUOSO', 'DISCONTINUADO', 'BAJA_TEMPORAL', 'YA_NO_SE_COMERCIALIZA', 'OTRO', 'REACTIVACION');

-- Create table
CREATE TABLE "historial_estado_producto" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "estado_anterior" "EstadoProducto" NOT NULL,
    "estado_nuevo" "EstadoProducto" NOT NULL,
    "motivo" "MotivoEstadoProducto" NOT NULL,
    "observacion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "historial_estado_producto_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "historial_estado_producto_producto_id_fecha_idx" ON "historial_estado_producto"("producto_id", "fecha");
CREATE INDEX "historial_estado_producto_usuario_id_idx" ON "historial_estado_producto"("usuario_id");

-- Add foreign keys
ALTER TABLE "historial_estado_producto" ADD CONSTRAINT "historial_estado_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "historial_estado_producto" ADD CONSTRAINT "historial_estado_producto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
