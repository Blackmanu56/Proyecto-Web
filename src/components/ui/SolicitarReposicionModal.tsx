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
import { PaymentDistribution, PaymentMethod } from "@/components/ui/PaymentDistribution";
import { PackagePlus, AlertTriangle, CheckCircle } from "lucide-react";
import { solicitarReposicion, reponerStockDirecto } from "@/actions/reposiciones";
import { isProductPaymentDistributionIncomplete } from "@/lib/product-purchase-payments";

/* ────────────────────── Types ────────────────────── */

interface SolicitarReposicionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: {
    id: number;
    nombre: string;
    cantidad: number;
    precioCompra: number;
    proveedorId: number;
  };
  cajaBalance: number;
  cajaAbierta: boolean;
  onSuccess: () => void;
  mode?: "solicitar" | "reponer_directo";
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitarReposicionModal({
  open,
  onOpenChange,
  producto,
  cajaBalance,
  cajaAbierta,
  onSuccess,
  mode = "solicitar",
}: SolicitarReposicionModalProps) {
  const [cantidad, setCantidad] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const cantidadNum = typeof cantidad === "number" ? cantidad : 0;
  const total = cantidadNum * producto.precioCompra;
  const distribucionIncompleta = isProductPaymentDistributionIncomplete(total, payments);
  const isValid = cantidadNum > 0 && motivo && !distribucionIncompleta;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      // Build FormData to use getProductPurchaseCost with "reposicion" mode
      const fd = new FormData();
      fd.set("cantidad", String(cantidadNum));
      fd.set("precioCompra", String(producto.precioCompra));

      const validPayments = payments.filter(p => p.monto > 0);

      const action = mode === "reponer_directo" ? reponerStockDirecto : solicitarReposicion;
      const res = await action(producto.id, {
        cantidad: cantidadNum,
        proveedorId: producto.proveedorId,
        origenPago: validPayments.length > 0
          ? (validPayments[0].medio as "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA")
          : "EFECTIVO_CAJA",
        pagos: validPayments.length > 0
          ? validPayments.map(p => ({
              medio: p.medio as "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA",
              monto: p.monto,
              observacion: p.observacion || undefined,
            }))
          : undefined,
        motivo: motivo || undefined,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
          // Reset state
          setCantidad("");
          setMotivo("");
          setPayments([]);
          setSuccess(false);
        }, 1500);
      } else {
        setError(res.error || "Error al solicitar reposición.");
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
    setPayments([]);
    setError("");
    setSuccess(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[#047857]/10 text-[#059669]">
              <PackagePlus size={18} />
            </div>
            {mode === "reponer_directo" ? "Reponer stock" : "Solicitar reposición"}
          </DialogTitle>
          <DialogDescription>
            {mode === "reponer_directo"
              ? <>Reponer stock directamente para <strong>{producto.nombre}</strong>.</>
              : <>Crear una solicitud de reposición para <strong>{producto.nombre}</strong>.</>
            }
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-[var(--radius-md)] text-center">
            <CheckCircle size={32} className="mx-auto text-[var(--success)] mb-2" />
            <p className="text-sm font-semibold text-[var(--success)]">
              {mode === "reponer_directo" ? "Stock repuesto exitosamente." : "Solicitud creada exitosamente."}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {mode === "reponer_directo" ? "El stock se actualizó inmediatamente." : "Esperando aprobación del administrador."}
            </p>
          </div>
        ) : (
          <>
            {/* Info del producto */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <p className="text-sm font-medium text-[var(--text)]">{producto.nombre}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Stock actual:{" "}
                <strong className="font-mono">{producto.cantidad} unidades</strong>
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Costo unitario:{" "}
                <strong className="font-mono">${producto.precioCompra.toFixed(2)}</strong>
              </p>
            </div>

            {/* Cantidad */}
            <FormField label="Cantidad a solicitar" required>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCantidad(isNaN(val) ? "" : Math.max(0, val));
                }}
                placeholder="0"
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </FormField>

            {/* Total */}
            {cantidadNum > 0 && (
              <div className="p-3 bg-[var(--brand-light)]/10 border border-[var(--brand)]/20 rounded-[var(--radius-md)]">
                <p className="text-xs text-[var(--text-secondary)]">Total estimado</p>
                <p className="text-lg font-bold font-mono text-[var(--brand)]">
                  ${total.toFixed(2)}
                </p>
              </div>
            )}

            {/* Payment Distribution */}
            {cantidadNum > 0 && (
              <PaymentDistribution
                total={total}
                onChange={setPayments}
                cajaBalance={cajaBalance}
                cajaAbierta={cajaAbierta}
                disabled={loading}
              />
            )}

            {/* Motivo */}
            <FormField label="Motivo" required>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe el motivo de la reposición..."
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
                className="bg-[#047857] hover:bg-[#065F46] text-white"
              >
                {loading ? "Enviando..." : mode === "reponer_directo" ? "Reponer stock" : "Enviar solicitud"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
