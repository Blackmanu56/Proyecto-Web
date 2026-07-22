-- Baseline: capture columns that existed in the DB but were missing from migration history
-- These columns already exist in the database; this migration records them for Prisma's migration tracking

-- clientes
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "cuit" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_cuit_key" ON "clientes"("cuit") WHERE "cuit" IS NOT NULL;

-- productos
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "codigo" TEXT;
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "imagen" TEXT;
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "marca" TEXT;

-- proveedores
ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "contacto_responsable" TEXT;
ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "permisos" TEXT;

-- usuarios
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "correo" TEXT;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "dni" TEXT NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "foto_actualizada_en" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "foto_url" TEXT;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "nombre_completo" TEXT NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "telefono" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_dni_key" ON "usuarios"("dni") WHERE "dni" IS NOT NULL;

-- ventas
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "cuotas" INTEGER;
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "descuento_tipo" TEXT;
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "monto_descuento" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "tipo_comprobante" TEXT;
