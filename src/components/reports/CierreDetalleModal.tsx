"use client";

import React, { useState, useEffect } from "react";
import { getDetalleCierre } from "@/actions/informes";
import type { DetalleCierreCompleto } from "@/actions/informes";
import { Wallet, X, Loader2, Printer } from "lucide-react";
import CierreDetailView from "./CierreDetailView";

interface CierreDetalleModalProps {
  cajaId: number;
  onClose: () => void;
  onPrint: (id: number) => void;
}

export default function CierreDetalleModal({ cajaId, onClose, onPrint }: CierreDetalleModalProps) {
  const [detalleData, setDetalleData] = useState<DetalleCierreCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    getDetalleCierre(cajaId)
      .then((res) => {
        if (ignore) return;
        if (!res) {
          setError(true);
        } else {
          setDetalleData(res);
        }
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [cajaId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border w-full max-w-3xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet size={18} className="text-sky-400" />
            Detalle de Arqueo
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle de arqueo"
            className="p-1.5 rounded-lg bg-border text-text-muted hover:text-text hover:bg-border-hover transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <p className="text-center text-red-400 py-8">Error al cargar el detalle del arqueo.</p>
          ) : detalleData ? (
            <CierreDetailView detalleData={detalleData} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          {detalleData && (
            <button
              onClick={() => {
                onPrint(cajaId);
                onClose();
              }}
              className="px-4 py-2 bg-border hover:bg-border-hover text-text text-sm font-bold rounded-lg flex items-center gap-2 transition"
            >
              <Printer size={14} />
              Imprimir cierre
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-border hover:bg-border-hover text-text text-sm font-bold rounded-lg transition ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
