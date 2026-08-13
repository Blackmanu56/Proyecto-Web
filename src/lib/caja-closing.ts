export interface CierreCajaPayload {
  totalContado: number;
  observacion?: string;
}

type CerrarCajaAction<TResult> = (
  cajaId: number,
  totalContado: number,
  observacion?: string
) => Promise<TResult>;

export function crearPayloadCierre(
  totalContado: number,
  observacion?: string
): CierreCajaPayload {
  return { totalContado, observacion };
}

/** Adaptador explícito entre el callback del modal y la Server Action. */
export function enviarCierreCaja<TResult>(
  action: CerrarCajaAction<TResult>,
  cajaId: number,
  payload: CierreCajaPayload
): Promise<TResult> {
  return action(cajaId, payload.totalContado, payload.observacion);
}
