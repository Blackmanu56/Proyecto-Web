"use client";

import React, { useState, useEffect } from "react";
import { getDetalleVenta } from "@/actions/informes";
import type { DetalleVentaCompleto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import { X, Loader2, Package, User, Hash, Calendar, CreditCard, CheckCircle, Printer } from "lucide-react";

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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package size={18} className="text-sky-400" />
            Detalle de Venta
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <p className="text-center text-red-400 py-8">Error al cargar el detalle de la venta.</p>
          ) : data ? (
            <>
              {/* Metadata de la venta */}
              <div className="grid grid-cols-2 gap-3 bg-slate-800/50 rounded-xl p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Hash size={12} /> N° Factura
                  </p>
                  <p className="text-sm font-bold text-white">#{data.id.toString().padStart(6, "0")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Calendar size={12} /> Fecha y Hora
                  </p>
                  <p className="text-sm font-bold text-white">{data.fecha}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <User size={12} /> Vendedor / Cajero
                  </p>
                  <p className="text-sm font-bold text-white">{data.usuario.nombreCompleto || data.usuario.username}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <CreditCard size={12} /> Método de Pago
                  </p>
                  {data.metodoPago ? (
                    <p className="text-sm font-bold text-white">{data.metodoPago}</p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No registrado</p>
                  )}
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <User size={12} /> Cliente
                  </p>
                  <p className="text-sm font-bold text-white">{data.cliente.nombre}</p>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>DNI: {data.cliente.dni}</span>
                    {data.cliente.cuit && <span>CUIT: {data.cliente.cuit}</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <CheckCircle size={12} /> Estado
                  </p>
                  {data.estado === "COMPLETADA" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold">
                      <CheckCircle size={10} />
                      {data.estado}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-bold">
                      {data.estado}
                    </span>
                  )}
                </div>
              </div>

              {/* Productos */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Productos ({data.detalles.length})
                </h3>
                <div className="space-y-2">
                  {data.detalles.map((det) => (
                    <div
                      key={det.id}
                      className="flex items-center justify-between bg-slate-800/30 border border-slate-800 rounded-lg px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{det.producto}</p>
                        <p className="text-xs text-slate-400">
                          Cant: {det.cantidad} x {formatCurrency(det.precioUnitario)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-emerald-400 ml-4">
                        {formatCurrency(det.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-slate-300">TOTAL</span>
                <span className="text-lg font-black text-emerald-400">{formatCurrency(data.total)}</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {onPrintTicket && data && (
            <button
              onClick={onPrintTicket}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
            >
              <Printer size={14} />
              Imprimir Ticket / Factura
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
