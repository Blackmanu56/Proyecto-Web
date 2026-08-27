"use client";

import React from "react";
import { formatCurrency, formatDateShort, formatTime24 } from "@/lib/utils";
import { formatMovimientoDescripcion, formatTipoComprobante } from "@/lib/movimiento-format";
import { getProductPurchasePaymentSummary } from "@/lib/product-purchase-payments";
import type { MovimientoCompra, MovimientoVenta } from "@/lib/caja-filters";
import { X, Calendar, Clock, User, Tag, FileText, ArrowUpRight, ArrowDownLeft, Hash, PackagePlus, ShoppingCart, CreditCard, UserRound } from "lucide-react";

interface MovimientoDetalle {
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
  itemNumber?: number;
  saldoAcumulado?: number;
}

interface PagoCompraDetalle {
  id: number;
  medio: string;
  monto: number;
  observacion?: string | null;
}

type MovimientoCompraConPagos = MovimientoCompra & {
  pagos?: PagoCompraDetalle[];
};

interface MovimientoDetalleModalProps {
  open: boolean;
  onClose: () => void;
  movimiento: MovimientoDetalle | null;
}

const METODO_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA_DEBITO: "Tarjeta de Débito",
  TARJETA_CREDITO: "Tarjeta de Crédito",
  MERCADOPAGO: "Mercado Pago",
  OTROS: "Otros",
};

function labelMetodoPago(metodo: string): string {
  return METODO_PAGO_LABELS[metodo] ?? metodo;
}

export default function MovimientoDetalleModal({
  open,
  onClose,
  movimiento,
}: MovimientoDetalleModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !movimiento) return null;

  const isIncome = movimiento.tipo === "INGRESO";
  const d = new Date(movimiento.fecha);
  const fechaStr = formatDateShort(d);
  const horaStr = formatTime24(d);

  const desc = movimiento.descripcion;
  const esAjuste = (desc || "").toLowerCase().includes("ajuste");
  const esReposicion =
    !esAjuste &&
    (!!movimiento.compraId || (desc || "").toLowerCase().includes("reposici"));
  const compra = (movimiento.compra as MovimientoCompraConPagos | null) ?? null;
  const compraDetalles = compra?.detalles ?? [];
  const compraPagos = compra?.pagos ?? [];
  const paymentSummary = compra
    ? getProductPurchasePaymentSummary(compra.total, compraPagos)
    : null;
  const detalleUnico = compraDetalles.length === 1 ? compraDetalles[0] : null;

  // Venta detection: either from venta relation or ventaId on a physical movement
  const venta = movimiento.venta ?? null;
  const esVenta = !!venta && !!movimiento.ventaId;
  const ventaDetalles = venta?.detalles ?? [];
  const ventaCliente = venta?.cliente ?? null;
  const esNoEfectivo = movimiento.esNoEfectivo === true;
  const metodoPago = venta?.metodoPago ?? null;
  const afectoCaja = esNoEfectivo ? 0 : movimiento.monto;

  let tipoLabel = "Movimiento";
  let badgeVariant: "success" | "danger" | "info" | "warning" | "default" = "default";

  if (esVenta) {
    badgeVariant = "success";
    tipoLabel = "Venta";
  } else if (isIncome) {
    badgeVariant = "success";
    if (desc.toLowerCase().includes("ajuste")) tipoLabel = "Ajuste";
    else if (desc.toLowerCase().includes("venta")) tipoLabel = "Venta";
    else if (desc.toLowerCase().includes("apertura")) tipoLabel = "Apertura";
    else tipoLabel = "Ingreso";
  } else {
    badgeVariant = "danger";
    if (desc.toLowerCase().includes("gasto")) tipoLabel = "Gasto";
    else if (desc.toLowerCase().includes("reposici")) tipoLabel = "Reposición";
    else if (desc.toLowerCase().includes("stock inicial")) tipoLabel = "Reposición";
    else if (desc.toLowerCase().includes("cierre")) tipoLabel = "Cierre";
    else if (desc.toLowerCase().includes("ajuste")) tipoLabel = "Ajuste";
    else tipoLabel = "Egreso";
  }

  const badgeColorMap: Record<string, string> = {
    success: "bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/20",
    danger: "bg-[var(--danger-light)] text-[var(--danger)] border-[var(--danger)]/20",
    info: "bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]/20",
    warning: "bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/20",
    default: "bg-[var(--card)] text-[var(--text-muted)] border-[var(--border)]",
  };

  // Build reference string for sale
  const ventaReferencia = esVenta
    ? venta?.tipoComprobante
      ? `${formatTipoComprobante(venta.tipoComprobante)} N° ${movimiento.ventaId}`
      : `Venta #${movimiento.ventaId}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] w-full max-w-[calc(100vw-32px)] md:max-w-[720px] rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[calc(100vh-48px)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
            {esVenta ? (
              <ShoppingCart size={18} className="text-[var(--success)]" />
            ) : (
              <FileText size={18} className="text-[var(--info)]" />
            )}
            {esVenta ? "Detalle de la Venta" : "Detalle del Movimiento"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Tipo Badge + ID */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${badgeColorMap[badgeVariant]}`}>
              {isIncome ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
              {tipoLabel}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1">
              <Hash size={12} />
              {esVenta ? `Venta #${movimiento.ventaId}` : `#${movimiento.itemNumber || movimiento.id}`}
            </span>
          </div>

          {/* Monto / Afectó Caja */}
          {esVenta ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-2.5 rounded-xl border bg-[var(--success-light)] border-[var(--success)]/20">
                <p className="text-xs font-semibold text-[var(--success)]">Total Venta</p>
                <p className="text-2xl font-black font-mono text-[var(--success)]">{formatCurrency(venta!.total)}</p>
              </div>
              <div className={`px-4 py-2.5 rounded-xl border ${afectoCaja > 0 ? "bg-[var(--success-light)] border-[var(--success)]/20" : "bg-[var(--panel)] border-[var(--border)]"}`}>
                <p className={`text-xs font-semibold ${afectoCaja > 0 ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}>Afectó Caja</p>
                <p className={`text-2xl font-black font-mono ${afectoCaja > 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}>
                  {formatCurrency(afectoCaja)}
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-between px-4 py-2 rounded-xl border ${isIncome ? "bg-[var(--success-light)] border-[var(--success)]/20" : "bg-[var(--danger-light)] border-[var(--danger)]/20"}`}>
              <p className={`text-xs font-semibold ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{esReposicion ? "Afectó Caja" : "Monto"}</p>
              <p className={`text-base font-black font-mono ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {isIncome ? "+" : "-"}{formatCurrency(movimiento.monto)}
              </p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} />
                Fecha
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">{fechaStr}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} />
                Hora
              </p>
              <p className="text-sm text-[var(--text)] font-mono font-semibold">{horaStr}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <User size={10} />
                Usuario
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">{movimiento.usuario.nombreCompleto || movimiento.usuario.username}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} />
                Referencia
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">
                {ventaReferencia
                  ? ventaReferencia
                  : movimiento.ventaId
                  ? `Venta #${movimiento.ventaId}`
                  : movimiento.compraId
                  ? `Reposición #${movimiento.compraId}`
                  : "Sin referencia"}
              </p>
            </div>
          </div>

          {/* ─── Venta: Medio de pago + Cliente ─── */}
          {esVenta && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                  <CreditCard size={10} />
                  Medio de pago
                </p>
                <p className="text-sm text-[var(--text)] font-semibold">{metodoPago ? labelMetodoPago(metodoPago) : "—"}</p>
              </div>
              {ventaCliente && (
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                    <UserRound size={10} />
                    Cliente
                  </p>
                  <p className="text-sm text-[var(--text)] font-semibold">{ventaCliente.nombre}</p>
                  {(ventaCliente.dni || ventaCliente.cuit) && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {ventaCliente.dni ? `DNI ${ventaCliente.dni}` : ""}
                      {ventaCliente.dni && ventaCliente.cuit ? " · " : ""}
                      {ventaCliente.cuit ? `CUIT ${ventaCliente.cuit}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Venta: Descuento ─── */}
          {esVenta && venta && (venta.montoDescuento ?? 0) > 0 && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-semibold">
                  Descuento ({venta.descuentoTipo === "PORCENTAJE" ? "porcentaje" : "monto fijo"})
                </span>
                <span className="text-[var(--warning)] font-mono font-bold">
                  -{formatCurrency(venta.montoDescuento ?? 0)}
                </span>
              </div>
            </div>
          )}

          {/* Saldo acumulado */}
          {movimiento.saldoAcumulado !== undefined && (
            <div className="pt-2.5 border-t border-[var(--border)]">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--text-muted)] font-semibold">Saldo acumulado tras este movimiento</span>
                <span className={`text-sm font-black font-mono ${movimiento.saldoAcumulado >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(movimiento.saldoAcumulado)}
                </span>
              </div>
            </div>
          )}

          {/* ─── Venta: Productos vendidos ─── */}
          {esVenta && ventaDetalles.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)] space-y-3">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <ShoppingCart size={10} />
                Productos vendidos ({ventaDetalles.length})
              </p>

              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--card)] text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-2 text-left font-bold">Producto</th>
                      <th className="px-3 py-2 text-right font-bold">Cantidad</th>
                      <th className="px-3 py-2 text-right font-bold">Precio Unit.</th>
                      <th className="px-3 py-2 text-right font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {ventaDetalles.map((detalle) => (
                      <tr key={detalle.id}>
                        <td className="px-3 py-2">
                          <p className="text-[var(--text)] font-semibold">{detalle.producto.nombre}</p>
                          {(detalle.producto.marca || detalle.producto.categoria) && (
                            <p className="text-[10px] text-[var(--text-muted)]">
                              {[detalle.producto.marca, detalle.producto.categoria?.nombre].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text)]">{detalle.cantidad}</td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text)]">{formatCurrency(detalle.precioUnitario)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-[var(--success)]">{formatCurrency(detalle.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between bg-[var(--success-light)] border border-[var(--success)]/20 rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-[var(--success)]">Total de la venta:</span>
                <span className="text-sm font-black font-mono text-[var(--success)]">{formatCurrency(venta!.total)}</span>
              </div>
            </div>
          )}

          {/* Descripción (solo movimientos que no son reposiciones ni ventas con detalle) */}
          {!esReposicion && !esVenta && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Descripción completa</p>
              <div className="p-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)] leading-relaxed">
                {formatMovimientoDescripcion(movimiento.descripcion)}
              </div>
            </div>
          )}

          {/* Detalle de la Reposición */}
          {compra && compraDetalles.length > 0 && (
            <div className="pt-2.5 border-t border-[var(--border)] space-y-2.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <PackagePlus size={10} />
                Detalle de la Reposición
              </p>

              {detalleUnico ? (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="col-span-2 space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Producto</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.nombre}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Marca</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.marca ?? "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Categoría</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.categoria?.nombre ?? "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Proveedor</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{compra.proveedor?.nombre ?? "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Cantidad repuesta</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.cantidad === 1 ? "1 unidad" : `${detalleUnico.cantidad} unidades`}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Costo unitario</p>
                      <p className="text-sm text-[var(--text)] font-mono font-semibold">{formatCurrency(detalleUnico.costoUnitario)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Importe total</p>
                      <p className="text-sm text-[var(--text)] font-mono font-semibold">{formatCurrency(detalleUnico.subtotal)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--card)] text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-2 text-left font-bold">Producto</th>
                          <th className="px-3 py-2 text-left font-bold">Marca</th>
                          <th className="px-3 py-2 text-right font-bold">Cantidad</th>
                          <th className="px-3 py-2 text-right font-bold">Costo unitario</th>
                          <th className="px-3 py-2 text-right font-bold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {compraDetalles.map((detalle, index) => (
                          <tr key={detalle.id ?? index}>
                            <td className="px-3 py-2 text-[var(--text)] font-semibold">{detalle.producto.nombre}</td>
                            <td className="px-3 py-2 text-[var(--text-muted)]">{detalle.producto.marca ?? "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--text)]">{detalle.cantidad}</td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--text)]">{formatCurrency(detalle.costoUnitario)}</td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--text)]">{formatCurrency(detalle.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between bg-[var(--danger-light)] border border-[var(--danger)]/20 rounded-xl px-4 py-3">
                    <span className="text-xs font-semibold text-[var(--danger)]">Total de la reposición:</span>
                    <span className="text-sm font-black font-mono text-[var(--danger)]">{formatCurrency(compra.total)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {compra && (
            <div className="pt-2.5 border-t border-[var(--border)]">
              <div className="flex items-center justify-between bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs">
                <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                  <CreditCard size={13} className="text-[var(--brand)]" />
                  Forma de pago
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text)]">
                  {compra.origenPago === "TRANSFERENCIA_BANCARIA" || compraPagos[0]?.medio === "TRANSFERENCIA_BANCARIA"
                    ? "Transferencia / Banco"
                    : "Efectivo"} — {formatCurrency(compra.total)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-[var(--border)] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--panel)] hover:bg-[var(--border)] text-[var(--text)] text-sm font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
