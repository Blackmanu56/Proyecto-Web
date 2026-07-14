"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";

/**
 * Obtiene la caja actualmente abierta (si existe) junto con sus movimientos recientes
 */
export async function getCajaActiva() {
  try {
    return await prisma.caja.findFirst({
      where: { estado: "ABIERTA" },
      include: {
        usuario: true,
        movimientos: {
          include: {
            usuario: true,
          },
          orderBy: {
            fecha: "desc",
          },
        },
      },
    });
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
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

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
  } catch (error: any) {
    console.error("Error en abrirCaja:", error);
    return { error: error.message || "Error al abrir la caja" };
  }
}

/**
 * Cierra la caja activa asentando la fecha final
 */
export async function cerrarCaja(id: number) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findUnique({
        where: { id },
      });

      if (!caja) {
        throw new Error("Caja no encontrada.");
      }

      if (caja.estado !== "ABIERTA") {
        throw new Error("La caja ya se encuentra cerrada.");
      }

      // 1. Cerrar caja
      await tx.caja.update({
        where: { id },
        data: {
          estado: "CERRADA",
          fechaCierre: new Date(),
        },
      });
    });

    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error en cerrarCaja:", error);
    return { error: error.message || "Error al cerrar la caja" };
  }
}

/**
 * Registra un movimiento de gasto (Egreso) manual en la caja activa
 */
export async function registrarGastoCaja(formData: FormData) {
  const session = await getSession();
  if (!session || !["ADMINISTRADOR", "ENCARGADO_VENTAS"].includes(session.role)) {
    throw new Error("No tiene permisos para realizar esta acción.");
  }

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
  } catch (error: any) {
    console.error("Error en registrarGastoCaja:", error);
    return { error: error.message || "Error al registrar el gasto" };
  }
}
