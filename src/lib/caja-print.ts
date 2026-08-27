import type {
  MovimientoCompra,
  MovimientoEnriched,
  MovimientoVenta,
} from "@/lib/caja-filters";
import { getConcepto, getMetodoPago } from "@/lib/caja-filters";
import {
  formatMovimientoDescripcion,
  formatTipoComprobante,
} from "@/lib/movimiento-format";
import {
  calcularImpactoFinanciero,
  type ImpactoFinanciero,
} from "@/lib/cuenta-financiera";

const LABELS_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  EFECTIVO_CAJA: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TRANSFERENCIA_BANCARIA: "Transferencia",
  BANCO: "Banco",
  TARJETA_DEBITO: "Débito",
  TARJETA_CREDITO: "Crédito",
  CUENTA_CORRIENTE_PROVEEDOR: "Cta. Cte.",
  FONDOS_EXTERNOS: "Fondos externos",
  MERCADOPAGO: "Mercado Pago",
  MERCADO_PAGO: "Mercado Pago",
  OTROS: "Otros",
  MIXTO: "Mixto",
};

function labelPago(medio: string): string {
  return LABELS_PAGO[medio] ?? medio;
}

function obtenerPago(mov: MovimientoEnriched): string {
  const descripcion = mov.descripcion.toLowerCase().trim();
  const concepto = getConcepto(mov);

  if (descripcion.includes("acreditación") || descripcion.includes("acreditacion")) {
    return "Banco";
  }

  if (concepto === "APERTURA" || descripcion.includes("cierre") || (concepto === "AJUSTE" && !descripcion.includes("acreditac"))) {
    return "—";
  }

  if (mov.venta?.metodoPago) return labelPago(mov.venta.metodoPago);

  const pagos = mov.compra?.pagos ?? [];
  if (pagos.length > 1) return "Mixto";
  if (pagos.length === 1) return labelPago(pagos[0].medio);
  if (mov.compra?.origenPago) return labelPago(mov.compra.origenPago);

  if (concepto === "REPOSICION") {
    const mp = getMetodoPago(mov);
    return mp === "BANCO" ? "Transferencia" : "Efectivo";
  }

  if (concepto === "GASTO") {
    const mp = getMetodoPago(mov);
    return mp === "BANCO" ? "Transferencia" : "Efectivo";
  }

  return "—";
}

export interface FilaImpresionLibroDiario {
  pago: string;
  importe: number;
  ingresoCaja: number;
  egresoCaja: number;
  saldoCaja: number;
  ingresoBanco: number;
  egresoBanco: number;
  saldoBanco: number;
  ingresoPorAcreditar: number;
  egresoPorAcreditar: number;
  saldoPorAcreditar: number;
}

export interface MovimientoFinancieroImpresion {
  id: number;
  tipo: string;
  monto: number;
  fecha: Date | string;
  descripcion: string;
  usuario?: { username?: string | null; nombreCompleto?: string | null } | null;
  ventaId?: number | null;
  venta?: MovimientoVenta | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
}

function claveOperacion(
  mov: Pick<MovimientoEnriched, "id" | "ventaId" | "venta" | "compraId" | "compra" | "descripcion">
): string {
  const desc = (mov.descripcion || "").toLowerCase();
  if (desc.includes("acreditación") || desc.includes("acreditacion")) {
    return `acreditacion:${mov.id}`;
  }

  const ventaId = mov.ventaId ?? mov.venta?.id;
  if (ventaId != null) return `venta:${ventaId}`;

  const compraId = mov.compraId ?? mov.compra?.id;
  if (compraId != null) return `compra:${compraId}`;

  return `caja:${mov.id}`;
}

function impactoParaImpresion(mov: MovimientoEnriched): ImpactoFinanciero {
  const pagos = mov.compra?.pagos ?? [];
  const efectivo = pagos
    .filter((p) => p.medio === "EFECTIVO_CAJA")
    .reduce((total, p) => total + p.monto, 0);
  const transferencia = pagos
    .filter((p) => p.medio === "TRANSFERENCIA_BANCARIA")
    .reduce((total, p) => total + p.monto, 0);

  if (pagos.length > 1 && (efectivo > 0 || transferencia > 0)) {
    const medio = efectivo > 0 && transferencia > 0
      ? "MIXTO"
      : efectivo > 0
        ? "EFECTIVO_CAJA"
        : "TRANSFERENCIA_BANCARIA";

    return calcularImpactoFinanciero({
      tipo: mov.tipo,
      monto: efectivo + transferencia,
      impactaCaja: mov.impactaCaja,
      esNoEfectivo: mov.esNoEfectivo,
      venta: mov.venta,
      compra: {
        ...mov.compra,
        pagos: [{ medio, monto: efectivo }],
      },
      descripcion: mov.descripcion,
    });
  }

  return calcularImpactoFinanciero({
    tipo: mov.tipo,
    monto: mov.compra?.total ?? mov.monto,
    impactaCaja: mov.impactaCaja,
    esNoEfectivo: mov.esNoEfectivo,
    venta: mov.venta,
    compra: mov.compra,
    descripcion: mov.descripcion,
  });
}

export function construirDescripcionImpresion(mov: MovimientoEnriched): string {
  const desc = (mov.descripcion || "").toLowerCase();
  if (desc.includes("acreditación") || desc.includes("acreditacion")) {
    return formatMovimientoDescripcion(mov.descripcion);
  }

  if (mov.venta) {
    const tipo = mov.venta.tipoComprobante
      ? formatTipoComprobante(mov.venta.tipoComprobante)
      : "Comprobante";
    return `${tipo} N° ${mov.venta.id}`;
  }

  const detalles = mov.compra?.detalles ?? [];
  if (detalles.length === 1) {
    return detalles[0].producto.nombre;
  }

  return formatMovimientoDescripcion(mov.descripcion);
}

/**
 * Une el ledger visible de Caja con los movimientos bancarios ya persistidos.
 * Venta/Compra es la clave de deduplicación: una operación produce una fila.
 */
export function crearModeloImpresionLibroDiario(
  movimientosCaja: readonly MovimientoEnriched[],
  movimientosBanco: readonly MovimientoFinancieroImpresion[],
  fechaDesde?: Date | string | null,
  saldoBancoInicial = 0
): MovimientoEnriched[] {
  const desde = fechaDesde ? new Date(fechaDesde).getTime() : null;
  const operaciones = new Map<string, MovimientoEnriched>();

  for (const mov of movimientosCaja) {
    operaciones.set(claveOperacion(mov), { ...mov });
  }

  for (const mov of movimientosBanco) {
    const fecha = new Date(mov.fecha);
    if (desde !== null && fecha.getTime() < desde) continue;

    const candidato: MovimientoEnriched = {
      id: -(2_000_000 + mov.id),
      tipo: mov.tipo,
      monto: mov.venta?.total ?? mov.compra?.total ?? mov.monto,
      descripcion: mov.descripcion,
      fecha: mov.fecha,
      usuario: {
        username: mov.usuario?.username ?? "sistema",
        nombreCompleto: mov.usuario?.nombreCompleto ?? undefined,
      },
      ventaId: mov.ventaId ?? mov.venta?.id ?? null,
      venta: mov.venta ?? null,
      compraId: mov.compraId ?? mov.compra?.id ?? null,
      compra: mov.compra ?? null,
      esNoEfectivo: mov.venta != null,
      impactaCaja: false,
      itemNumber: 0,
      saldoAcumulado: 0,
      saldoBanco: 0,
      saldoPorAcreditar: 0,
    };
    const clave = claveOperacion(candidato);
    if (!operaciones.has(clave)) operaciones.set(clave, candidato);
  }

  const ordenadas = [...operaciones.values()].sort((a, b) => {
    const porFecha = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    return porFecha !== 0 ? porFecha : a.id - b.id;
  });

  let saldoCaja = 0;
  let saldoBanco = Number.isFinite(saldoBancoInicial) ? saldoBancoInicial : 0;
  let saldoPorAcreditar = 0;
  return ordenadas.map((mov, index) => {
    const impacto = impactoParaImpresion(mov);
    saldoCaja += impacto.ingresoCaja - impacto.egresoCaja;
    saldoBanco += impacto.ingresoBanco - impacto.egresoBanco;
    saldoPorAcreditar += impacto.ingresoPorAcreditar - impacto.egresoPorAcreditar;
    return {
      ...mov,
      itemNumber: index + 1,
      saldoAcumulado: saldoCaja,
      saldoBanco,
      saldoPorAcreditar,
    };
  });
}

/**
 * Adapta un movimiento ya preparado por Partes 7.1–7.3 al modelo compacto
 * de impresión. No recalcula ni modifica reglas financieras.
 */
export function crearFilaImpresionLibroDiario(
  mov: MovimientoEnriched
): FilaImpresionLibroDiario {
  const impacto = impactoParaImpresion(mov);

  return {
    pago: obtenerPago(mov),
    importe: mov.venta?.total ?? mov.compra?.total ?? mov.monto,
    ingresoCaja: impacto.ingresoCaja,
    egresoCaja: impacto.egresoCaja,
    saldoCaja: mov.saldoAcumulado,
    ingresoBanco: impacto.ingresoBanco,
    egresoBanco: impacto.egresoBanco,
    saldoBanco: mov.saldoBanco,
    ingresoPorAcreditar: impacto.ingresoPorAcreditar,
    egresoPorAcreditar: impacto.egresoPorAcreditar,
    saldoPorAcreditar: mov.saldoPorAcreditar ?? 0,
  };
}

export function calcularFlujosImpresion(
  movimientos: readonly MovimientoEnriched[]
): {
  ingresosCaja: number;
  egresosCaja: number;
  ingresosBanco: number;
  egresosBanco: number;
} {
  return movimientos.reduce(
    (totales, mov) => {
      const fila = crearFilaImpresionLibroDiario(mov);
      totales.ingresosCaja += fila.ingresoCaja;
      totales.egresosCaja += fila.egresoCaja;
      totales.ingresosBanco += fila.ingresoBanco;
      totales.egresosBanco += fila.egresoBanco;
      return totales;
    },
    { ingresosCaja: 0, egresosCaja: 0, ingresosBanco: 0, egresosBanco: 0 }
  );
}
