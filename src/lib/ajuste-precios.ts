import { z } from "zod";

/* ────────────────────── Types & Enums ────────────────────── */

export type TipoAjustePrecio = "PORCENTAJE" | "MONTO_FIJO" | "VALOR_DIRECTO";
export type PreciosAfectados = "SOLO_VENTA" | "SOLO_COMPRA" | "AMBOS";
export type TipoRedondeo =
  | "SIN_REDONDEO"
  | "ENTERO"
  | "MULTIPLO_10"
  | "MULTIPLO_100"
  | "MULTIPLO_1000";

export interface CalculoPrecioItem {
  productoId: number;
  nombre: string;
  codigo?: string | null;
  marca?: string | null;
  categoria?: string;
  proveedor?: string;
  precioCompraAnterior: number;
  precioCompraNuevo: number;
  precioVentaAnterior: number;
  precioVentaNuevo: number;
  diferenciaCompra: number;
  diferenciaVenta: number;
  porcentajeVariacionCompra: number;
  porcentajeVariacionVenta: number;
  margenAnterior: number | null;
  margenNuevo: number | null;
}

/* ────────────────────── Schemas ────────────────────── */

export const ajusteIndividualSchema = z.object({
  productoId: z.number().int().positive("ID de producto inválido"),
  ajustarCompra: z.boolean().default(false),
  ajustarVenta: z.boolean().default(false),
  metodoCompra: z.enum(["PORCENTAJE", "MONTO_FIJO", "VALOR_DIRECTO"]).optional(),
  valorCompra: z.number().optional(),
  metodoVenta: z.enum(["PORCENTAJE", "MONTO_FIJO", "VALOR_DIRECTO"]).optional(),
  valorVenta: z.number().optional(),
  redondeo: z
    .enum(["SIN_REDONDEO", "ENTERO", "MULTIPLO_10", "MULTIPLO_100", "MULTIPLO_1000"])
    .default("SIN_REDONDEO"),
  motivo: z.string().min(3, "El motivo del ajuste es obligatorio (mínimo 3 caracteres)"),
}).refine(
  (data) => data.ajustarCompra || data.ajustarVenta,
  { message: "Debe seleccionar al menos un precio para ajustar (compra o venta)" }
);

export const ajusteMasivoFiltrosSchema = z.object({
  categoriaId: z.union([z.number().int().positive(), z.literal("all")]).optional().default("all"),
  marca: z.union([z.string(), z.literal("all")]).optional().default("all"),
  proveedorId: z.union([z.number().int().positive(), z.literal("all")]).optional().default("all"),
  estado: z.enum(["todos", "activos", "inactivos"]).default("activos"),
  productoIds: z.array(z.number().int().positive()).optional(),
});

export const ajusteMasivoSchema = z.object({
  tipoAjuste: z.enum(["PORCENTAJE", "MONTO_FIJO"]),
  valorAjuste: z
    .number()
    .refine((v) => !isNaN(v) && isFinite(v) && v !== 0, "El valor del ajuste no puede ser 0 o inválido"),
  preciosAfectados: z.enum(["SOLO_VENTA", "SOLO_COMPRA", "AMBOS"]),
  filtros: ajusteMasivoFiltrosSchema,
  redondeo: z
    .enum(["SIN_REDONDEO", "ENTERO", "MULTIPLO_10", "MULTIPLO_100", "MULTIPLO_1000"])
    .default("SIN_REDONDEO"),
  motivo: z.string().min(3, "El motivo del ajuste masivo es obligatorio (mínimo 3 caracteres)"),
});

/* ────────────────────── Pure Calculation Functions ────────────────────── */

/**
 * Aplica el redondeo configurado a un número.
 */
export function aplicarRedondeo(valor: number, redondeo: TipoRedondeo = "SIN_REDONDEO"): number {
  if (isNaN(valor) || !isFinite(valor)) return 0;

  switch (redondeo) {
    case "ENTERO":
      return Math.round(valor);
    case "MULTIPLO_10":
      return Math.round(valor / 10) * 10;
    case "MULTIPLO_100":
      return Math.round(valor / 100) * 100;
    case "MULTIPLO_1000":
      return Math.round(valor / 1000) * 1000;
    case "SIN_REDONDEO":
    default:
      return Math.round(valor * 100) / 100;
  }
}

/**
 * Calcula un nuevo precio basado en el método de ajuste y redondeo.
 */
export function calcularNuevoPrecio(
  precioActual: number,
  metodo: TipoAjustePrecio,
  valor: number,
  redondeo: TipoRedondeo = "SIN_REDONDEO"
): number {
  if (isNaN(precioActual) || precioActual < 0) return 0;
  if (isNaN(valor)) return precioActual;

  let nuevo: number;

  switch (metodo) {
    case "PORCENTAJE":
      nuevo = precioActual * (1 + valor / 100);
      break;
    case "MONTO_FIJO":
      nuevo = precioActual + valor;
      break;
    case "VALOR_DIRECTO":
      nuevo = valor;
      break;
    default:
      nuevo = precioActual;
  }

  const redondeado = aplicarRedondeo(nuevo, redondeo);
  return redondeado;
}

/**
 * Calcula el margen de ganancia porcentual: ((Venta - Compra) / Compra) * 100
 */
export function calcularMargenGanancia(precioCompra: number, precioVenta: number): number | null {
  if (isNaN(precioCompra) || isNaN(precioVenta) || precioCompra <= 0) {
    return null;
  }
  const margen = ((precioVenta - precioCompra) / precioCompra) * 100;
  return Math.round(margen * 100) / 100;
}

/**
 * Helper para calcular un item completo de comparación antes/después
 */
export function calcularComparacionProducto(params: {
  productoId: number;
  nombre: string;
  codigo?: string | null;
  marca?: string | null;
  categoria?: string;
  proveedor?: string;
  precioCompraActual: number;
  precioVentaActual: number;
  nuevoPrecioCompra: number;
  nuevoPrecioVenta: number;
}): CalculoPrecioItem {
  const {
    productoId,
    nombre,
    codigo,
    marca,
    categoria,
    proveedor,
    precioCompraActual,
    precioVentaActual,
    nuevoPrecioCompra,
    nuevoPrecioVenta,
  } = params;

  const diferenciaCompra = nuevoPrecioCompra - precioCompraActual;
  const diferenciaVenta = nuevoPrecioVenta - precioVentaActual;

  const porcentajeVariacionCompra =
    precioCompraActual > 0 ? (diferenciaCompra / precioCompraActual) * 100 : 0;
  const porcentajeVariacionVenta =
    precioVentaActual > 0 ? (diferenciaVenta / precioVentaActual) * 100 : 0;

  const margenAnterior = calcularMargenGanancia(precioCompraActual, precioVentaActual);
  const margenNuevo = calcularMargenGanancia(nuevoPrecioCompra, nuevoPrecioVenta);

  return {
    productoId,
    nombre,
    codigo,
    marca,
    categoria,
    proveedor,
    precioCompraAnterior: precioCompraActual,
    precioCompraNuevo: nuevoPrecioCompra,
    precioVentaAnterior: precioVentaActual,
    precioVentaNuevo: nuevoPrecioVenta,
    diferenciaCompra: Math.round(diferenciaCompra * 100) / 100,
    diferenciaVenta: Math.round(diferenciaVenta * 100) / 100,
    porcentajeVariacionCompra: Math.round(porcentajeVariacionCompra * 100) / 100,
    porcentajeVariacionVenta: Math.round(porcentajeVariacionVenta * 100) / 100,
    margenAnterior,
    margenNuevo,
  };
}
