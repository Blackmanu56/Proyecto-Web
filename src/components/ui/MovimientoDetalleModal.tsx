"use client";

import React from "react";
import { formatCurrency, formatDateShort, formatTime24 } from "@/lib/utils";
import { formatMovimientoDescripcion } from "@/lib/movimiento-format";
import { getProductPurchasePaymentSummary } from "@/lib/product-purchase-payments";
import type { MovimientoCompra } from "@/lib/caja-filters";
import { X, Calendar, Clock, User, Tag, FileText, ArrowUpRight, ArrowDownLeft, Hash, PackagePlus } from "lucide-react";

interface MovimientoDetalle {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date | string;
  usuario: { username: string; nombreCompleto?: string };
  ventaId?: number | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
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

  let tipoLabel = "Movimiento";
  let badgeVariant: "success" | "danger" | "info" | "warning" | "default" = "default";

  if (isIncome) {
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

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] w-full max-w-[calc(100vw-32px)] md:max-w-[680px] rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
            <FileText size={18} className="text-[var(--info)]" />
            Detalle del Movimiento
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Tipo Badge + ID */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${badgeColorMap[badgeVariant]}`}>
              {isIncome ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
              {tipoLabel}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1">
              <Hash size={12} />
              #{movimiento.itemNumber || movimiento.id}
            </span>
          </div>

          {/* Monto */}
          <div className={`px-4 py-2.5 rounded-xl border ${isIncome ? "bg-[var(--success-light)] border-[var(--success)]/20" : "bg-[var(--danger-light)] border-[var(--danger)]/20"}`}>
            <p className={`text-xs font-semibold ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{esReposicion ? "Afectó Caja" : "Monto"}</p>
            <p className={`text-2xl font-black font-mono ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {isIncome ? "+" : "-"}{formatCurrency(movimiento.monto)}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} />
                Fecha
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">{fechaStr}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} />
                Hora
              </p>
              <p className="text-sm text-[var(--text)] font-mono font-semibold">{horaStr}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <User size={10} />
                Usuario
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">{movimiento.usuario.nombreCompleto || movimiento.usuario.username}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} />
                Referencia
              </p>
              <p className="text-sm text-[var(--text)] font-semibold">
                {movimiento.ventaId
                  ? `Venta #${movimiento.ventaId}`
                  : movimiento.compraId
                  ? `Reposición #${movimiento.compraId}`
                  : "Sin referencia"}
              </p>
            </div>
          </div>

          {/* Saldo acumulado */}
          {movimiento.saldoAcumulado !== undefined && (
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--text-muted)] font-semibold">Saldo acumulado tras este movimiento</span>
                <span className={`text-sm font-black font-mono ${movimiento.saldoAcumulado >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(movimiento.saldoAcumulado)}
                </span>
              </div>
            </div>
          )}

          {/* Descripción (solo movimientos que no son reposiciones) */}
          {!esReposicion && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Descripción completa</p>
              <div className="p-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)] leading-relaxed">
                {formatMovimientoDescripcion(movimiento.descripcion)}
              </div>
            </div>
          )}

          {/* Detalle de la Reposición */}
          {compra && compraDetalles.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)] space-y-3">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <PackagePlus size={10} />
                Detalle de la Reposición
              </p>

              {detalleUnico ? (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Producto</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.nombre}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Marca</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.marca ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Categoría</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.producto.categoria?.nombre ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Proveedor</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{compra.proveedor?.nombre ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Cantidad repuesta</p>
                      <p className="text-sm text-[var(--text)] font-semibold">{detalleUnico.cantidad === 1 ? "1 unidad" : `${detalleUnico.cantidad} unidades`}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Costo unitario</p>
                      <p className="text-sm text-[var(--text)] font-mono font-semibold">{formatCurrency(detalleUnico.costoUnitario)}</p>
                    </div>
                    <div className="space-y-1">
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

          {compra && paymentSummary && (
            <div className="pt-3 border-t border-[var(--border)] space-y-3">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                Distribución de pago
              </p>
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                {paymentSummary.payments.map((pago, index) => (
                  <div key={pago.id ?? `${pago.medio}-${index}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-[var(--text-muted)] font-semibold">
                        {pago.label}
                      </span>
                      <span className="text-[var(--text)] font-mono font-bold">
                        {formatCurrency(pago.monto)}
                      </span>
                    </div>
                    {pago.medio === "FONDOS_EXTERNOS" && pago.observacion && (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Origen: {pago.observacion}
                      </p>
                    )}
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)] font-semibold">Total reposición</span>
                    <span className="text-[var(--text)] font-mono font-bold">{formatCurrency(paymentSummary.total)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)] font-semibold">Afectó Caja</span>
                    <span className="text-[var(--danger)] font-mono font-bold">{formatCurrency(paymentSummary.cashImpact)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border)] flex justify-end">
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

