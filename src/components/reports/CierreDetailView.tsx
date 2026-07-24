"use client";

import React from "react";
import type { DetalleCierreCompleto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar, Clock, User, Info, CheckCircle, XCircle, Coins,
  ArrowUpRight, ArrowDownLeft, Wallet, BadgePercent, Receipt,
} from "lucide-react";

interface CierreDetailViewProps {
  detalleData: DetalleCierreCompleto;
}

export default function CierreDetailView({ detalleData }: CierreDetailViewProps) {
  const ingresos = detalleData?.movimientos?.filter((m) => m.tipo === "INGRESO") || [];
  const egresos = detalleData?.movimientos?.filter((m) => m.tipo === "EGRESO") || [];
  const totalIngresos = ingresos.reduce((s, m) => s + m.monto, 0);
  const totalEgresos = egresos.reduce((s, m) => s + m.monto, 0);
  const resultadoNeto = totalIngresos - totalEgresos;

  return (
    <div className="space-y-6">
      {/* Metadata row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Calendar size={11} /> Apertura</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.fechaApertura}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Clock size={11} /> Cierre</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.fechaCierre || "\u2014"}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><User size={11} /> Usuario</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.usuario}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Info size={11} /> Estado</p>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-1 ${
            detalleData.estado === "ABIERTA"
              ? "bg-amber-500/10 text-amber-400 print:text-amber-700 print:bg-amber-100 border border-amber-500/20 print:border-amber-300"
              : "bg-emerald-500/10 text-emerald-400 print:text-emerald-700 print:bg-emerald-100 border border-emerald-500/20 print:border-emerald-300"
          }`}>
            {detalleData.estado === "ABIERTA" ? <XCircle size={12} /> : <CheckCircle size={12} />}
            {detalleData.estado}
          </span>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <Coins size={16} className="mx-auto mb-1 text-slate-400 print:text-gray-500" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Inicial</p>
          <p className="text-base font-bold text-white print:text-gray-900 font-mono">{formatCurrency(detalleData.montoInicial)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <ArrowUpRight size={16} className="mx-auto mb-1 text-emerald-400 print:text-emerald-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Ingresos</p>
          <p className="text-base font-bold text-emerald-400 print:text-emerald-600 font-mono">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <ArrowDownLeft size={16} className="mx-auto mb-1 text-rose-400 print:text-red-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Egresos</p>
          <p className="text-base font-bold text-rose-400 print:text-red-600 font-mono">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <Wallet size={16} className="mx-auto mb-1 text-sky-400 print:text-sky-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Esperado</p>
          <p className="text-base font-bold text-sky-400 print:text-sky-600 font-mono">{formatCurrency(detalleData.totalEsperado)}</p>
        </div>
        <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/20 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <BadgePercent size={16} className={"mx-auto mb-1 " + (detalleData.diferencia !== null && detalleData.diferencia !== 0 ? "text-amber-400 print:text-amber-600" : "text-slate-400 print:text-gray-500")} />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Diferencia</p>
          {detalleData.diferencia !== null ? (
            <p className={"text-base font-bold font-mono " + (detalleData.diferencia >= 0 ? "text-emerald-400 print:text-emerald-600" : "text-rose-400 print:text-red-600")}>
              {detalleData.diferencia > 0 ? "+" : ""}{formatCurrency(detalleData.diferencia)}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-500 print:text-gray-500 font-mono">\u2014</p>
          )}
        </div>
      </div>

      {/* Ingresos */}
      {ingresos.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-emerald-400 print:text-emerald-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <ArrowUpRight size={14} />
            Ingresos ({ingresos.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-emerald-500/10 print:border-emerald-300 max-h-60 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-emerald-500/5 print:bg-emerald-50 border-b border-emerald-500/10 print:border-emerald-300">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Hora</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Concepto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/5 print:divide-emerald-200">
                {ingresos.map((m) => (
                  <tr key={m.id} className="hover:bg-emerald-500/5 print:hover:bg-transparent transition-colors">
                    <td className="px-3 py-2 text-slate-400 print:text-gray-600 font-mono">
                      {m.fecha?.split(" ")[1] || m.fecha}
                    </td>
                    <td className="px-3 py-2 text-white print:text-gray-900 font-medium truncate max-w-[200px]">{m.descripcion}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 print:text-emerald-700 font-bold font-mono">+{formatCurrency(m.monto)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 print:text-gray-500">@{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Egresos */}
      {egresos.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-rose-400 print:text-red-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <ArrowDownLeft size={14} />
            Egresos ({egresos.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-rose-500/10 print:border-red-300 max-h-60 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-rose-500/5 print:bg-red-50 border-b border-rose-500/10 print:border-red-300">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Hora</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Concepto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-500/5 print:divide-red-200">
                {egresos.map((m) => (
                  <tr key={m.id} className="hover:bg-rose-500/5 print:hover:bg-transparent transition-colors">
                    <td className="px-3 py-2 text-slate-400 print:text-gray-600 font-mono">
                      {m.fecha?.split(" ")[1] || m.fecha}
                    </td>
                    <td className="px-3 py-2 text-white print:text-gray-900 font-medium truncate max-w-[200px]">{m.descripcion}</td>
                    <td className="px-3 py-2 text-right text-rose-400 print:text-red-700 font-bold font-mono">-{formatCurrency(m.monto)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 print:text-gray-500">@{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ingresos.length === 0 && egresos.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Receipt size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Sin movimientos registrados</p>
          <p className="text-xs mt-1">Este cierre no tiene movimientos de ingresos ni egresos.</p>
        </div>
      )}

      {(ingresos.length > 0 || egresos.length > 0) && (
        <div className="bg-slate-800/30 print:bg-gray-100 border border-slate-700/50 print:border-gray-300 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 print:text-gray-700 uppercase tracking-wider mb-3">Resumen Final</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Cant. Ingresos</p>
              <p className="text-base font-bold text-emerald-400 print:text-emerald-700">{ingresos.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Cant. Egresos</p>
              <p className="text-base font-bold text-rose-400 print:text-red-700">{egresos.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Total Ingresos</p>
              <p className="text-base font-bold text-emerald-400 print:text-emerald-700 font-mono">{formatCurrency(totalIngresos)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Total Egresos</p>
              <p className="text-base font-bold text-rose-400 print:text-red-700 font-mono">{formatCurrency(totalEgresos)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50 print:border-gray-300 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 print:text-gray-700 uppercase tracking-wider">Resultado Neto</span>
            <span className={"text-lg font-black font-mono " + (resultadoNeto >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-rose-400 print:text-red-700")}>
              {resultadoNeto >= 0 ? "+" : ""}{formatCurrency(resultadoNeto)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
