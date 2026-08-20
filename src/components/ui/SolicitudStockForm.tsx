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
import { FormField } from "@/components/ui/form-field";
import {
  crearSolicitudStock,
} from "@/actions/solicitudes-stock";
import {
  AlertTriangle,
  CheckCircle,
  Package,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

/* ────────────────────── Types ────────────────────── */

interface SolicitudStockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: {
    id: number;
    nombre: string;
    cantidad: number;
    imagen?: string | null;
  };
  tipo: "RESTA" | "REPOSICION";
  onSuccess: () => void;
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudStockForm({
  open,
  onOpenChange,
  producto,
  tipo,
  onSuccess,
}: SolicitudStockFormProps) {
  const [cantidad, setCantidad] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const cantidadNum = typeof cantidad === "number" ? cantidad : 0;
  const isResta = tipo === "RESTA";
  const isValid =
    cantidadNum > 0 &&
    motivo.trim().length > 0 &&
    (!isResta || cantidadNum <= producto.cantidad);

  const handleSubmit = () => {
    if (!isValid) return;
    setError("");

    startTransition(async () => {
      try {
        const res = await crearSolicitudStock(
          tipo,
          producto.id,
          cantidadNum,
          motivo,
          observacion || undefined
        );

        if ("error" in res) {
          setError(res.error ?? "Error al enviar solicitud");
          return;
        }

        setSuccess(true);
        toast.success("Solicitud enviada", {
          description: `Tu solicitud de ${isResta ? "resta" : "reposición"} fue enviada para aprobación.`,
        });

        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al enviar la solicitud.");
      }
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setCantidad("");
    setMotivo("");
    setObservacion("");
    setError("");
    setSuccess(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
            {isResta ? "Solicitar resta de stock" : "Solicitar reposición de stock"}
          </DialogTitle>
          <DialogDescription>
            Enviá una solicitud que será revisada por un administrador.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-[var(--radius-md)] text-center">
            <CheckCircle
              size={32}
              className="mx-auto text-[var(--success)] mb-2"
            />
            <p className="text-sm font-semibold text-[var(--success)]">
              Solicitud enviada exitosamente
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Esperá la aprobación de un administrador.
            </p>
          </div>
        ) : (
          <>
            {/* Product info */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] flex items-center gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--card)] text-[var(--text-muted)]">
                <Package size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text)]">
                  {producto.nombre}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Stock actual:{" "}
                  <strong className="font-mono text-[var(--text)]">
                    {producto.cantidad} unidades
                  </strong>
                </p>
              </div>
            </div>

            {/* Tipo badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">Tipo:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isResta
                    ? "bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20"
                    : "bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/20"
                }`}
              >
                {isResta ? "Resta" : "Reposición"}
              </span>
            </div>

            {/* Cantidad */}
            <FormField label="Cantidad" required>
              <input
                type="number"
                min="1"
                max={isResta ? producto.cantidad : undefined}
                value={cantidad}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCantidad(isNaN(val) ? "" : Math.max(0, val));
                }}
                placeholder="0"
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
              {isResta && cantidadNum > producto.cantidad && (
                <p className="text-[11px] text-[var(--danger)] mt-1">
                  No puede solicitar más de {producto.cantidad} unidades (stock actual).
                </p>
              )}
            </FormField>

            {/* Motivo */}
            <FormField label="Motivo" required>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe el motivo de la solicitud..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
              />
            </FormField>

            {/* Observación (opcional) */}
            <FormField label="Observación (opcional)">
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Información adicional..."
                rows={2}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
              />
            </FormField>

            {/* Error */}
            {error && (
              <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
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
                onClick={handleSubmit}
                disabled={!isValid || isPending}
                loading={isPending}
                className={
                  isResta
                    ? "bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white"
                    : "bg-[var(--success)] hover:bg-[var(--success)]/90 text-white"
                }
              >
                Enviar solicitud
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
