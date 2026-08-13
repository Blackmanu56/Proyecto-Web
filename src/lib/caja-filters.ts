/**
 * Lógica pura de filtrado del módulo Caja.
 * Separada del componente para poder testearse independientemente.
 */

import { calcularEfectivoFisico } from "@/lib/caja-balance";
import { calcularImpactoFinanciero } from "@/lib/cuenta-financiera";

// ── Compra (reposición) ──────────────────────────────────────────────

export interface MovimientoCompraDetalleProducto {
  id: number;
  nombre: string;
  marca: string | null;
  cantidad: number;
  categoria: { id: number; nombre: string };
}

export interface MovimientoCompraDetalle {
  id: number;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  producto: MovimientoCompraDetalleProducto;
}

export interface MovimientoCompraPago {
  id: number;
  medio: string;
  monto: number;
  observacion?: string | null;
}

export interface MovimientoCompra {
  id: number;
  total: number;
  proveedor: { id: number; nombre: string };
  detalles: MovimientoCompraDetalle[];
  pagos?: MovimientoCompraPago[];
}

// ── Venta ────────────────────────────────────────────────────────────

export interface MovimientoVentaDetalleProducto {
  id: number;
  nombre: string;
  marca?: string | null;
  categoria?: { id: number; nombre: string } | null;
}

export interface MovimientoVentaDetalle {
  id: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto: MovimientoVentaDetalleProducto;
}

export interface MovimientoVentaCliente {
  id: number;
  nombre: string;
  dni?: string | null;
  cuit?: string | null;
}

export interface MovimientoVenta {
  id: number;
  total: number;
  fecha?: Date | string;
  metodoPago?: string | null;
  descuentoTipo?: string | null;
  montoDescuento?: number | null;
  tipoComprobante?: string | null;
  cliente?: MovimientoVentaCliente | null;
  usuario?: { id?: number; username: string; nombreCompleto?: string } | null;
  detalles?: MovimientoVentaDetalle[];
}

// ── Movimiento genérico ──────────────────────────────────────────────

export interface MovimientoInput {
  id?: number;
  tipo?: string;
  monto?: number;
  descripcion?: string;
  fecha?: Date | string;
  usuario?: { username?: string; nombreCompleto?: string } | null;
  ventaId?: number | null;
  venta?: MovimientoVenta | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
  /** true para ventas proyectadas que no son efectivo */
  esNoEfectivo?: boolean;
  /** false cuando la fila no debe modificar el saldo físico acumulado */
  impactaCaja?: boolean;
}

export interface MovimientoEnriched {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date | string;
  usuario: { username: string; nombreCompleto?: string };
  ventaId?: number | null;
  venta?: MovimientoVenta | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
  esNoEfectivo?: boolean;
  impactaCaja?: boolean;
  itemNumber: number;
  saldoAcumulado: number;
  saldoBanco: number;
  saldoPorAcreditar?: number;
}

export interface ConceptoVisual {
  label: string;
  variant: "success" | "danger" | "info" | "warning" | "default";
}

export interface FiltrosCaja {
  naturaleza: string;   // "" | "INGRESO" | "EGRESO"
  concepto: string;     // "" | "VENTA" | "REPOSICION" | "GASTO"
  usuario: string;      // "" | username
  busqueda: string;
}

/**
 * Determina el concepto de un movimiento de forma null-safe.
 * Solo retorna valores que existen como opciones de filtro:
 * "VENTA", "REPOSICION", "GASTO"
 */
export function getConcepto(mov: MovimientoInput): string {
  if (!mov) return "VENTA";

  // Ventas no efectivas proyectadas siempre son VENTA
  if (mov.esNoEfectivo) return "VENTA";

  const desc = (mov.descripcion || "").toLowerCase().trim();
  const tipo = mov.tipo || "";

  // Apertura
  if (desc.startsWith("saldo inicial de apertura")) return "APERTURA";

  // Gasto manual
  if (desc.startsWith("gasto:")) return "GASTO";

  // Ajuste histórico (p. ej. reposiciones pagadas por banco) — antes que "reposici"
  if (desc.includes("ajuste")) return "AJUSTE";

  // Reposición (por descripción o por tener compraId)
  if (
    desc.includes("reposici") ||
    desc.includes("stock inicial") ||
    (!!mov.compraId && mov.compraId > 0)
  ) {
    return "REPOSICION";
  }

  // Todo ingreso que no es apertura → VENTA
  if (tipo === "INGRESO") return "VENTA";

  // Cualquier egreso sin categorizar → GASTO
  return "GASTO";
}

/**
 * Determina el label visual y variante del badge para un movimiento.
 * Null-safe: nunca lanza excepciones.
 */
export function getTipoVisual(mov: MovimientoInput): ConceptoVisual {
  if (!mov) return { label: "MOVIMIENTO", variant: "default" };

  // Ventas no efectivas proyectadas
  if (mov.esNoEfectivo) return { label: "VENTA", variant: "success" };

  const desc = (mov.descripcion || "").toLowerCase().trim();
  const tipo = mov.tipo || "";

  if (desc.startsWith("saldo inicial de apertura"))
    return { label: "APERTURA", variant: "info" };
  if (desc.includes("cierre"))
    return { label: "CIERRE", variant: "default" };
  if (desc.startsWith("gasto:"))
    return { label: "EGRESO", variant: "danger" };
  if (desc.includes("ajuste"))
    return { label: "AJUSTE", variant: "default" };
  if (desc.includes("stock inicial") || desc.includes("reposici"))
    return { label: "REPOSICIÓN", variant: "warning" };
  if (mov.compraId)
    return { label: "REPOSICIÓN", variant: "warning" };
  if (tipo === "EGRESO")
    return { label: "EGRESO", variant: "danger" };
  if (tipo === "INGRESO")
    return { label: "VENTA", variant: "success" };

  return { label: "VENTA", variant: "success" };
}

/**
 * Ordena movimientos por fecha y agrega saldo acumulado + itemNumber.
 * Null-safe: si el array es null/undefined, retorna [].
 *
 * El saldo acumulado refleja SOLO efectivo físico:
 * - Movimientos con impactaCaja !== false suman/restan su monto.
 * - Ventas no efectivas proyectadas (impactaCaja === false) no alteran el saldo.
 */
export function enrichMovimientos(
  movimientos: MovimientoInput[] | null | undefined
): MovimientoEnriched[] {
  if (!Array.isArray(movimientos)) return [];

  const sorted = [...movimientos]
    .filter((m) => m && m.descripcion !== undefined)
    .sort((a, b) => {
      const timeA = new Date(a.fecha || 0).getTime() || 0;
      const timeB = new Date(b.fecha || 0).getTime() || 0;
      return timeA - timeB;
    });

  let saldo = 0;
  let saldoBanco = 0;
  let saldoPorAcreditar = 0;
  return sorted.map((mov, idx) => {
    const monto = typeof mov.monto === "number" ? mov.monto : 0;
    const afectaSaldo = mov.impactaCaja !== false;
    if (afectaSaldo) {
      saldo += mov.tipo === "INGRESO" ? monto : -monto;
    }

    // Impacto financiero centralizado (Parte 7.1)
    const impacto = calcularImpactoFinanciero({
      tipo: mov.tipo,
      monto: mov.monto,
      impactaCaja: mov.impactaCaja,
      esNoEfectivo: mov.esNoEfectivo,
      venta: mov.venta,
      compra: mov.compra,
      descripcion: mov.descripcion,
    });
    saldoBanco += impacto.ingresoBanco - impacto.egresoBanco;
    saldoPorAcreditar += impacto.ingresoPorAcreditar - impacto.egresoPorAcreditar;

    return {
      id: mov.id ?? idx,
      tipo: mov.tipo || "INGRESO",
      monto,
      descripcion: mov.descripcion || "",
      fecha: mov.fecha || new Date(),
      usuario: { username: mov.usuario?.username || "unknown", nombreCompleto: mov.usuario?.nombreCompleto },
      ventaId: mov.ventaId ?? null,
      venta: mov.venta ?? null,
      compraId: mov.compraId ?? null,
      compra: mov.compra ?? null,
      esNoEfectivo: mov.esNoEfectivo ?? false,
      impactaCaja: mov.impactaCaja ?? true,
      itemNumber: idx + 1,
      saldoAcumulado: saldo,
      saldoBanco,
      saldoPorAcreditar,
    };
  });
}

/**
 * Filtra movimientos enriquecidos según los filtros de Caja.
 * Null-safe: si recibe array vacío o filtros vacíos, retorna lo esperado.
 * Nunca lanza excepciones.
 */
export function filtrarMovimientos(
  movimientos: MovimientoEnriched[],
  filtros: FiltrosCaja
): MovimientoEnriched[] {
  if (!Array.isArray(movimientos) || movimientos.length === 0) return [];
  if (!filtros) return movimientos;

  const { naturaleza, concepto, usuario, busqueda } = filtros;

  return movimientos.filter((mov) => {
    // Naturaleza (INGRESO / EGRESO)
    if (naturaleza && mov.tipo !== naturaleza) return false;

    // Concepto
    if (concepto && getConcepto(mov) !== concepto) return false;

    // Usuario
    if (usuario) {
      const movUsername = mov.usuario?.username || "";
      if (movUsername !== usuario) return false;
    }

    // Búsqueda libre — incluye metadatos de venta no efectiva
    if (busqueda) {
      const s = busqueda.toLowerCase();
      const desc = (mov.descripcion || "").toLowerCase();
      const username = (mov.usuario?.username || "").toLowerCase();
      const nombre = (mov.usuario?.nombreCompleto || "").toLowerCase();
      const idStr = String(mov.id || "");
      const ventaStr = mov.ventaId ? String(mov.ventaId) : "";
      const compraStr = mov.compraId ? String(mov.compraId) : "";
      const clienteStr = (mov.venta?.cliente?.nombre || "").toLowerCase();
      const metodoPagoStr = (mov.venta?.metodoPago || "").toLowerCase();

      const matches =
        desc.includes(s) ||
        username.includes(s) ||
        nombre.includes(s) ||
        idStr.includes(s) ||
        ventaStr.includes(s) ||
        compraStr.includes(s) ||
        clienteStr.includes(s) ||
        metodoPagoStr.includes(s);

      if (!matches) return false;
    }

    return true;
  });
}

/**
 * Extrae la lista de usuarios únicos de los movimientos.
 * Null-safe.
 */
export function getUsuariosUnicos(
  movimientos: MovimientoEnriched[]
): { username: string; nombreCompleto: string }[] {
  if (!Array.isArray(movimientos)) return [];

  const map = new Map<string, string>();
  for (const m of movimientos) {
    const username = m.usuario?.username || "";
    if (username && !map.has(username)) {
      map.set(username, m.usuario?.nombreCompleto || username);
    }
  }

  return Array.from(map.entries())
    .map(([username, nombreCompleto]) => ({ username, nombreCompleto }))
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
}

/**
 * Calcula totales del turno o filtrado.
 * Solo considera movimientos que impactan la caja física.
 */
export function calcularTotales(movimientos: MovimientoEnriched[]) {
  const fisicos = (movimientos || []).filter((m) => m.impactaCaja !== false);
  const { totalIngresos, totalEgresos, efectivoEsperado } =
    calcularEfectivoFisico(fisicos);

  return {
    totalIngresos,
    totalEgresos,
    saldoFinal: efectivoEsperado,
  };
}
