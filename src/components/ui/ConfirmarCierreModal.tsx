"use client";

import { formatCurrency,formatDate,formatShiftDuration } from "@/lib/utils";
import { crearPayloadCierre, type CierreCajaPayload } from "@/lib/caja-closing";
import { AlertTriangle,ArrowDownLeft,ArrowUpRight,CheckCircle2,Clock,Loader2,Lock,Scale,TrendingUp,X } from "lucide-react";
import { useState } from "react";

interface ConfirmarCierreModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: CierreCajaPayload) => void;
  isPending: boolean;
  errorMessage?: string;
  montoInicial: number;
  totalVentas: number;
  totalIngresos: number;
  totalEgresos: number;
  fechaApertura?: Date | string;
  saldoFinal?: number;
}

export default function ConfirmarCierreModal(props: ConfirmarCierreModalProps) {
  if (!props.open) return null;

  return <ConfirmarCierreModalContent key={String(props.fechaApertura ?? "cierre")} {...props} />;
}

function ConfirmarCierreModalContent({
  onClose,
  onConfirm,
  isPending,
  errorMessage,
  montoInicial,
  totalEgresos,
  totalIngresos,
  fechaApertura,
  saldoFinal,
}: ConfirmarCierreModalProps) {
  const [montoContado, setMontoContado] = useState("");
  const [observacion, setObservacion] = useState("");

  const saldoEsperado = saldoFinal ?? (montoInicial + totalIngresos - totalEgresos);
  const montoContadoNum = montoContado === "" ? null : Number(montoContado);
  const diferencia = montoContadoNum !== null ? montoContadoNum - saldoEsperado : null;
  const esCuadrada = diferencia !== null && diferencia === 0;
  const esSobrante = diferencia !== null && diferencia > 0;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
            <Scale size={18} className="text-[var(--warning)]" />
            Arqueo de Caja
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {/* Summary when fechaApertura is provided */}
          {fechaApertura && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3 space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Clock size={12} className="text-[var(--info)]" />
                  <span>Apertura:</span>
                </div>
                <span className="font-semibold text-[var(--text)] text-right">{formatDate(fechaApertura)}</span>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Clock size={12} className="text-[var(--warning)]" />
                  <span>Cierre:</span>
                </div>
                <span className="font-semibold text-[var(--text)] text-right">{formatDate(new Date())}</span>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Scale size={12} className="text-[var(--brand)]" />
                  <span>Duración:</span>
                </div>
                <span className="font-semibold text-[var(--text)] text-right font-mono">{formatShiftDuration(fechaApertura)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--text-muted)] font-medium mb-2">
            Revise los valores antes de confirmar el cierre.
          </p>

          {errorMessage && (
            <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-xl flex items-start gap-2" aria-live="polite">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Saldo Esperado */}
          <div className="flex items-center justify-between bg-[var(--info-light)] border border-[var(--info)]/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[var(--info)]/10 text-[var(--info)]">
                <TrendingUp size={14} />
              </div>
              <span className="text-xs font-semibold text-[var(--info)]">Efectivo esperado</span>
            </div>
            <span className="text-sm font-black text-[var(--info)] font-mono">
              {formatCurrency(saldoEsperado)}
            </span>
          </div>

          {/* Ingresos / Egresos summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={12} className="text-[var(--success)]" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Ingresos</span>
              </div>
              <span className="text-xs font-bold text-[var(--success)] font-mono">{formatCurrency(totalIngresos)}</span>
            </div>
            <div className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft size={12} className="text-[var(--danger)]" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Egresos</span>
              </div>
              <span className="text-xs font-bold text-[var(--danger)] font-mono">{formatCurrency(totalEgresos)}</span>
            </div>
          </div>

          {/* Monto Contado - INPUT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Efectivo contado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-sm font-bold">$</span>
              <input
                type="number"
                placeholder="0.00"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-mono font-bold text-sm focus:outline-none focus:border-[var(--brand)] transition"
                disabled={isPending}
                step="0.01"
              />
            </div>
          </div>

          {/* Diferencia (solo si ingresa monto) */}
          {diferencia !== null && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
              esCuadrada
                ? "bg-[var(--success-light)] border-[var(--success)]/20"
                : esSobrante
                ? "bg-[var(--warning-light)] border-[var(--warning)]/20"
                : "bg-[var(--danger-light)] border-[var(--danger)]/20"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${
                  esCuadrada
                    ? "bg-[var(--success)]/10 text-[var(--success)]"
                    : esSobrante
                    ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                    : "bg-[var(--danger)]/10 text-[var(--danger)]"
                }`}>
                  {esCuadrada ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                </div>
                <span className={`text-xs font-semibold ${
                  esCuadrada
                    ? "text-[var(--success)]"
                    : esSobrante
                    ? "text-[var(--warning)]"
                    : "text-[var(--danger)]"
                }`}>
                  {esCuadrada ? "Caja balanceada" : esSobrante ? "Sobrante" : "Faltante"}
                </span>
              </div>
              <span className={`text-sm font-black font-mono ${
                esCuadrada
                  ? "text-[var(--success)]"
                  : esSobrante
                  ? "text-[var(--warning)]"
                  : "text-[var(--danger)]"
              }`}>
                {diferencia >= 0 ? "+" : ""}{formatCurrency(diferencia)}
              </span>
            </div>
          )}

          {/* Observación del cierre (siempre visible) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Observación del cierre
            </label>
            <textarea
              placeholder="Ej: Faltante de $500, sobrante de $200..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] text-xs font-medium focus:outline-none focus:border-[var(--brand)] transition resize-none"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 bg-[var(--panel)] hover:bg-[var(--border)] text-[var(--text)] text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (montoContadoNum !== null) {
                onConfirm(crearPayloadCierre(montoContadoNum, observacion || undefined));
              }
            }}
            disabled={isPending || montoContado === ""}
            className="px-4 py-2 bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Cerrando...
              </>
            ) : (
              <>
                <Lock size={14} />
                Confirmar cierre
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
