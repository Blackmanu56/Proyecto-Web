"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import { Lock, X, Loader2, Coins, ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

interface ConfirmarCierreModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
  if (!open) return null;

  const movimientosNetos = totalVentas;
  const saldoFinal = montoInicial + movimientosNetos;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock size={18} className="text-red-400" />
            Confirmar cierre de caja
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
            Revise los valores antes de confirmar el cierre de caja.
          </p>

          {/* Monto Inicial */}
          <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400">
                <Coins size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-300">Monto inicial</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">
              {formatCurrency(montoInicial)}
            </span>
          </div>

          {/* Total Ingresos */}
          <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ArrowUpRight size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-300">Total ingresos</span>
            </div>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {formatCurrency(totalIngresos)}
            </span>
          </div>

          {/* Total Egresos */}
          <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                <ArrowDownLeft size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-300">Total egresos</span>
            </div>
            <span className="text-sm font-bold text-red-400 font-mono">
              {formatCurrency(totalEgresos)}
            </span>
          </div>

          {/* Movimientos Netos */}
          <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <TrendingUp size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-300">Movimientos netos</span>
            </div>
            <span className={`text-sm font-bold font-mono ${
              movimientosNetos >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {movimientosNetos >= 0 ? "+" : ""}{formatCurrency(movimientosNetos)}
            </span>
          </div>

          {/* Separator */}
          <div className="border-t border-slate-700/50 pt-3">
            {/* Saldo Final */}
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-950/60 to-slate-900/60 border border-indigo-500/20 rounded-xl px-4 py-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Lock size={14} />
                </div>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Saldo final esperado</span>
              </div>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(saldoFinal)}
              </span>
            </div>
          </div>
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
            onClick={onConfirm}
            disabled={isPending}
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
