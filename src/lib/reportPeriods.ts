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

/* ──────────────────────────────────────────────────────────────────────────
 * Períodos del reporte de ventas.
 * ventana "actual" → { start, end } con componentes LOCALES (nunca toISOString).
 * "mes" y "anio" usan el calendario completo (1º → último día); "hoy"/"ayer"/"7d"
 * usan duración igual a la ventana. 'personalizado' no tiene ventana computable.
 * ────────────────────────────────────────────────────────────────────────── */

export type ReporteVentasPeriodKey =
  | "hoy"
  | "ayer"
  | "7d"
  | "mes"
  | "mes_anterior"
  | "anio"
  | "personalizado";

export function ventasWindowDates(
  periodKey: ReporteVentasPeriodKey,
  base: Date = new Date()
): { start: Date; end: Date } | null {
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();

  switch (periodKey) {
    case "hoy":
      return { start: new Date(y, m, d), end: new Date(y, m, d) };
    case "ayer":
      return { start: new Date(y, m, d - 1), end: new Date(y, m, d - 1) };
    case "7d":
      return { start: new Date(y, m, d - 6), end: new Date(y, m, d) };
    case "mes":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case "mes_anterior":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case "anio":
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    default:
      return null; // "personalizado": sin fechas no hay ventana computable
  }
}

/** "yyyy-MM-dd" para los inputs de fecha del formulario (nunca al límite servidor). */
export function getVentasDateRange(
  periodKey: ReporteVentasPeriodKey,
  base: Date = new Date()
): { desde: string; hasta: string } {
  const w = ventasWindowDates(periodKey, base);
  if (!w) {
    // 'personalizado' sin fechas: el contenedor nunca llama con este preset.
    return { desde: "", hasta: "" };
  }
  return { desde: formatLocalDate(w.start), hasta: formatLocalDate(w.end) };
}

/**
 * Ventana INMEDIATAMENTE anterior a la ventana de `periodKey`, para comparar
 * (deltas del resumen). Devuelve datetime local completo sin Z (F1).
 * - mes / mes_anterior: corrida de calendario (mes completo anterior)
 * - anio: año completo anterior
 * - hoy / ayer / 7d: duración igual a la ventana, inmediatamente antes
 * - personalizado sin fechas: null
 */
export function getPreviousWindow(
  periodKey: ReporteVentasPeriodKey,
  base: Date = new Date()
): { desde: string; hasta: string } | null {
  const w = ventasWindowDates(periodKey, base);
  if (!w) return null; // personalizado sin fechas

  let start: Date;
  let end: Date;

  switch (periodKey) {
    case "mes": {
      const shift = 1;
      start = new Date(base.getFullYear(), base.getMonth() - shift, 1);
      end = new Date(base.getFullYear(), base.getMonth() - (shift - 1), 0);
      break;
    }
    case "mes_anterior": {
      const shift = 2;
      start = new Date(base.getFullYear(), base.getMonth() - shift, 1);
      end = new Date(base.getFullYear(), base.getMonth() - (shift - 1), 0);
      break;
    }
    case "anio": {
      start = new Date(base.getFullYear() - 1, 0, 1);
      end = new Date(base.getFullYear() - 1, 11, 31);
      break;
    }
    default: {
      // hoy / ayer / 7d: ventana de igual duración inmediatamente anterior
      const MS_DAY = 86_400_000; // Argentina sin DST: día fijo de 24h
      const lengthDays = Math.round((w.end.getTime() - w.start.getTime()) / MS_DAY) + 1;
      start = new Date(w.start.getTime() - lengthDays * MS_DAY);
      end = new Date(w.start.getTime() - MS_DAY);
    }
  }

  return {
    desde: formatLocalDateTimeStart(start),
    hasta: formatLocalDateTimeStart(end),
  };
}
