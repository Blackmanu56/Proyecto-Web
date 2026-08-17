"use client";

import React, { useState, useEffect } from "react";
import { getDetalleCierre } from "@/actions/informes";
import type { DetalleCierreCompleto } from "@/actions/informes";
import { Loader2, Printer, X, Wallet } from "lucide-react";
import CierreDetailView from "./CierreDetailView";

interface CierreDetailModalProps {
  cajaId: number;
  onClose: () => void;
  onPrint: (id: number) => void;
}

export default function CierreDetailModal({ cajaId, onClose, onPrint }: CierreDetailModalProps) {
  const [detalleData, setDetalleData] = useState<DetalleCierreCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDetalleCierre(cajaId)
      .then((res) => {
        setDetalleData(res);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [cajaId]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-panel border border-border w-full max-w-4xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet size={18} className="text-sky-400" />
            Detalle de Cierre
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-border text-text-muted hover:text-text hover:bg-border-hover transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <p className="text-center text-rose-400 py-8 text-sm">Error al cargar detalle.</p>
          ) : detalleData ? (
            <>
              <CierreDetailView detalleData={detalleData} />
              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <button
                  onClick={() => onPrint(cajaId)}
                  className="px-4 py-2 bg-border hover:bg-border-hover text-text text-sm font-bold rounded-lg flex items-center gap-2 transition"
                >
                  <Printer size={14} />
                  Imprimir cierre
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
