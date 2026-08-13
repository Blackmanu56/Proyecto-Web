import React from "react";
import { getSession } from "@/lib/auth.server";
import { getCajaActiva, getHistorialCajas } from "@/actions/caja";
import CajaTerminal from "@/components/forms/CajaTerminal";
import { Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { calcularEfectivoFisico } from "@/lib/caja-balance";
import {
  calcularResumenBancoPeriodo,
  calcularSaldosFinancieros,
} from "@/lib/cuenta-financiera";

export default async function CajaPage() {
  const session = await getSession();
  const userRole = session?.role || "ENCARGADO_VENTAS";

  let currentUser = null;
  if (session?.userId) {
    currentUser = await prisma.usuario.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        nombreCompleto: true,
        fotoUrl: true,
        rol: { select: { id: true, nombre: true } },
      },
    });
  }

  const [cajaActiva, historialCajas] = await Promise.all([
    getCajaActiva(),
    getHistorialCajas(),
  ]);

  // Saldos financieros (Banco, Por acreditar, Total disponible)
  const [cuentasBanco, cuentasPorAcreditar] = await Promise.all([
    prisma.cuentaFinanciera.findMany({
      where: { tipo: "BANCO", esPrincipal: true, activa: true },
      include: {
        movimientos: {
          select: {
            id: true,
            tipo: true,
            monto: true,
            fecha: true,
            descripcion: true,
            ventaId: true,
            compraId: true,
            usuario: { select: { username: true, nombreCompleto: true } },
            venta: {
              select: {
                id: true,
                total: true,
                fecha: true,
                metodoPago: true,
                descuentoTipo: true,
                montoDescuento: true,
                tipoComprobante: true,
                cliente: { select: { id: true, nombre: true, dni: true, cuit: true } },
                usuario: { select: { id: true, username: true, nombreCompleto: true } },
                detalles: {
                  select: {
                    id: true,
                    cantidad: true,
                    precioUnitario: true,
                    subtotal: true,
                    producto: {
                      select: {
                        id: true,
                        nombre: true,
                        marca: true,
                        categoria: { select: { id: true, nombre: true } },
                      },
                    },
                  },
                },
              },
            },
            compra: {
              select: {
                id: true,
                total: true,
                proveedor: { select: { id: true, nombre: true } },
                pagos: {
                  select: { id: true, medio: true, monto: true, observacion: true },
                },
                detalles: {
                  select: {
                    id: true,
                    cantidad: true,
                    costoUnitario: true,
                    subtotal: true,
                    producto: {
                      select: {
                        id: true,
                        nombre: true,
                        marca: true,
                        cantidad: true,
                        categoria: { select: { id: true, nombre: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ fecha: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.cuentaFinanciera.findMany({
      where: { tipo: "POR_ACREDITAR", activa: true },
      include: { movimientos: { select: { tipo: true, monto: true } } },
    }),
  ]);

  const efectivoFisico = cajaActiva
    ? calcularEfectivoFisico(cajaActiva.movimientos).efectivoEsperado
    : 0;

  const saldosFinancieros = calcularSaldosFinancieros(
    cuentasBanco,
    cuentasPorAcreditar,
    efectivoFisico
  );
  const resumenBancoPeriodo = calcularResumenBancoPeriodo(
    cuentasBanco,
    cajaActiva?.fechaApertura ?? null
  );
  const movimientosBanco = cuentasBanco.flatMap((cuenta) => cuenta.movimientos);

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-2 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <Coins size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Control de Caja
            </h1>
          </div>
        </div>

        {/* Terminal Operativo de Caja (Client Component) */}
        <div className="flex-1 min-h-0">
          <CajaTerminal
            cajaActiva={cajaActiva as React.ComponentProps<typeof CajaTerminal>["cajaActiva"]}
            historialCajas={historialCajas as React.ComponentProps<typeof CajaTerminal>["historialCajas"]}
            userRole={userRole}
            user={currentUser as React.ComponentProps<typeof CajaTerminal>["user"]}
            saldosFinancieros={saldosFinancieros}
            resumenBancoPeriodo={resumenBancoPeriodo}
            movimientosBanco={movimientosBanco}
          />
        </div>
      </div>
    </div>
  );
}
