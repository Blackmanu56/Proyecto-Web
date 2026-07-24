"use client";

import React, { useState, useEffect, useRef } from "react";
import { getDetalleVenta } from "@/actions/informes";
import type { DetalleVentaCompleto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import { X, Loader2, Printer } from "lucide-react";

interface Props {
  ventaId: number;
  onClose: () => void;
}

export default function TicketModal({ ventaId, onClose }: Props) {
  const [data, setData] = useState<DetalleVentaCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDetalleVenta(ventaId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [ventaId]);

  const handlePrint = () => {
    const content = ticketRef.current;
    if (!content) return;

    // Remove old overlay if exists
    const old = document.getElementById("print-overlay");
    if (old) old.remove();

    // Create overlay at body level with receipt content
    const overlay = document.createElement("div");
    overlay.id = "print-overlay";
    overlay.innerHTML = content.innerHTML;
    document.body.appendChild(overlay);

    // Add class to body to hide other elements during print
    document.body.classList.add("print-active");

    // Print then cleanup
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("print-active");
      }, 500);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white text-slate-900 border border-slate-300 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 font-mono text-xs">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
        >
          <X size={16} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : data ? (
          <>
            <div ref={ticketRef}>
              {/* Cabecera del Ticket */}
              <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
                <h3 className="text-base font-black uppercase tracking-wider">CHOPPER REPUESTOS</h3>
                <p className="text-[10px] text-slate-500 mt-1">Av. Roque Saenz Peña 1500 - Posadas</p>
                <p className="text-[10px] text-slate-500">CUIT: 37323400546</p>
              </div>

              {/* Metadata */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-4 mb-4">
                <div className="flex justify-between">
                  <span>FACTURA Nº:</span>
                  <span className="font-bold">#{data.id.toString().padStart(6, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span>FECHA:</span>
                  <span>{data.fecha}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLIENTE:</span>
                  <span className="font-bold truncate max-w-[70%]">{data.cliente.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span>VENDEDOR:</span>
                  <span className="truncate max-w-[60%]">{data.usuario.nombreCompleto || data.usuario.username}</span>
                </div>
              </div>

              {/* Desglose */}
              <div className="space-y-2 border-b border-dashed border-slate-300 pb-4 mb-4">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>DETALLE</span>
                  <span>CANT x PRECIO</span>
                </div>
                {data.detalles.map((det, index) => (
                  <div key={index} className="flex justify-between leading-normal">
                    <span className="truncate max-w-[65%]">{det.producto}</span>
                    <span className="font-mono text-right flex-shrink-0">
                      {det.cantidad} x {formatCurrency(det.precioUnitario)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between text-sm font-bold pb-4 mb-4 border-b border-slate-300">
                <span>TOTAL NETO:</span>
                <span className="font-mono text-slate-950 text-base">{formatCurrency(data.total)}</span>
              </div>

              {/* Pie */}
              <div className="text-center text-slate-500 space-y-2">
                <p className="text-[10px]">¡GRACIAS POR SU COMPRA!</p>
                <p className="text-[9px] italic">Este ticket sirve como constancia de pago.</p>
              </div>
            </div>

            <div className="pt-4 flex justify-center space-x-3 print:hidden">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-sans font-semibold rounded-lg flex items-center space-x-1.5 transition text-xs shadow-md"
              >
                <Printer size={12} />
                <span>Imprimir</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 font-sans font-semibold rounded-lg transition text-xs"
              >
                <span>Cerrar</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-red-500 py-8 font-sans">Error al cargar el ticket.</p>
        )}
      </div>
    </div>
  );
}
