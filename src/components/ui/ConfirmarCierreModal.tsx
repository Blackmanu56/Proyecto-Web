"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Lock, X, Loader2, Coins, ArrowUpRight, ArrowDownLeft, TrendingUp, Scale, AlertTriangle, CheckCircle2, Eye } from "lucide-react";

interface ConfirmarCierreModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (observacion?: string) => void;
  isPending: boolean;
  montoInicial: number;
  totalVentas: number;
  totalIngresos: number;
  totalEgresos: number;
}

export default function ConfirmarCierreModal({
  open,
  onClose,
  onConfirm,
  isPending,
  montoInicial,
  totalVentas,
  totalEgresos,
  totalIngresos,
}: ConfirmarCierreModalProps) {
  const [montoContado, setMontoContado] = useState("");
  const [observacion, setObservacion] = useState("");
  const [showObservacion, setShowObservacion] = useState(false);

  useEffect(() => {
    if (open) {
      setMontoContado("");
      setObservacion("");
      setShowObservacion(false);
    }
  }, [open]);

  if (!open) return null;

  const movimientosNetos = totalVentas;
  const saldoFinal = montoInicial + movimientosNetos;
  const montoContadoNum = montoContado === "" ? null : Number(montoContado);
  const diferencia = montoContadoNum !== null ? montoContadoNum - saldoFinal : null;
  const tieneDiferencia = diferencia !== null && Math.abs(diferencia) > 0.01;
  const esCuadrada = diferencia !== null && !tieneDiferencia;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale size={18} className="text-amber-400" />
            Arqueo de Caja
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-slate-400 font-medium mb-3">
            Revise los valores antes de confirmar el cierre. Ingrese el monto contado en efectivo.
          </p>

          {/* Saldo Esperado */}
          <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <TrendingUp size={14} />
              </div>
              <span className="text-xs font-semibold text-indigo-300">Saldo esperado en caja</span>
            </div>
            <span className="text-sm font-black text-indigo-300 font-mono">
              {formatCurrency(saldoFinal)}
            </span>
          </div>

          {/* Monto Contado - INPUT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Monto contado (efectivo en mano)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
              <input
                type="number"
                placeholder="0.00"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition"
                disabled={isPending}
                step="0.01"
              />
            </div>
          </div>

          {/* Diferencia (solo si ingresa monto) */}
          {diferencia !== null && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
              esCuadrada
                ? "bg-emerald-950/30 border-emerald-500/30"
                : "bg-red-950/30 border-red-500/30"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${esCuadrada ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  {esCuadrada ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                </div>
                <span className={`text-xs font-semibold ${esCuadrada ? "text-emerald-300" : "text-red-300"}`}>
                  {esCuadrada ? "Caja cuadrada" : "Diferencia"}
                </span>
              </div>
              <span className={`text-sm font-black font-mono ${esCuadrada ? "text-emerald-400" : "text-red-400"}`}>
                {diferencia >= 0 ? "+" : ""}{formatCurrency(diferencia)}
              </span>
            </div>
          )}

          {/* Resumen de movimientos */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={12} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-slate-400">Ingresos</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 font-mono">{formatCurrency(totalIngresos)}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft size={12} className="text-red-400" />
                <span className="text-[10px] font-semibold text-slate-400">Egresos</span>
              </div>
              <span className="text-xs font-bold text-red-400 font-mono">{formatCurrency(totalEgresos)}</span>
            </div>
          </div>

          {/* Toggle Observación */}
          {!showObservacion ? (
            <button
              type="button"
              onClick={() => setShowObservacion(true)}
              className="w-full text-left text-[10px] text-slate-500 hover:text-slate-300 font-semibold uppercase tracking-wider transition flex items-center gap-1"
            >
              <Eye size={10} />
              Agregar observación (opcional)
            </button>
          ) : (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Observación del cierre
              </label>
              <textarea
                placeholder="Ej: Faltante de $500, sobrante de $200..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500 transition resize-none"
                disabled={isPending}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(observacion || undefined)}
            disabled={isPending || montoContado === ""}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
