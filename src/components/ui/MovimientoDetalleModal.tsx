"use client";

import React from "react";
import { formatCurrency, formatDate, formatTime24 } from "@/lib/utils";
import { formatMovimientoDescripcion } from "@/lib/movimiento-format";
import { X, Calendar, Clock, User, Tag, FileText, ArrowUpRight, ArrowDownLeft, Hash } from "lucide-react";

interface MovimientoDetalle {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date | string;
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
  const fechaStr = formatDate(d);
  const horaStr = formatTime24(d);

  const desc = movimiento.descripcion;
  let tipoLabel = "Movimiento";
  let badgeVariant: "success" | "danger" | "info" | "warning" | "default" = "default";

  if (isIncome) {
    badgeVariant = "success";
    if (desc.toLowerCase().includes("venta")) tipoLabel = "Venta";
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-lg rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
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
          <div className={`p-4 rounded-xl border ${isIncome ? "bg-[var(--success-light)] border-[var(--success)]/20" : "bg-[var(--danger-light)] border-[var(--danger)]/20"}`}>
            <p className={`text-xs font-semibold ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>Monto</p>
            <p className={`text-2xl font-black font-mono ${isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {isIncome ? "+" : "-"}{formatCurrency(movimiento.monto)}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} />
                Fecha y Hora
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
              <p className="text-sm text-[var(--text)] font-semibold">@{movimiento.usuario.username}</p>
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
                  ? `Compra #${movimiento.compraId}`
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

          {/* Descripción */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Descripción completa</p>
            <div className="p-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)] leading-relaxed">
              {formatMovimientoDescripcion(movimiento.descripcion)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
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

