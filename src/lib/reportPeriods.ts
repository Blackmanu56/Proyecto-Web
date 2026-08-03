/**
 * Helpers de fechas para reportes: períodos preseleccionados y conversión de
 * fechas en el límite cliente → servidor.
 *
 * Convención F1: toda string que cruza el límite servidor es un datetime local
 * COMPLETO sin offset — "2026-08-01T00:00:00" — NUNCA date-only y NUNCA
 * toISOString (que emite Z/UTC). El servidor hace new Date(desde) y cierra el
 * día con setHours(23,59,59,999) sobre `hasta`, así que la ventana cubre el día
 * local completo (86399999 ms). Verificado: new Date("2026-08-01T00:00:00")
 * resuelve a medianoche LOCAL en cualquier zona horaria.
 *
 * Suposición: la máquina servidor corre en UTC-3 (Argentina). Convención
 * preexistente del proyecto, sin cambios.
 */

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "yyyy-MM-dd" — solo para display/input, nunca para el límite servidor. */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "yyyy-MM-dd'T'HH:mm:ss" — datetime local completo sin Z (límite servidor). */
export function formatLocalDateTimeStart(d: Date): string {
  return `${formatLocalDate(d)}T00:00:00`;
}

export type PeriodoPreset = "dia" | "semana" | "mes" | "anio";

/**
 * Rango [desde, hasta] para un preset, ambos como datetime local completo sin Z.
 * - dia: mismo día local (el servidor cierra `hasta` a las 23:59:59.999)
 * - semana: lunes 00:00 → domingo 00:00 local (la semana empieza en lunes)
 * - mes: primero → último día del mes a medianoche local
 * - anio: 1 de enero → 31 de diciembre a medianoche local
 *
 * 'personalizado' NO entra aquí: se normaliza con toApiDate en el límite de llamada.
 */
export function getCierresDateRange(
  period: PeriodoPreset,
  base: Date = new Date()
): { desde: string; hasta: string } {
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();

  let desde: Date;
  let hasta: Date;

  switch (period) {
    case "dia":
      desde = new Date(y, m, d);
      hasta = new Date(y, m, d);
      break;
    case "semana": {
      const diasDesdeLunes = (base.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
      desde = new Date(y, m, d - diasDesdeLunes);
      hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 6);
      break;
    }
    case "mes":
      desde = new Date(y, m, 1);
      hasta = new Date(y, m + 1, 0); // día 0 del mes siguiente = último día del mes
      break;
    case "anio":
      desde = new Date(y, 0, 1);
      hasta = new Date(y, 11, 31);
      break;
  }

  return {
    desde: formatLocalDateTimeStart(desde),
    hasta: formatLocalDateTimeStart(hasta),
  };
}

/** "yyyy-MM-dd" → "yyyy-MM-ddT00:00:00" (o undefined si no hay fecha). */
export function toApiDate(dateOnly?: string): string | undefined {
  return dateOnly ? `${dateOnly}T00:00:00` : undefined;
}
