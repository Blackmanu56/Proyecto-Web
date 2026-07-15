"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { X, Calendar, Clock, User, Tag, FileText, ArrowUpRight, ArrowDownLeft, Hash } from "lucide-react";

interface MovimientoDetalle {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date;
  usuario: { username: string };
  ventaId?: number | null;
  compraId?: number | null;
  itemNumber?: number;
  saldoAcumulado?: number;
}

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
  if (!open || !movimiento) return null;

  const isIncome = movimiento.tipo === "INGRESO";
  const d = new Date(movimiento.fecha);
  const fechaStr = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaStr = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Parse description to extract structured info
  const desc = movimiento.descripcion;
  let tipoLabel = "Movimiento";
  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";

  if (isIncome) {
    badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (desc.toLowerCase().includes("venta")) tipoLabel = "Venta";
    else if (desc.toLowerCase().includes("apertura")) tipoLabel = "Apertura";
    else tipoLabel = "Ingreso";
  } else {
    badgeColor = "bg-red-100 text-red-700 border-red-200";
    if (desc.toLowerCase().includes("gasto")) tipoLabel = "Gasto";
    else if (desc.toLowerCase().includes("reposici")) tipoLabel = "Reposición";
    else if (desc.toLowerCase().includes("stock inicial")) tipoLabel = "Reposición";
    else if (desc.toLowerCase().includes("cierre")) tipoLabel = "Cierre";
    else if (desc.toLowerCase().includes("ajuste")) tipoLabel = "Ajuste";
    else tipoLabel = "Egreso";
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            Detalle del Movimiento
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-300 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Tipo Badge + ID */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${badgeColor}`}>
              {isIncome ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
              {tipoLabel}
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Hash size={12} />
              #{movimiento.itemNumber || movimiento.id}
            </span>
          </div>

          {/* Monto */}
          <div className={`p-4 rounded-xl border ${isIncome ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <p className={`text-xs font-semibold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>Monto</p>
            <p className={`text-2xl font-black font-mono ${isIncome ? "text-emerald-700" : "text-red-700"}`}>
              {isIncome ? "+" : "-"}{formatCurrency(movimiento.monto)}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} />
                Fecha
              </p>
              <p className="text-sm text-slate-700 font-semibold capitalize">{fechaStr}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} />
                Hora
              </p>
              <p className="text-sm text-slate-700 font-mono font-semibold">{horaStr}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <User size={10} />
                Usuario
              </p>
              <p className="text-sm text-slate-700 font-semibold">@{movimiento.usuario.username}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} />
                Referencia
              </p>
              <p className="text-sm text-slate-700 font-semibold">
                {movimiento.ventaId
                  ? `Venta #${movimiento.ventaId}`
                  : movimiento.compraId
                  ? `Compra #${movimiento.compraId}`
                  : "Sin referencia"}
              </p>
            </div>
          </div>

          {/* Saldo acumulado */}
          {movimiento.saldoAcumulado !== undefined && (
            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">Saldo acumulado tras este movimiento</span>
                <span className={`text-sm font-black font-mono ${movimiento.saldoAcumulado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(movimiento.saldoAcumulado)}
                </span>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descripción completa</p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              {movimiento.descripcion}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
