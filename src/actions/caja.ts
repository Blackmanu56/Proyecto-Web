"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth.server";
import { requirePermission } from "@/lib/auth-permissions";
import { calcularEfectivoFisico } from "@/lib/caja-balance";
import { calcularSaldoCuentaFinanciera } from "@/lib/cuenta-financiera";
import { getErrorMessage } from "@/lib/error-message";

type SolicitudCajaTipo = "APERTURA" | "CIERRE" | "AJUSTE_EFECTIVO" | "AJUSTE_BANCO" | "EGRESO";

/**
 * Notifica a todos los administradores activos sobre una solicitud de caja creada.
 */
async function notificarAdminsSolicitudCaja(params: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  solicitudId: number;
  solicitanteNombre: string;
  tipo: SolicitudCajaTipo;
  monto?: number | null;
  motivo?: string | null;
}) {
  const { tx, solicitudId, solicitanteNombre, tipo, monto, motivo } = params;

  const roles = await tx.rol.findMany({ select: { id: true, nombre: true } });
  const rolAdmin = roles.find((r) => r.nombre === "ADMINISTRADOR");
  if (!rolAdmin) return;

  const admins = await tx.usuario.findMany({
    where: { rolId: rolAdmin.id, activo: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const tipoLabels: Record<SolicitudCajaTipo, string> = {
    APERTURA: "abrir la caja",
    CIERRE: "cerrar la caja",
    AJUSTE_EFECTIVO: "ajustar el efectivo",
    AJUSTE_BANCO: "ajustar el Banco",
    EGRESO: "registrar un egreso / gasto",
  };

  const montoStr = monto != null ? ` con monto $${monto.toLocaleString("es-AR")}` : "";
  const motivoStr = motivo ? ` — Motivo: ${motivo}` : "";

  await tx.notificacion.createMany({
    data: admins.map((admin) => ({
      usuarioId: admin.id,
      tipo: "SOLICITUD_CAJA_CREADA" as const,
      titulo: `Solicitud de caja: ${tipo}`,
      mensaje: `${solicitanteNombre} pidió ${tipoLabels[tipo]}${montoStr}${motivoStr}.`,
      entidad: "solicitud_caja",
      solicitudCajaId: solicitudId,
    })),
  });
}

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
    const ventaIdsEnMovimientos = new Set(
      caja.movimientos
        .filter((m) => m.ventaId != null)
        .map((m) => m.ventaId as number)
    );

    const ventasNoEfectivas = await prisma.venta.findMany({
      where: {
        fecha: { gte: caja.fechaApertura },
        metodoPago: { not: "EFECTIVO" },
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
 * Abre una nueva caja con montos iniciales de efectivo y banco.
 * Si el usuario NO es ADMINISTRADOR, crea una SolicitudCaja pendiente
 * y notifica a los administradores para su aprobación.
 */
export async function abrirCaja(montoInicial: number, montoInicialBanco: number) {
  const session = await requirePermission("caja.abrir", await getSession());

  if (montoInicial < 0) {
    throw new Error("El monto inicial de efectivo no puede ser negativo.");
  }
  if (montoInicialBanco < 0) {
    throw new Error("El saldo bancario no puede ser negativo.");
  }

  const isAdmin = session.role === "ADMINISTRADOR";

  if (!isAdmin) {
    try {
      const res = await prisma.$transaction(async (tx) => {
        const cajaExistente = await tx.caja.findFirst({
          where: { estado: { in: ["ABIERTA", "PENDIENTE"] } },
        });
        if (cajaExistente) {
          throw new Error("Ya existe una caja abierta o pendiente de aprobación en el sistema.");
        }

        const solicitud = await tx.solicitudCaja.create({
          data: {
            tipo: "APERTURA",
            estado: "PENDIENTE",
            solicitanteId: session.userId,
            monto: montoInicial,
            datosExtra: { montoInicialEfectivo: montoInicial, saldoBanco: montoInicialBanco },
          },
        });

        await notificarAdminsSolicitudCaja({
          tx,
          solicitudId: solicitud.id,
          solicitanteNombre: session.username,
          tipo: "APERTURA",
          monto: montoInicial,
        });

        return solicitud;
      });

      revalidatePath("/caja");
      return { success: true, needsApproval: true, solicitudId: res.id };
    } catch (error: unknown) {
      console.error("Error en abrirCaja (solicitud):", error);
      return { error: getErrorMessage(error, "Error al crear la solicitud de apertura") };
    }
  }

  try {
    const res = await prisma.$transaction(async (tx) => {
      const cajaExistente = await tx.caja.findFirst({
        where: { estado: { in: ["ABIERTA", "PENDIENTE"] } },
      });

      if (cajaExistente) {
        throw new Error("Ya existe una caja abierta o pendiente de aprobación en el sistema.");
      }

      const nuevaCaja = await tx.caja.create({
        data: {
          usuarioId: session.userId,
          montoInicial: montoInicial,
          montoInicialBanco: montoInicialBanco,
          totalVentas: 0.0,
          estado: "ABIERTA",
        },
      });

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
    return { success: true, cajaId: res.id, needsApproval: false };
  } catch (error: unknown) {
    console.error("Error en abrirCaja:", error);
    return { error: getErrorMessage(error, "Error al abrir la caja") };
  }
}

/**
 * Obtiene las solicitudes de caja pendientes. Solo ADMINISTRADOR.
 */
export async function getSolicitudesCajaPendientes() {
  const session = await requirePermission("caja.ver", await getSession());

  if (session.role !== "ADMINISTRADOR") return [];

  try {
    return await prisma.solicitudCaja.findMany({
      where: { estado: "PENDIENTE" },
      include: {
        solicitante: { select: { id: true, username: true, nombreCompleto: true } },
      },
      orderBy: { fechaSolicitud: "desc" },
    });
  } catch (error) {
    console.error("Error en getSolicitudesCajaPendientes:", error);
    return [];
  }
}

/**
 * Obtiene las solicitudes de caja del usuario actual (para mostrar estado).
 */
export async function getSolicitudesCajaUsuario() {
  const session = await requirePermission("caja.ver", await getSession());

  try {
    return await prisma.solicitudCaja.findMany({
      where: {
        solicitanteId: session.userId,
        estado: "PENDIENTE",
      },
      orderBy: { fechaSolicitud: "desc" },
      take: 5,
    });
  } catch (error) {
    console.error("Error en getSolicitudesCajaUsuario:", error);
    return [];
  }
}

/**
 * Aprueba una solicitud de caja. Solo ADMINISTRADOR.
 * Ejecuta la acción correspondiente al tipo de solicitud.
 */
export async function aprobarSolicitudCaja(solicitudId: number) {
  const session = await requirePermission("caja.ver", await getSession());

  if (session.role !== "ADMINISTRADOR") {
    return { error: "Solo un administrador puede aprobar solicitudes de caja." };
  }

  try {
    const solicitud = await prisma.solicitudCaja.findUnique({
      where: { id: solicitudId },
      include: { solicitante: true },
    });

    if (!solicitud) {
      return { error: "Solicitud no encontrada." };
    }
    if (solicitud.estado !== "PENDIENTE") {
      return { error: "La solicitud ya fue resuelta." };
    }

    const datos = solicitud.datosExtra as Record<string, unknown> | null;

    await prisma.$transaction(async (tx) => {
      // Mark solicitud as approved
      await tx.solicitudCaja.update({
        where: { id: solicitudId },
        data: {
          estado: "APROBADA",
          aprobadorId: session.userId,
          fechaResolucion: new Date(),
        },
      });

      switch (solicitud.tipo) {
        case "APERTURA": {
          const montoInicial = Number(datos?.montoInicialEfectivo ?? solicitud.monto ?? 0);
          const saldoBanco = Number(datos?.saldoBanco ?? 0);

          const nuevaCaja = await tx.caja.create({
            data: {
              usuarioId: solicitud.solicitanteId,
              montoInicial,
              montoInicialBanco: saldoBanco,
              totalVentas: 0.0,
              estado: "ABIERTA",
            },
          });

          await tx.movimientoCaja.create({
            data: {
              cajaId: nuevaCaja.id,
              usuarioId: solicitud.solicitanteId,
              tipo: "INGRESO",
              monto: montoInicial,
              descripcion: "Saldo inicial de apertura de caja",
            },
          });
          break;
        }

        case "CIERRE": {
          const cajaAbierta = await tx.caja.findFirst({
            where: { estado: "ABIERTA" },
            include: { movimientos: { select: { tipo: true, monto: true } } },
          });

          if (!cajaAbierta) {
            throw new Error("No hay caja abierta para cerrar.");
          }

          const efectivoContado = Number(datos?.efectivoContado ?? solicitud.monto ?? 0);

          await tx.caja.update({
            where: { id: cajaAbierta.id },
            data: {
              estado: "CERRADA",
              fechaCierre: new Date(),
              totalContado: efectivoContado,
              observacionCierre: solicitud.motivo?.trim() || null,
            },
          });
          break;
        }

        case "AJUSTE_EFECTIVO": {
          const cajaAbierta = await tx.caja.findFirst({
            where: { estado: "ABIERTA" },
          });

          if (!cajaAbierta) {
            throw new Error("No hay caja abierta para ajustar el efectivo.");
          }

          const tipoAjuste = String(datos?.tipo ?? "INGRESO") as "INGRESO" | "EGRESO";
          const monto = Number(solicitud.monto ?? 0);
          const motivo = String(datos?.motivo ?? solicitud.motivo ?? "");

          await tx.movimientoCaja.create({
            data: {
              cajaId: cajaAbierta.id,
              usuarioId: solicitud.solicitanteId,
              tipo: tipoAjuste,
              monto,
              descripcion: `[AJUSTE_EFECTIVO] ${motivo}`,
            },
          });

          if (tipoAjuste === "INGRESO") {
            await tx.caja.update({
              where: { id: cajaAbierta.id },
              data: { totalVentas: { increment: monto } },
            });
          } else {
            await tx.caja.update({
              where: { id: cajaAbierta.id },
              data: { totalVentas: { decrement: monto } },
            });
          }
          break;
        }

        case "AJUSTE_BANCO": {
          const cuentaBanco = await tx.cuentaFinanciera.findFirst({
            where: { tipo: "BANCO", esPrincipal: true, activa: true },
          });

          if (!cuentaBanco) {
            throw new Error("No hay una cuenta Banco principal activa configurada.");
          }

          const tipoAjuste = String(datos?.tipo ?? "INGRESO") as "INGRESO" | "EGRESO";
          const monto = Number(solicitud.monto ?? 0);
          const motivo = String(datos?.motivo ?? solicitud.motivo ?? "");
          const referencia = String(datos?.referencia ?? "");

          await tx.movimientoFinanciero.create({
            data: {
              cuentaFinancieraId: cuentaBanco.id,
              tipo: tipoAjuste,
              monto,
              descripcion: motivo,
              usuarioId: solicitud.solicitanteId,
              referencia: referencia || null,
            },
          });
          break;
        }

        case "EGRESO": {
          const metodoPago = String(datos?.metodoPago ?? "EFECTIVO");
          const monto = Number(solicitud.monto ?? 0);
          const descripcion = String(solicitud.motivo ?? datos?.descripcion ?? "");

          if (metodoPago === "EFECTIVO") {
            const cajaAbierta = await tx.caja.findFirst({
              where: { estado: "ABIERTA" },
            });
            if (!cajaAbierta) {
              throw new Error("No hay caja abierta para registrar el gasto.");
            }
            await tx.movimientoCaja.create({
              data: {
                cajaId: cajaAbierta.id,
                usuarioId: solicitud.solicitanteId,
                tipo: "EGRESO",
                monto,
                descripcion: `Gasto: ${descripcion}`,
              },
            });
            await tx.caja.update({
              where: { id: cajaAbierta.id },
              data: { totalVentas: { decrement: monto } },
            });
          } else {
            const cuentaBanco = await tx.cuentaFinanciera.findFirst({
              where: { tipo: "BANCO", esPrincipal: true, activa: true },
            });
            if (!cuentaBanco) {
              throw new Error("No hay una cuenta Banco principal activa configurada.");
            }
            await tx.movimientoFinanciero.create({
              data: {
                cuentaFinancieraId: cuentaBanco.id,
                tipo: "EGRESO",
                monto,
                descripcion: `Gasto: ${descripcion}`,
                usuarioId: solicitud.solicitanteId,
              },
            });
          }
          break;
        }
      }

      // Notify the requester
      await tx.notificacion.create({
        data: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_APROBADA",
          titulo: `Solicitud de caja aprobada`,
          mensaje: `Tu solicitud de ${solicitud.tipo.toLowerCase().replace("_", " ")} fue aprobada por ${session.username}.`,
          entidad: "solicitud_caja",
          solicitudCajaId: solicitudId,
        },
      });
    });

    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en aprobarSolicitudCaja:", error);
    return { error: getErrorMessage(error, "Error al aprobar la solicitud") };
  }
}

/**
 * Rechaza una solicitud de caja. Solo ADMINISTRADOR.
 */
export async function rechazarSolicitudCaja(solicitudId: number, motivoRechazo?: string) {
  const session = await requirePermission("caja.ver", await getSession());

  if (session.role !== "ADMINISTRADOR") {
    return { error: "Solo un administrador puede rechazar solicitudes de caja." };
  }

  try {
    const solicitud = await prisma.solicitudCaja.findUnique({
      where: { id: solicitudId },
      include: { solicitante: true },
    });

    if (!solicitud) {
      return { error: "Solicitud no encontrada." };
    }
    if (solicitud.estado !== "PENDIENTE") {
      return { error: "La solicitud ya fue resuelta." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudCaja.update({
        where: { id: solicitudId },
        data: {
          estado: "RECHAZADA",
          aprobadorId: session.userId,
          fechaResolucion: new Date(),
          motivoRechazo: motivoRechazo?.trim() || null,
        },
      });

      await tx.notificacion.create({
        data: {
          usuarioId: solicitud.solicitanteId,
          tipo: "SOLICITUD_RECHAZADA",
          titulo: `Solicitud de caja rechazada`,
          mensaje: `Tu solicitud de ${solicitud.tipo.toLowerCase().replace("_", " ")} fue rechazada por ${session.username}.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ""}`,
          entidad: "solicitud_caja",
          solicitudCajaId: solicitudId,
        },
      });
    });

    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en rechazarSolicitudCaja:", error);
    return { error: getErrorMessage(error, "Error al rechazar la solicitud") };
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
  const session = await requirePermission("caja.cerrar", await getSession());

  if (!Number.isFinite(totalContado) || totalContado < 0) {
    return {
      success: false,
      error: "Debe ingresar un monto contado válido para cerrar la caja.",
    };
  }

  const isAdmin = session.role === "ADMINISTRADOR";

  if (!isAdmin) {
    try {
      const caja = await prisma.caja.findUnique({ where: { id } });
      if (!caja) {
        return { success: false, error: "Caja no encontrada." };
      }
      if (caja.estado !== "ABIERTA") {
        return { success: false, error: "La caja no se encuentra abierta." };
      }

      await prisma.$transaction(async (tx) => {
        const solicitud = await tx.solicitudCaja.create({
          data: {
            tipo: "CIERRE",
            estado: "PENDIENTE",
            solicitanteId: session.userId,
            monto: totalContado,
            motivo: observacion?.trim() || null,
            datosExtra: { efectivoContado: totalContado },
          },
        });

        await notificarAdminsSolicitudCaja({
          tx,
          solicitudId: solicitud.id,
          solicitanteNombre: session.username,
          tipo: "CIERRE",
          monto: totalContado,
          motivo: observacion,
        });

        return solicitud;
      });

      revalidatePath("/caja");
      return { success: true, efectivoEsperado: 0, diferencia: 0 } as CerrarCajaResult & { needsApproval: true };
    } catch (error: unknown) {
      console.error("Error en cerrarCaja (solicitud):", error);
      return { success: false, error: getErrorMessage(error, "Error al crear la solicitud de cierre") };
    }
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
 * Registra un movimiento de gasto (Egreso) manual.
 * metodoPago: "EFECTIVO" (default) o "BANCO" — determina de qué fondo se descuenta.
 */
export async function registrarGastoCaja(formData: FormData) {
  const session = await requirePermission("caja.egresos", await getSession());

  const descripcion = formData.get("descripcion") as string;
  const monto = Number(formData.get("monto"));
  const metodoPago = (formData.get("metodoPago") as string) || "EFECTIVO";

  if (!descripcion || descripcion.trim().length < 3) {
    throw new Error("Ingrese una descripción del gasto de al menos 3 caracteres.");
  }

  if (!monto || monto <= 0) {
    throw new Error("El monto del gasto debe ser mayor a 0.");
  }

  if (metodoPago !== "EFECTIVO" && metodoPago !== "BANCO") {
    throw new Error("Método de pago inválido. Use EFECTIVO o BANCO.");
  }

  const isAdmin = session.role === "ADMINISTRADOR";

  if (!isAdmin) {
    try {
      const res = await prisma.$transaction(async (tx) => {
        const cajaAbierta = await tx.caja.findFirst({
          where: { estado: "ABIERTA" },
        });
        if (!cajaAbierta) {
          throw new Error("Debe haber una caja abierta para registrar gastos.");
        }

        const solicitud = await tx.solicitudCaja.create({
          data: {
            tipo: "EGRESO",
            estado: "PENDIENTE",
            solicitanteId: session.userId,
            monto,
            motivo: descripcion.trim(),
            datosExtra: { metodoPago, descripcion: descripcion.trim() },
          },
        });

        await notificarAdminsSolicitudCaja({
          tx,
          solicitudId: solicitud.id,
          solicitanteNombre: session.username,
          tipo: "EGRESO",
          monto,
          motivo: `[${metodoPago}] ${descripcion.trim()}`,
        });

        return solicitud;
      });

      revalidatePath("/caja");
      return { success: true, needsApproval: true, solicitudId: res.id };
    } catch (error: unknown) {
      console.error("Error en registrarGastoCaja (solicitud):", error);
      return { error: getErrorMessage(error, "Error al crear la solicitud de egreso.") };
    }
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

      if (metodoPago === "EFECTIVO") {
        // 2a. Registrar egreso en Caja (MovimientoCaja)
        await tx.movimientoCaja.create({
          data: {
            cajaId: cajaAbierta.id,
            usuarioId: session.userId,
            tipo: "EGRESO",
            monto: monto,
            descripcion: `Gasto: ${descripcion.trim()}`,
          },
        });

        // 3a. Descontar total caja
        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: {
            totalVentas: {
              decrement: monto,
            },
          },
        });
      } else {
        // 2b. Registrar egreso en Banco (MovimientoFinanciero)
        const cuentaBanco = await tx.cuentaFinanciera.findFirst({
          where: {
            tipo: "BANCO",
            esPrincipal: true,
            activa: true,
          },
          include: {
            movimientos: { select: { tipo: true, monto: true } },
          },
        });

        if (!cuentaBanco) {
          throw new Error("No hay una cuenta Banco principal activa configurada.");
        }

        const saldoActual = calcularSaldoCuentaFinanciera(
          cuentaBanco.saldoInicial,
          cuentaBanco.movimientos
        ).saldoActual;

        if (monto > saldoActual) {
          throw new Error("El gasto supera el saldo disponible del Banco.");
        }

        await tx.movimientoFinanciero.create({
          data: {
            cuentaFinancieraId: cuentaBanco.id,
            tipo: "EGRESO",
            monto,
            descripcion: `Gasto: ${descripcion.trim()}`,
            usuarioId: session.userId,
          },
        });
      }
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

  const isAdmin = session.role === "ADMINISTRADOR";

  if (!isAdmin) {
    try {
      await prisma.$transaction(async (tx) => {
        const solicitud = await tx.solicitudCaja.create({
          data: {
            tipo: "AJUSTE_BANCO",
            estado: "PENDIENTE",
            solicitanteId: session.userId,
            monto,
            motivo,
            datosExtra: { tipo: input.tipo, motivo, referencia: input.referencia },
          },
        });

        await notificarAdminsSolicitudCaja({
          tx,
          solicitudId: solicitud.id,
          solicitanteNombre: session.username,
          tipo: "AJUSTE_BANCO",
          monto,
          motivo,
        });

        return solicitud;
      });

      revalidatePath("/caja");
      return { success: true, saldoActual: 0, saldoResultante: 0 };
    } catch (error: unknown) {
      console.error("Error en registrarAjusteBanco (solicitud):", error);
      return { success: false, error: getErrorMessage(error, "Error al crear la solicitud de ajuste") };
    }
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

export type AjusteEfectivoInput = {
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  motivo: string;
};

export type AjusteEfectivoResult =
  | {
      success: true;
      saldoActual: number;
      saldoResultante: number;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Registra un ajuste manual de efectivo (análogo a Ajustar Banco).
 * Si el usuario NO es ADMINISTRADOR, crea una SolicitudCaja pendiente.
 */
export async function registrarAjusteEfectivo(
  input: AjusteEfectivoInput
): Promise<AjusteEfectivoResult> {
  const session = await requirePermission("caja.ver", await getSession());

  if (input.tipo !== "INGRESO" && input.tipo !== "EGRESO") {
    return { success: false, error: "Tipo de ajuste inválido." };
  }

  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { success: false, error: "El monto debe ser mayor a 0." };
  }

  const motivo = input.motivo?.trim();
  if (!motivo) {
    return { success: false, error: "Debe ingresar un motivo/observación para el ajuste." };
  }

  const isAdmin = session.role === "ADMINISTRADOR";

  if (!isAdmin) {
    try {
      await prisma.$transaction(async (tx) => {
        const cajaAbierta = await tx.caja.findFirst({
          where: { estado: "ABIERTA" },
        });
        if (!cajaAbierta) {
          throw new Error("No hay caja abierta para ajustar el efectivo.");
        }

        const solicitud = await tx.solicitudCaja.create({
          data: {
            tipo: "AJUSTE_EFECTIVO",
            estado: "PENDIENTE",
            solicitanteId: session.userId,
            monto,
            motivo,
            datosExtra: { tipo: input.tipo, motivo },
          },
        });

        await notificarAdminsSolicitudCaja({
          tx,
          solicitudId: solicitud.id,
          solicitanteNombre: session.username,
          tipo: "AJUSTE_EFECTIVO",
          monto,
          motivo,
        });

        return solicitud;
      });

      revalidatePath("/caja");
      return { success: true, saldoActual: 0, saldoResultante: 0 };
    } catch (error: unknown) {
      console.error("Error en registrarAjusteEfectivo (solicitud):", error);
      return { success: false, error: getErrorMessage(error, "Error al crear la solicitud de ajuste") };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: "ABIERTA" },
        include: {
          movimientos: { select: { tipo: true, monto: true } },
        },
      });

      if (!cajaAbierta) {
        return {
          success: false as const,
          error: "No hay caja abierta para ajustar el efectivo.",
        };
      }

      const saldoActual = calcularEfectivoFisico(cajaAbierta.movimientos).efectivoEsperado;

      if (input.tipo === "EGRESO" && monto > saldoActual) {
        return {
          success: false as const,
          error: "El egreso supera el saldo disponible en efectivo.",
        };
      }

      // Registrar movimiento con concepto AJUSTE_EFECTIVO para auditoría
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          usuarioId: session.userId,
          tipo: input.tipo,
          monto,
          descripcion: `[AJUSTE_EFECTIVO] ${motivo}`,
        },
      });

      // Actualizar totalVentas de la caja
      if (input.tipo === "INGRESO") {
        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: { totalVentas: { increment: monto } },
        });
      } else {
        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: { totalVentas: { decrement: monto } },
        });
      }

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
    console.error("Error en registrarAjusteEfectivo:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Error al registrar el ajuste de efectivo."),
    };
  }
}
