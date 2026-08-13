-- CreateEnum
CREATE TYPE "TipoCuentaFinanciera" AS ENUM ('BANCO', 'POR_ACREDITAR', 'BILLETERA', 'OTRA');

-- CreateEnum
CREATE TYPE "TipoMovimientoFinanciero" AS ENUM ('INGRESO', 'EGRESO');

-- CreateTable
CREATE TABLE "cuentas_financieras" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuentaFinanciera" NOT NULL,
    "saldo_inicial" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" SERIAL NOT NULL,
    "cuenta_financiera_id" INTEGER NOT NULL,
    "tipo" "TipoMovimientoFinanciero" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "venta_id" INTEGER,
    "compra_id" INTEGER,
    "referencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_financieros_cuenta_financiera_id_fecha_idx" ON "movimientos_financieros"("cuenta_financiera_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_financieros_venta_id_idx" ON "movimientos_financieros"("venta_id");

-- CreateIndex
CREATE INDEX "movimientos_financieros_compra_id_idx" ON "movimientos_financieros"("compra_id");

-- CreateIndex (único parcial: solo un Banco puede ser principal)
CREATE UNIQUE INDEX "idx_one_banco_principal" ON "cuentas_financieras"((1)) WHERE tipo = 'BANCO' AND es_principal = true;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_cuenta_financiera_id_fkey" FOREIGN KEY ("cuenta_financiera_id") REFERENCES "cuentas_financieras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
