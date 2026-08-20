"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  aprobarSolicitudStock,
  rechazarSolicitudStock,
} from "@/actions/solicitudes-stock";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Minus,
  Package,
  Plus,
  User,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

/* ────────────────────── Types ────────────────────── */

interface SolicitudData {
  id: number;
  tipo: "RESTA" | "REPOSICION";
  cantidad: number;
  stockAnterior: number;
  motivo: string;
  estado: string;
  observacionResolucion?: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  producto: { id: number; nombre: string; cantidad: number };
  solicitante: { id: number; nombreCompleto: string };
  resueltoPor?: { id: number; nombreCompleto: string } | null;
}

interface SolicitudStockDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudData;
  onSuccess: () => void;
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudStockDetail({
  open,
  onOpenChange,
  solicitud,
  onSuccess,
}: SolicitudStockDetailProps) {
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  const isResta = solicitud.tipo === "RESTA";
  const isPendiente = solicitud.estado === "PENDIENTE";

  const handleApprove = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await aprobarSolicitudStock(solicitud.id);
        if ("error" in res) {
          setError(res.error ?? "Error al aprobar");
          return;
        }
        setSuccess(true);
        toast.success("Solicitud aprobada");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al aprobar.");
      }
    });
  };

  const handleReject = () => {
    if (!rejectMotivo.trim()) {
      setError("El motivo de rechazo es obligatorio.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const res = await rechazarSolicitudStock(solicitud.id, rejectMotivo);
        if ("error" in res) {
          setError(res.error ?? "Error al rechazar");
          return;
        }
        setSuccess(true);
        toast.success("Solicitud rechazada");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al rechazar.");
      }
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setRejectMotivo("");
    setShowRejectInput(false);
    setError("");
    setSuccess(false);
  };

  const fechaStr = (() => {
    try {
      return format(new Date(solicitud.createdAt), "dd 'de' MMMM, HH:mm", { locale: es });
    } catch {
      return String(solicitud.createdAt);
    }
  })();

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="p-6 text-center">
            <CheckCircle
              size={40}
              className="mx-auto text-[var(--success)] mb-3"
            />
            <p className="text-sm font-semibold text-[var(--success)]">
              Acción completada
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={`p-2 rounded-[var(--radius-md)] ${
                isResta
                  ? "bg-[var(--danger-light)] text-[var(--danger)]"
                  : "bg-[var(--success-light)] text-[var(--success)]"
              }`}
            >
              {isResta ? <Minus size={18} /> : <Plus size={18} />}
            </div>
            Solicitud #{solicitud.id}
          </DialogTitle>
          <DialogDescription>
            {isPendiente
              ? "Revisá los detalles y aprobá o rechazá esta solicitud."
              : `Estado: ${solicitud.estado}`}
          </DialogDescription>
        </DialogHeader>

        {/* Summary card */}
        <div className="space-y-3 p-4 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)]">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text)]">
              {solicitud.producto.nombre}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Tipo</span>
              <p
                className={`font-bold uppercase ${
                  isResta ? "text-[var(--danger)]" : "text-[var(--success)]"
                }`}
              >
                {solicitud.tipo}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Cantidad</span>
              <p className="font-bold text-[var(--text)] font-mono">
                {solicitud.cantidad} unidades
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Stock actual</span>
              <p className="font-mono text-[var(--text)]">
                {solicitud.producto.cantidad} unidades
              </p>
            </div>
            {isResta && (
              <div>
                <span className="text-[var(--text-muted)]">Stock post-aprobación</span>
                <p className="font-mono text-[var(--danger)]">
                  {Math.max(0, solicitud.producto.cantidad - solicitud.cantidad)} unidades
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)]/40 pt-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Motivo</p>
            <p className="text-sm text-[var(--text)]">{solicitud.motivo}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <User size={12} />
              <span>{solicitud.solicitante.nombreCompleto}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>{fechaStr}</span>
            </div>
          </div>

          {solicitud.resueltoPor && (
            <div className="border-t border-[var(--border)]/40 pt-3 text-xs text-[var(--text-secondary)]">
              Resuelto por: {solicitud.resueltoPor.nombreCompleto}
            </div>
          )}

          {solicitud.observacionResolucion && (
            <div className="text-xs">
              <span className="text-[var(--text-muted)]">Observación: </span>
              <span className="text-[var(--text)]">{solicitud.observacionResolucion}</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Actions — only for PENDIENTE */}
        {isPendiente && !success && (
          <div className="space-y-3">
            {showRejectInput && (
              <div>
                <label className="block text-xs font-medium text-[var(--text)] mb-1.5">
                  Motivo de rechazo *
                </label>
                <textarea
                  value={rejectMotivo}
                  onChange={(e) => setRejectMotivo(e.target.value)}
                  placeholder="Indicá por qué se rechaza esta solicitud..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              {!showRejectInput ? (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isTransitionPending}
                    leftIcon={<XCircle size={14} />}
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleApprove}
                    disabled={isTransitionPending}
                    loading={isTransitionPending}
                    leftIcon={<CheckCircle size={14} />}
                  >
                    Aprobar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowRejectInput(false);
                      setRejectMotivo("");
                      setError("");
                    }}
                    disabled={isTransitionPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleReject}
                    disabled={isTransitionPending || !rejectMotivo.trim()}
                    loading={isTransitionPending}
                    leftIcon={<XCircle size={14} />}
                  >
                    Confirmar rechazo
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
