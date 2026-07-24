"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";

/* ────────────────────── Types ────────────────────── */

interface RestarStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: {
    id: number;
    nombre: string;
    cantidad: number;
  };
  onSuccess: () => void;
  restarStockAction: (
    productoId: number,
    cantidad: number,
    motivo: string,
    observacion?: string
  ) => Promise<{ success?: boolean; error?: string; stockNuevo?: number }>;
}

const MOTIVOS = [
  "Producto vencido",
  "Producto dañado",
  "Producto descartado",
  "No se comercializará más",
  "Ajuste de inventario",
  "Otro",
];

/* ────────────────────── Component ────────────────────── */

export default function RestarStockModal({
  open,
  onOpenChange,
  producto,
  onSuccess,
  restarStockAction,
}: RestarStockModalProps) {
  const [cantidad, setCantidad] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [stockResult, setStockResult] = useState<number | null>(null);

  const cantidadNum = typeof cantidad === "number" ? cantidad : 0;
  const isValid = cantidadNum > 0 && cantidadNum <= producto.cantidad && motivo;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      const res = await restarStockAction(
        producto.id,
        cantidadNum,
        motivo,
        motivo === "Otro" ? observacion : undefined
      );

      if (res.success) {
        setSuccess(true);
        setStockResult(res.stockNuevo ?? null);
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
          // Reset state
          setCantidad("");
          setMotivo("");
          setObservacion("");
          setSuccess(false);
          setStockResult(null);
        }, 1500);
      } else {
        setError(res.error || "Error al restar stock.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCantidad("");
    setMotivo("");
    setObservacion("");
    setError("");
    setSuccess(false);
    setStockResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)]">
              <Package size={18} />
            </div>
            Restar stock
          </DialogTitle>
          <DialogDescription>
            Descontar unidades del producto sin realizar una venta.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-[var(--radius-md)] text-center">
            <CheckCircle size={32} className="mx-auto text-[var(--success)] mb-2" />
            <p className="text-sm font-semibold text-[var(--success)]">
              Stock actualizado exitosamente.
            </p>
            {stockResult !== null && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Nuevo stock: <strong>{stockResult}</strong> unidades
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Info del producto */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <p className="text-sm font-medium text-[var(--text)]">{producto.nombre}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Stock actual:{" "}
                <strong className={`font-mono ${producto.cantidad <= 5 ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>
                  {producto.cantidad} unidades
                </strong>
              </p>
            </div>

            {/* Cantidad */}
            <FormField label="Cantidad a descontar" required>
              <input
                type="number"
                min="1"
                max={producto.cantidad}
                value={cantidad}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCantidad(isNaN(val) ? "" : Math.max(0, val));
                }}
                placeholder="0"
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
              {cantidadNum > producto.cantidad && (
                <p className="text-[11px] text-[var(--danger)] mt-1">
                  No puede descontar más de {producto.cantidad} unidades.
                </p>
              )}
            </FormField>

            {/* Motivo */}
            <FormField label="Motivo" required>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] appearance-none transition-colors"
              >
                <option value="">Seleccione un motivo...</option>
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Observación (solo si motivo es "Otro") */}
            {motivo === "Otro" && (
              <FormField label="Observación" required>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Describe el motivo..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
                />
              </FormField>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white"
              >
                {loading ? "Procesando..." : "Confirmar descuento"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
