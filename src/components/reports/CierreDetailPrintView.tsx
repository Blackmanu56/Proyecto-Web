"use client";

import React, { useState, useEffect } from "react";
import { getDetalleCierre } from "@/actions/informes";
import type { DetalleCierreCompleto } from "@/actions/informes";
import CierreDetailView from "./CierreDetailView";

interface CierreDetailPrintViewProps {
  cajaId: number;
}

export default function CierreDetailPrintView({ cajaId }: CierreDetailPrintViewProps) {
  const [detalleData, setDetalleData] = useState<DetalleCierreCompleto | null>(null);

  useEffect(() => {
    getDetalleCierre(cajaId).then((res) => setDetalleData(res));
  }, [cajaId]);

  useEffect(() => {
    if (detalleData) {
      const timer = setTimeout(() => window.print(), 150);
      return () => clearTimeout(timer);
    }
  }, [detalleData]);

  if (!detalleData) return null;

  return (
    <div className="hidden print:block print:bg-white print:text-black">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black uppercase tracking-wide">CHOPPER REPUESTOS</h1>
        <p className="text-sm text-gray-600 mt-1">Detalle de Cierre #{cajaId}</p>
        <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
          <span>Apertura: {detalleData.fechaApertura}</span>
          <span>Cierre: {detalleData.fechaCierre || "\u2014"}</span>
          <span>Usuario: {detalleData.usuario}</span>
          <span>Impreso: {new Date().toLocaleDateString("es-AR")} {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <hr className="my-3 border-gray-300" />
      </div>
      <CierreDetailView detalleData={detalleData} />
    </div>
  );
}
