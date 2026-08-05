/**
 * Lógica pura de filtrado del módulo Caja.
 * Separada del componente para poder testearse independientemente.
 */

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

export interface MovimientoCompra {
  id: number;
  total: number;
  proveedor: { id: number; nombre: string };
  detalles: MovimientoCompraDetalle[];
}

export interface MovimientoInput {
  id?: number;
  tipo?: string;
  monto?: number;
  descripcion?: string;
  fecha?: Date | string;
  usuario?: { username?: string; nombreCompleto?: string } | null;
  ventaId?: number | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
}

export interface MovimientoEnriched {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date | string;
  usuario: { username: string; nombreCompleto?: string };
  ventaId?: number | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
  itemNumber: number;
  saldoAcumulado: number;
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
  return sorted.map((mov, idx) => {
    const monto = typeof mov.monto === "number" ? mov.monto : 0;
    saldo += mov.tipo === "INGRESO" ? monto : -monto;
    return {
      id: mov.id ?? idx,
      tipo: mov.tipo || "INGRESO",
      monto,
      descripcion: mov.descripcion || "",
      fecha: mov.fecha || new Date(),
      usuario: { username: mov.usuario?.username || "unknown", nombreCompleto: mov.usuario?.nombreCompleto },
      ventaId: mov.ventaId ?? null,
      compraId: mov.compraId ?? null,
      compra: mov.compra ?? null,
      itemNumber: idx + 1,
      saldoAcumulado: saldo,
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

    // Búsqueda libre
    if (busqueda) {
      const s = busqueda.toLowerCase();
      const desc = (mov.descripcion || "").toLowerCase();
      const username = (mov.usuario?.username || "").toLowerCase();
      const nombre = (mov.usuario?.nombreCompleto || "").toLowerCase();
      const idStr = String(mov.id || "");
      const ventaStr = mov.ventaId ? String(mov.ventaId) : "";
      const compraStr = mov.compraId ? String(mov.compraId) : "";

      const matches =
        desc.includes(s) ||
        username.includes(s) ||
        nombre.includes(s) ||
        idStr.includes(s) ||
        ventaStr.includes(s) ||
        compraStr.includes(s);

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
 */
export function calcularTotales(movimientos: MovimientoEnriched[]) {
  if (!Array.isArray(movimientos) || movimientos.length === 0) {
    return {
      totalIngresos: 0,
      totalEgresos: 0,
      saldoFinal: 0,
    };
  }

  const totalIngresos = movimientos
    .filter((m) => m.tipo === "INGRESO")
    .reduce((sum, m) => sum + (m.monto || 0), 0);

  const totalEgresos = movimientos
    .filter((m) => m.tipo === "EGRESO")
    .reduce((sum, m) => sum + (m.monto || 0), 0);

  return {
    totalIngresos,
    totalEgresos,
    saldoFinal: totalIngresos - totalEgresos,
  };
}
