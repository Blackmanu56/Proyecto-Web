"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDetalleCierre } from "@/actions/informes";
import type { DetalleCierreCompleto } from "@/actions/informes";
import { Loader2, Printer, Wallet } from "lucide-react";
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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0 pr-12">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20 shrink-0">
              <Wallet size={18} />
            </div>
            Detalle de Cierre de Caja
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-muted)] font-mono">
            {detalleData
              ? `Arqueo de caja #${detalleData.id} • Apertura: ${detalleData.fechaApertura}`
              : `Arqueo de caja #${cajaId}`}
          </DialogDescription>
        </DialogHeader>

        {/* Body scrollable con barra de desplazamiento */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--brand)]" />
              <p className="text-xs text-[var(--text-muted)]">Cargando detalle del cierre...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[var(--danger)]">
                Error al cargar el detalle del cierre.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                No se pudo obtener la información solicitada. Por favor, intente nuevamente.
              </p>
            </div>
          ) : detalleData ? (
            <CierreDetailView detalleData={detalleData} />
          ) : null}
        </div>

        {/* Footer fijo abajo */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] shrink-0 flex items-center justify-between gap-3">
          {detalleData && (
            <Button
              type="button"
              onClick={() => onPrint(cajaId)}
              className="bg-[var(--brand)] hover:bg-[var(--brand)]/85 text-white shadow-sm font-bold active:scale-95 flex items-center gap-2"
            >
              <Printer size={15} />
              Imprimir cierre
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="ml-auto"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
