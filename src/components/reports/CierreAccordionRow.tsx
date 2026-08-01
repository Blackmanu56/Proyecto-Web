"use client";

import React, { useState, useEffect } from "react";
import { getDetalleCierre } from "@/actions/informes";
import type { DetalleCierreCompleto } from "@/actions/informes";
import { Loader2, Printer, X } from "lucide-react";
import CierreDetailView from "./CierreDetailView";

interface CierreAccordionRowProps {
  cajaId: number;
  onPrint: (id: number) => void;
}

export default function CierreAccordionRow({ cajaId, onPrint }: CierreAccordionRowProps) {
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
    <div className="p-4 bg-panel/30">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : error ? (
        <p className="text-center text-rose-400 py-8 text-sm">Error al cargar detalle.</p>
      ) : detalleData ? (
        <>
          <CierreDetailView detalleData={detalleData} />
          <div className="mt-4 pt-3 border-t border-border flex justify-end print:hidden">
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
  );
}
