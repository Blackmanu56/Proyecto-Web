export const MAX_HORAS_CAJA_ABIERTA = 24;
export const MAX_MS_CAJA_ABIERTA = MAX_HORAS_CAJA_ABIERTA * 60 * 60 * 1000;

export interface CajaParaValidar {
  id?: number;
  estado: string;
  fechaApertura: Date | string;
}

export type MotivoCajaInhabilitada = "SIN_CAJA" | "CAJA_CERRADA" | "CAJA_VENCIDA";

export interface ResultadoValidacionCaja {
  habilitada: boolean;
  motivo?: MotivoCajaInhabilitada;
  mensaje?: string;
  horasAbierta?: number;
}

/**
 * Valida si una caja está habilitada para operar ventas:
 * 1. Debe existir y tener estado "ABIERTA".
 * 2. Su fecha de apertura no debe superar las 24 horas de antigüedad.
 */
export function validarCajaHabilitadaParaVenta(
  caja: CajaParaValidar | null | undefined,
  ahora: Date = new Date()
): ResultadoValidacionCaja {
  if (!caja) {
    return {
      habilitada: false,
      motivo: "SIN_CAJA",
      mensaje: "No hay una caja abierta en el sistema para realizar ventas.",
    };
  }

  if (caja.estado !== "ABIERTA") {
    return {
      habilitada: false,
      motivo: "CAJA_CERRADA",
      mensaje: "La caja se encuentra cerrada. Debe abrir una caja para comenzar a vender.",
    };
  }

  const fechaApertura = new Date(caja.fechaApertura);
  if (isNaN(fechaApertura.getTime())) {
    return {
      habilitada: false,
      motivo: "SIN_CAJA",
      mensaje: "La fecha de apertura de la caja es inválida.",
    };
  }

  const diffMs = ahora.getTime() - fechaApertura.getTime();
  const horasAbierta = diffMs / (1000 * 60 * 60);

  if (diffMs > MAX_MS_CAJA_ABIERTA) {
    return {
      habilitada: false,
      motivo: "CAJA_VENCIDA",
      mensaje:
        "La caja actual lleva abierta más de 24 horas. Debe realizar el cierre de caja antes de registrar nuevas ventas.",
      horasAbierta: Number(horasAbierta.toFixed(1)),
    };
  }

  return {
    habilitada: true,
    horasAbierta: Number(horasAbierta.toFixed(1)),
  };
}
