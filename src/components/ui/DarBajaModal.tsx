"use client";

import React, { useState, useEffect } from "react";
import { MotivoEstadoProducto } from "@prisma/client";
import { darBajaProducto } from "@/actions/productos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DarBajaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: { id: number; nombre: string };
  onSuccess?: () => void;
}

const MOTIVOS: { value: MotivoEstadoProducto; label: string }[] = [
  { value: "VENCIDO", label: "Vencido" },
  { value: "DEFECTUOSO", label: "Defectuoso" },
  { value: "DISCONTINUADO", label: "Discontinuado" },
  { value: "BAJA_TEMPORAL", label: "Baja temporal" },
  { value: "YA_NO_SE_COMERCIALIZA", label: "Ya no se comercializa" },
  { value: "OTRO", label: "Otro" },
];

export default function DarBajaModal({
  open,
  onOpenChange,
  producto,
  onSuccess,
}: DarBajaModalProps) {
  const [motivo, setMotivo] = useState<string>("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo("");
      setObservacion("");
      setLoading(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const observacionRequired = motivo === "OTRO";
  const canSubmit =
    motivo !== "" &&
    (!observacionRequired || observacion.trim().length > 0) &&
    !loading;

  const handleSubmit = async () => {
    if (!canSubmit || motivo === "") return;
    setLoading(true);
    setError(null);

    try {
      const result = await darBajaProducto(
        producto.id,
        motivo as MotivoEstadoProducto,
        observacion.trim() || undefined
      );

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      onSuccess?.();
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err: any) {
      setError(err.message || "Error al dar de baja el producto");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-danger" />
            Dar de baja producto
          </DialogTitle>
          <DialogDescription>
            Se desactivará{" "}
            <span className="font-medium text-text">{producto.nombre}</span> del
            catálogo activo.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <p className="text-success font-semibold">
              Producto dado de baja correctamente
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Motivo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-muted">
                Motivo <span className="text-danger">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoEstadoProducto | "")}
                className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text focus:outline-none focus:border-brand transition"
              >
                <option value="">Seleccionar motivo...</option>
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Observación */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-muted">
                Observación{" "}
                {observacionRequired && (
                  <span className="text-danger">*</span>
                )}
              </label>
              <textarea
                placeholder="Detalles adicionales..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-brand transition resize-none"
              />
              {observacionRequired && (
                <p className="text-xs text-warning">
                  La observación es obligatoria cuando el motivo es &quot;Otro&quot;.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                {error}
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={loading}
            >
              Dar de baja
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
