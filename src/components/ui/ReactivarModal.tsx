"use client";

import React, { useState } from "react";
import { reactivarProducto } from "@/actions/productos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ReactivarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: { id: number; nombre: string };
  onSuccess?: () => void;
}

export default function ReactivarModal(props: ReactivarModalProps) {
  if (!props.open) return null;

  return <ReactivarModalContent key={props.producto.id} {...props} />;
}

function ReactivarModalContent({
  open,
  onOpenChange,
  producto,
  onSuccess,
}: ReactivarModalProps) {
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await reactivarProducto(
        producto.id,
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al reactivar el producto");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-success" />
            Reactivar producto
          </DialogTitle>
          <DialogDescription>
            ¿Desea reactivar el producto{" "}
            <span className="font-medium text-text">{producto.nombre}</span> y
            devolverlo al catálogo activo?
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <p className="text-success font-semibold">
              Producto reactivado correctamente
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Observación */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-muted">
                Observación (opcional)
              </label>
              <textarea
                placeholder="Motivo de la reactivación..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-brand transition resize-none"
              />
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
              variant="success"
              onClick={handleSubmit}
              disabled={loading}
              loading={loading}
            >
              Reactivar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
