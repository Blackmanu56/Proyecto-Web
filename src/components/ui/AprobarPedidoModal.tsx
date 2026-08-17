"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { aprobarReposicion } from "@/actions/reposiciones";
import type { SolicitudItem } from "@/types/solicitud";

interface AprobarPedidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: Pick<SolicitudItem, "id" | "cantidad" | "costoUnitario" | "total" | "origenPago" | "motivo"> & {
    producto: string;
    proveedor: string;
  };
  onSuccess: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

export default function AprobarPedidoModal({
  open,
  onOpenChange,
  solicitud,
  onSuccess,
}: AprobarPedidoModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await aprobarReposicion(solicitud.id);
      if (res.success) {
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || "Error al aprobar el pedido.");
      }
    });
  };

  const handleClose = () => {
    if (isPending) return;
    onOpenChange(false);
  };

  const summaryRows = [
    { label: "Producto", value: solicitud.producto },
    { label: "Proveedor", value: solicitud.proveedor },
    { label: "Cantidad", value: solicitud.cantidad },
    { label: "Costo unitario", value: formatCurrency(solicitud.costoUnitario) },
    { label: "Total", value: formatCurrency(solicitud.total), bold: true },
    { label: "Origen pago", value: solicitud.origenPago.replace(/_/g, " ") },
  ];

  if (solicitud.motivo) {
    summaryRows.push({ label: "Motivo", value: solicitud.motivo });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar pedido</DialogTitle>
          <DialogDescription>
            Revisá los datos antes de aprobar. Esta acción es irreversible.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          {summaryRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{row.label}</span>
              <span className={row.bold ? "font-bold text-[var(--brand)]" : "font-medium text-[var(--text)]"}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
          <AlertTriangle size={16} className="shrink-0 text-[#F59E0B] mt-0.5" />
          <p className="text-xs text-[#F59E0B]">
            Al aprobar se ejecutará el movimiento financiero y se actualizará el stock.
          </p>
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)] font-semibold">{error}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleApprove}
            disabled={isPending}
            loading={isPending}
          >
            Aprobar y ejecutar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
