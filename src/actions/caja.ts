"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { calcularEfectivoFisico } from "@/lib/caja-balance";
import { calcularSaldoCuentaFinanciera } from "@/lib/cuenta-financiera";
import { getErrorMessage } from "@/lib/error-message";

/**
 * Obtiene la caja actualmente abierta (si existe) junto con sus movimientos recientes
 * y las ventas no efectivas realizadas durante el período de la caja abierta.
 */
export async function getCajaActiva() {
  try {
    const caja = await prisma.caja.findFirst({
      where: { estado: "ABIERTA" },
      include: {
        usuario: true,
        movimientos: {
          include: {
            usuario: true,
            venta: {
              include: {
                cliente: {
                  select: { id: true, nombre: true, dni: true, cuit: true },
                },
                detalles: {
                  include: {
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
              include: {
                proveedor: { select: { id: true, nombre: true } },
                pagos: {
                  select: {
                    id: true,
                    medio: true,
                    monto: true,
                    observacion: true,
                  },
                },
                detalles: {
                  include: {
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
          orderBy: {
            fecha: "desc",
          },
        },
      },
    });

    if (!caja) return null;

    // Ventas no efectivas realizadas durante el período de esta caja.
    // No crean MovimientoCaja, así que no están en caja.movimientos.
    // Se buscan por rango temporal [fechaApertura, now()] y metodoPago !== EFECTIVO.
    const ventaIdsEnMovimientos = new Set(
      caja.movimientos
        .filter((m) => m.ventaId != null)
        .map((m) => m.ventaId as number)
    );

    const ventasNoEfectivas = await prisma.venta.findMany({
      where: {
        fecha: { gte: caja.fechaApertura },
        metodoPago: { not: "EFECTIVO" },
        // Excluir ventas que por algún motivo ya tengan movimiento asociado
        id: ventaIdsEnMovimientos.size > 0
          ? { notIn: Array.from(ventaIdsEnMovimientos) }
          : undefined,
      },
      include: {
        usuario: {
          select: { id: true, username: true, nombreCompleto: true },
        },
        cliente: {
          select: { id: true, nombre: true, dni: true, cuit: true },
        },
        detalles: {
          include: {
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
      orderBy: { fecha: "asc" },
    });

    return { ...caja, ventasNoEfectivas };
  } catch (error) {
    console.error("Error en getCajaActiva:", error);
    return null;
  }
}

/**
 * Obtiene el historial de cajas cerradas
 */
export async function getHistorialCajas() {
  try {
    return await prisma.caja.findMany({
      where: { estado: "CERRADA" },
      include: {
        usuario: true,
      },
      orderBy: {
        fechaApertura: "desc",
      },
    });
  } catch (error) {
    console.error("Error en getHistorialCajas:", error);
    return [];
  }
}

/**
 * Abre una nueva caja con un monto inicial
 */
export async function abrirCaja(montoInicial: number) {
  const session = await requirePermission("caja.abrir", await getSession());

  if (montoInicial < 0) {
    throw new Error("El monto inicial no puede ser negativo.");
  }

  try {
    const res = await prisma.$transaction(async (tx) => {
      // 1. Validar que no haya cajas abiertas
      const cajaExistente = await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
      });

      if (cajaExistente) {
        throw new Error("Ya existe una caja abierta en el sistema.");
      }

      // 2. Crear nueva caja
      const nuevaCaja = await tx.caja.create({
        data: {
          usuarioId: session.userId,
          montoInicial: montoInicial,
          totalVentas: 0.0,
          estado: "ABIERTA",
        },
      });

      // 3. Registrar movimiento inicial de apertura
      await tx.movimientoCaja.create({
        data: {
          cajaId: nuevaCaja.id,
          usuarioId: session.userId,
          tipo: "INGRESO",
          monto: montoInicial,
          descripcion: "Saldo inicial de apertura de caja",
        },
      });

      return nuevaCaja;
    });

    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { success: true, cajaId: res.id };
  } catch (error: unknown) {
    console.error("Error en abrirCaja:", error);
    return { error: getErrorMessage(error, "Error al abrir la caja") };
  }
}

/**
 * Cierra la caja activa asentando la fecha final
 */
export type CerrarCajaResult =
  | {
      success: true;
      efectivoEsperado: number;
      diferencia: number;
    }
  | {
      success: false;
      error: string;
    };

export async function cerrarCaja(
  id: number,
  totalContado: number,
  observacion?: string
): Promise<CerrarCajaResult> {
  await requirePermission("caja.cerrar", await getSession());

  if (!Number.isFinite(totalContado) || totalContado < 0) {
    return {
      success: false,
      error: "Debe ingresar un monto contado válido para cerrar la caja.",
    };
  }

  try {
    const cierre = await prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findUnique({
        where: { id },
        include: {
          movimientos: {
            select: { tipo: true, monto: true },
          },
        },
      });

      if (!caja) {
        throw new Error("Caja no encontrada.");
      }

      if (caja.estado !== "ABIERTA") {
        throw new Error("La caja ya se encuentra cerrada.");
      }

      const efectivoEsperado = calcularEfectivoFisico(
        caja.movimientos
      ).efectivoEsperado;
      const diferencia = totalContado - efectivoEsperado;

      await tx.caja.update({
        where: { id },
        data: {
          estado: "CERRADA",
          fechaCierre: new Date(),
          totalContado,
          observacionCierre: observacion?.trim() || null,
        },
      });

      return { efectivoEsperado, diferencia };
    });

    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { success: true, ...cierre };
  } catch (error: unknown) {
    console.error("Error en cerrarCaja:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Error al cerrar la caja"),
    };
  }
}

/**
 * Registra un movimiento de gasto (Egreso) manual en la caja activa
 */
export async function registrarGastoCaja(formData: FormData) {
  const session = await requirePermission("caja.egresos", await getSession());

  const descripcion = formData.get("descripcion") as string;
  const monto = Number(formData.get("monto"));

  if (!descripcion || descripcion.trim().length < 3) {
    throw new Error("Ingrese una descripción del gasto de al menos 3 caracteres.");
  }

  if (!monto || monto <= 0) {
    throw new Error("El monto del gasto debe ser mayor a 0.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Verificar caja abierta
      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
      });

      if (!cajaAbierta) {
        throw new Error("Debe abrir la caja para registrar egresos manuales.");
      }

      // 2. Registrar egreso en Caja
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId: session.userId,
          tipo: "EGRESO",
          monto: monto,
          descripcion: `Gasto: ${descripcion.trim()}`,
        },
      });

      // 3. Descontar total caja
      await tx.caja.update({
        where: { id: cajaAbierta.id },
        data: {
          totalVentas: {
            decrement: monto,
          },
        },
      });
    });

    revalidatePath("/caja");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en registrarGastoCaja:", error);
    return { error: getErrorMessage(error, "Error al registrar el gasto") };
  }
}

export type AjusteBancoInput = {
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  motivo: string;
  referencia?: string;
};

export type AjusteBancoResult =
  | {
      success: true;
      saldoActual: number;
      saldoResultante: number;
    }
  | {
      success: false;
      error: string;
    };

export async function registrarAjusteBanco(
  input: AjusteBancoInput
): Promise<AjusteBancoResult> {
  const session = await requirePermission("caja.ver", await getSession());

  if (session.role !== "ADMINISTRADOR") {
    return {
      success: false,
      error: "Solo un administrador puede ajustar el Banco.",
    };
  }

  if (input.tipo !== "INGRESO" && input.tipo !== "EGRESO") {
    return { success: false, error: "Tipo de ajuste inválido." };
  }

  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { success: false, error: "El monto debe ser mayor a 0." };
  }

  const motivo = input.motivo?.trim();
  if (!motivo) {
    return { success: false, error: "Debe ingresar un motivo para el ajuste." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cuentaBanco = await tx.cuentaFinanciera.findFirst({
        where: {
          tipo: "BANCO",
          esPrincipal: true,
          activa: true,
        },
        include: {
          movimientos: {
            select: { tipo: true, monto: true },
          },
        },
      });

      if (!cuentaBanco) {
        throw new Error("No hay una cuenta Banco principal activa configurada.");
      }

      const saldoActual = calcularSaldoCuentaFinanciera(
        cuentaBanco.saldoInicial,
        cuentaBanco.movimientos
      ).saldoActual;

      if (input.tipo === "EGRESO" && monto > saldoActual) {
        return {
          success: false as const,
          error: "El egreso supera el saldo disponible del Banco.",
        };
      }

      await tx.movimientoFinanciero.create({
        data: {
          cuentaFinancieraId: cuentaBanco.id,
          tipo: input.tipo,
          monto,
          descripcion: motivo,
          usuarioId: session.userId,
          referencia: input.referencia?.trim() || null,
        },
      });

      return {
        success: true as const,
        saldoActual,
        saldoResultante:
          input.tipo === "INGRESO" ? saldoActual + monto : saldoActual - monto,
      };
    });

    if (!result.success) return result;

    revalidatePath("/caja");
    return result;
  } catch (error: unknown) {
    console.error("Error en registrarAjusteBanco:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Error al registrar el ajuste del Banco."),
    };
  }
}
