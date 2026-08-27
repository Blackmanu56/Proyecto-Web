"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  User,
} from "lucide-react";
import { formatCurrency, formatDateShort, formatTime24 } from "@/lib/utils";
import { marcarMovimientoAcreditado } from "@/actions/caja";
import { toast } from "sonner";

export interface MovimientoPorAcreditarItem {
  id: number;
  tipo: string;
  monto: number;
  fecha: Date | string;
  descripcion: string;
  referencia?: string | null;
  ventaId?: number | null;
  usuario?: { username?: string; nombreCompleto?: string | null } | null;
  venta?: {
    id: number;
    total: number;
    fecha: Date | string;
    metodoPago?: string | null;
    cliente?: { id: number; nombre: string; dni?: string | null; cuit?: string | null } | null;
  } | null;
}

interface MovimientosPorAcreditarModalProps {
  open: boolean;
  onClose: () => void;
  movimientos: MovimientoPorAcreditarItem[];
  onAcreditado?: () => void;
}

export default function MovimientosPorAcreditarModal({
  open,
  onClose,
  movimientos,
  onAcreditado,
}: MovimientosPorAcreditarModalProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleMarcarAcreditado = (id: number) => {
    setLoadingId(id);
    startTransition(async () => {
      const res = await marcarMovimientoAcreditado(id);
      setLoadingId(null);
      if (res.success && "monto" in res) {
        toast.success(`Movimiento acreditado correctamente (${formatCurrency(res.monto)} ingresado a Banco).`);
        onAcreditado?.();
        router.refresh();
      } else if (!res.success && "error" in res) {
        toast.error(res.error || "Error al marcar como acreditado.");
      }
    });
  };

  const totalPendiente = movimientos.reduce((sum, m) => sum + m.monto, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col bg-[var(--card)] border border-[var(--border)] p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] shrink-0 bg-[var(--panel)]">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-[#c084fc] rounded-xl border border-purple-500/20">
                <Clock size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[var(--text)] tracking-tight">
                  Movimientos Por Acreditar
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Confirmá el ingreso en banco de las ventas con tarjeta de crédito o pagos diferidos.
                </DialogDescription>
              </div>
            </div>
            {movimientos.length > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total pendiente</p>
                <p className="font-mono text-base font-black text-[#c084fc]">{formatCurrency(totalPendiente)}</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Lista de movimientos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)]">
              <div className="p-3.5 bg-[var(--panel)] rounded-full mb-3 text-[var(--text-muted)] border border-[var(--border)]">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-[var(--text)]">No hay fondos pendientes de acreditar</p>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1">
                Todas las operaciones con tarjeta o pagos diferidos ya fueron acreditadas en Banco.
              </p>
            </div>
          ) : (
            movimientos.map((mov) => {
              const d = new Date(mov.fecha);
              const fechaStr = formatDateShort(d);
              const horaStr = formatTime24(d);
              const isProcessing = isPending && loadingId === mov.id;

              return (
                <div
                  key={mov.id}
                  className="flex items-center justify-between gap-3 p-3.5 bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-xl transition-all shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-[#c084fc] border border-purple-500/20 shrink-0">
                      <CreditCard size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[var(--text)]">
                          {mov.ventaId ? `Venta #${mov.ventaId}` : mov.descripcion}
                        </span>
                        {mov.venta?.cliente && (
                          <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                            <User size={11} />
                            {mov.venta.cliente.nombre}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-0.5 flex-wrap">
                        <span>{fechaStr} {horaStr}</span>
                        {mov.usuario && (
                          <span>@{mov.usuario.username}</span>
                        )}
                        {mov.referencia && (
                          <span className="font-mono text-[10px] bg-[var(--panel)] px-1.5 py-0.2 rounded border border-[var(--border)]">
                            Ref: {mov.referencia}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monto y Botón de acción */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-black text-[#c084fc]">
                      {formatCurrency(mov.monto)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleMarcarAcreditado(mov.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Confirmar ingreso en Banco"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Acreditando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Marcar como acreditado</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[var(--panel)] border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={13} className="text-[var(--warning)]" />
            <span>Al acreditar, el importe se transfiere inmediatamente a <strong>Banco disponible</strong> con la fecha actual.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-[var(--border-hover)] transition-all"
          >
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
