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
import { rechazarReposicion } from "@/actions/reposiciones";

interface RechazarPedidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitudId: number;
  solicitudNombre: string;
  onSuccess: () => void;
}

export default function RechazarPedidoModal({
  open,
  onOpenChange,
  solicitudId,
  solicitudNombre,
  onSuccess,
}: RechazarPedidoModalProps) {
  const [isPending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = motivo.trim().length >= 3 && !isPending;

  const handleReject = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await rechazarReposicion(solicitudId, motivo.trim());
      if (res.success) {
        setMotivo("");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || "Error al rechazar el pedido.");
      }
    });
  };

  const handleClose = () => {
    if (isPending) return;
    setMotivo("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar pedido</DialogTitle>
          <DialogDescription>
            Vas a rechazar el pedido de <strong>{solicitudNombre}</strong>. Esta
            información quedará registrada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text)]">
            Motivo del rechazo <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Describí el motivo del rechazo..."
            rows={3}
            minLength={3}
            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none"
          />
          {motivo.length > 0 && motivo.trim().length < 3 && (
            <p className="text-xs text-[var(--danger)]">
              El motivo debe tener al menos 3 caracteres.
            </p>
          )}
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
            variant="danger"
            onClick={handleReject}
            disabled={!canSubmit}
            loading={isPending}
          >
            Rechazar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
