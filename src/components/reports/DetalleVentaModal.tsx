"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDetalleVenta } from "@/actions/informes";
import type { DetalleVentaCompleto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Receipt,
  Loader2,
  Calendar,
  User,
  CreditCard,
  CheckCircle,
  Hash,
  Printer,
} from "lucide-react";

interface Props {
  ventaId: number;
  onClose: () => void;
  onPrintTicket?: () => void;
}

export default function DetalleVentaModal({ ventaId, onClose, onPrintTicket }: Props) {
  const [data, setData] = useState<DetalleVentaCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDetalleVenta(ventaId).then((res) => {
      if (!res) {
        setError(true);
      } else {
        setData(res);
      }
      setLoading(false);
    });
  }, [ventaId]);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0 pr-12">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20 shrink-0">
              <Receipt size={18} />
            </div>
            Detalle de Venta
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-muted)] font-mono">
            {data ? `Comprobante de venta #${data.id.toString().padStart(6, "0")}` : `Comprobante #${ventaId.toString().padStart(6, "0")}`}
          </DialogDescription>
        </DialogHeader>

        {/* Body scrollable con barra de desplazamiento */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--brand)]" />
              <p className="text-xs text-[var(--text-muted)]">Cargando detalle de la venta...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[var(--danger)]">
                Error al cargar el detalle de la venta.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                No se pudo obtener la información solicitada. Por favor, intente nuevamente.
              </p>
            </div>
          ) : data ? (
            <>
              {/* Metadata de la venta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <Hash size={13} className="text-[var(--brand)]" /> N° Factura
                  </p>
                  <p className="text-sm font-mono font-bold text-[var(--text)] truncate">
                    #{data.id.toString().padStart(6, "0")}
                  </p>
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <Calendar size={13} className="text-[var(--brand)]" /> Fecha y Hora
                  </p>
                  <p className="text-sm font-bold text-[var(--text)] truncate">
                    {data.fecha}
                  </p>
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <CheckCircle size={13} className="text-[var(--brand)]" /> Estado
                  </p>
                  <div>
                    {data.estado === "COMPLETADA" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Completada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-500/10 text-rose-400 rounded-full text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        {data.estado}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <User size={13} className="text-[var(--brand)]" /> Vendedor / Cajero
                  </p>
                  <p className="text-sm font-bold text-[var(--text)] truncate" title={data.usuario.nombreCompleto || data.usuario.username}>
                    {data.usuario.nombreCompleto || data.usuario.username}
                  </p>
                  {data.usuario.nombreCompleto && (
                    <p className="text-xs text-[var(--text-muted)] truncate">@{data.usuario.username}</p>
                  )}
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <CreditCard size={13} className="text-[var(--brand)]" /> Método de Pago
                  </p>
                  {data.metodoPago ? (
                    <p className="text-sm font-bold text-[var(--text)] truncate">
                      {data.metodoPago}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)] italic">No registrado</p>
                  )}
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                    <User size={13} className="text-[var(--brand)]" /> Cliente
                  </p>
                  <p className="text-sm font-bold text-[var(--text)] truncate" title={data.cliente.nombre}>
                    {data.cliente.nombre}
                  </p>
                  <div className="flex flex-wrap gap-x-2 text-xs text-[var(--text-muted)] font-mono">
                    <span>DNI: {data.cliente.dni}</span>
                    {data.cliente.cuit && <span>• CUIT: {data.cliente.cuit}</span>}
                  </div>
                </div>
              </div>

              {/* Lista de Productos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                  <span>Productos ({data.detalles.length})</span>
                  <span>Subtotal</span>
                </div>
                <div className="space-y-2">
                  {data.detalles.map((det) => (
                    <div
                      key={det.id}
                      className="flex items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 min-w-0 hover:border-[var(--brand)]/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--text)] truncate" title={det.producto}>
                          {det.producto}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                          Cant: <strong>{det.cantidad}</strong> × {formatCurrency(det.precioUnitario)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[var(--success)] font-mono shrink-0 whitespace-nowrap">
                        {formatCurrency(det.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total de la venta */}
              <div className="flex justify-between items-center bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3.5 shadow-sm">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Total de la venta
                </span>
                <span className="text-xl font-black text-[var(--success)] font-mono">
                  {formatCurrency(data.total)}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer fijo abajo */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] shrink-0 flex flex-wrap items-center justify-between gap-3">
          {onPrintTicket && data && (
            <Button
              type="button"
              onClick={onPrintTicket}
              className="bg-[var(--brand)] hover:bg-[var(--brand)]/85 text-white shadow-sm font-bold active:scale-95 flex items-center gap-2"
            >
              <Printer size={15} />
              Imprimir Ticket / Factura
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="ml-auto"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
