"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Wallet,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

export interface PaymentMethod {
  id: string;
  medio: "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA" | "MERCADO_PAGO" | "CUENTA_CORRIENTE_PROVEEDOR" | "FONDOS_EXTERNOS";
  monto: number;
  observacion?: string;
}

interface PaymentDistributionProps {
  total: number;
  onChange: (payments: PaymentMethod[]) => void;
  cajaBalance?: number;
  cajaAbierta?: boolean;
  disabled?: boolean;
}

const PAYMENT_METHODS = [
  { value: "EFECTIVO_CAJA", label: "Efectivo de Caja", cajaImpact: true, requiresOpenCaja: true },
  { value: "TRANSFERENCIA_BANCARIA", label: "Transferencia Bancaria", cajaImpact: false, requiresOpenCaja: false },
  { value: "MERCADO_PAGO", label: "Mercado Pago", cajaImpact: false, requiresOpenCaja: false },
  { value: "CUENTA_CORRIENTE_PROVEEDOR", label: "Cta. Cte. Proveedor", cajaImpact: false, requiresOpenCaja: false },
  { value: "FONDOS_EXTERNOS", label: "Fondos Externos", cajaImpact: false, requiresOpenCaja: false },
] as const;

export function PaymentDistribution({
  total,
  onChange,
  cajaBalance = 0,
  cajaAbierta = true,
  disabled = false,
}: PaymentDistributionProps) {
  const [payments, setPayments] = useState<PaymentMethod[]>([
    { id: "1", medio: "EFECTIVO_CAJA", monto: 0 },
  ]);

  const totalAssigned = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
  const remaining = total - totalAssigned;

  // Only show validation errors when there's an actual total > 0
  const hasReposition = total > 0;

  // Validate payments - compute errors as derived state
  const errors = useMemo(() => {
    if (!hasReposition) return [];

    const newErrors: string[] = [];

    // Check for zero amounts (only if user started entering)
    const hasNonZeroPayment = payments.some(p => p.monto > 0);
    if (hasNonZeroPayment) {
      const hasZeroAmount = payments.some(p => p.monto === 0);
      if (hasZeroAmount) {
        newErrors.push("Todos los montos deben ser mayores a 0");
      }
    }

    // Check for negative amounts
    const hasNegativeAmount = payments.some(p => p.monto < 0);
    if (hasNegativeAmount) {
      newErrors.push("No se permiten montos negativos");
    }

    // Check for duplicate payment methods
    const medios = payments.map(p => p.medio);
    const uniqueMedios = new Set(medios);
    if (uniqueMedios.size !== medios.length) {
      newErrors.push("No se permiten métodos de pago duplicados");
    }

    // Check Caja balance
    const efectivoCajaPago = payments.find(p => p.medio === "EFECTIVO_CAJA");
    if (efectivoCajaPago && efectivoCajaPago.monto > cajaBalance) {
      newErrors.push("Fondos insuficientes en Caja");
    }

    // Check if EFECTIVO_CAJA is used when Caja is closed
    if (!cajaAbierta && efectivoCajaPago && efectivoCajaPago.monto > 0) {
      newErrors.push("No hay una caja abierta para utilizar Efectivo de Caja");
    }

    // Check sum matches total (only if user started entering)
    if (hasNonZeroPayment && Math.abs(remaining) > 0.01) {
      if (remaining > 0) {
        newErrors.push(`Restan ${formatCurrency(remaining)} por asignar`);
      } else {
        newErrors.push(`Se superó el total por ${formatCurrency(Math.abs(remaining))}`);
      }
    }

    // Check for empty payments when there's a total
    if (payments.length === 0 && hasReposition) {
      newErrors.push("Debe agregar al menos un método de pago");
    }

    return newErrors;
  }, [payments, remaining, cajaBalance, cajaAbierta, hasReposition]);

  // Notify parent of changes - only valid payments
  const validPayments = useMemo(() => {
    if (!hasReposition) return [];
    return errors.length === 0 ? payments.filter(p => p.monto > 0) : [];
  }, [payments, errors, hasReposition]);

  // Call onChange outside of render to avoid cascading updates
  const prevValidPaymentsRef = React.useRef<string>("");
  React.useEffect(() => {
    const serialized = JSON.stringify(validPayments);
    if (serialized !== prevValidPaymentsRef.current) {
      prevValidPaymentsRef.current = serialized;
      onChange(validPayments);
    }
  }, [validPayments, onChange]);

  const addPayment = useCallback(() => {
    if (disabled) return;
    
    // Find first unused payment method that doesn't require open Caja if Caja is closed
    const usedMethods = new Set(payments.map(p => p.medio));
    const availableMethod = PAYMENT_METHODS.find(m => 
      !usedMethods.has(m.value) && (cajaAbierta || !m.requiresOpenCaja)
    );
    
    if (availableMethod) {
      setPayments(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          medio: availableMethod.value,
          monto: 0,
        },
      ]);
    }
  }, [payments, disabled, cajaAbierta]);

  const removePayment = useCallback((id: string) => {
    if (disabled) return;
    setPayments(prev => prev.filter(p => p.id !== id));
  }, [disabled]);

  const updatePayment = useCallback((id: string, field: keyof PaymentMethod, value: string | number) => {
    if (disabled) return;
    
    setPayments(prev =>
      prev.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  }, [disabled]);

  const useMaxAvailable = useCallback(() => {
    if (disabled) return;
    
    const efectivoCajaPago = payments.find(p => p.medio === "EFECTIVO_CAJA");
    if (efectivoCajaPago) {
      const maxAmount = Math.min(cajaBalance, remaining + efectivoCajaPago.monto);
      updatePayment(efectivoCajaPago.id, "monto", Math.max(0, maxAmount));
    }
  }, [payments, cajaBalance, remaining, disabled, updatePayment]);

  /**
   * Restante: warning (amarillo) mientras falte asignar,
   * success (verde) cuando está cubierto, danger (rojo) solo si se superó.
   */
  const getRemainingStatus = (): "warning" | "success" | "danger" => {
    if (!hasReposition || Math.abs(remaining) < 0.01) return "success";
    if (remaining > 0) return "warning";
    return "danger";
  };

  /**
   * Asignado: siempre verde si hay algo asignado correctamente,
   * gris/normal si todavía no se asignó nada (no es un error).
   */
  const assignedStatus = totalAssigned > 0 ? "success" : "muted";

  const canAddMore = payments.length < PAYMENT_METHODS.length && !disabled && hasReposition;
  const noMoreMethods = payments.length >= PAYMENT_METHODS.length && hasReposition && !disabled;

  // Get available methods for a specific row (excluding already used ones)
  const getAvailableMethods = useCallback((currentId: string) => {
    const usedMethods = new Set(payments.filter(p => p.id !== currentId).map(p => p.medio));
    return PAYMENT_METHODS.filter(m => 
      !usedMethods.has(m.value) && (cajaAbierta || !m.requiresOpenCaja)
    );
  }, [payments, cajaAbierta]);

  // Per-row error state: only the problematic row gets a red border
  const getRowError = useCallback((payment: PaymentMethod): string | null => {
    if (!hasReposition) return null;
    if (payment.monto < 0) return "Monto inválido";
    if (payment.medio === "EFECTIVO_CAJA" && payment.monto > cajaBalance) {
      return `Supera el disponible en Caja (${formatCurrency(cajaBalance)})`;
    }
    if (!cajaAbierta && payment.medio === "EFECTIVO_CAJA" && payment.monto > 0) {
      return "Caja cerrada";
    }
    return null;
  }, [cajaBalance, cajaAbierta, hasReposition]);

  // If no reposition, don't render anything
  if (!hasReposition) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Distribución de Pago
        </span>
        {canAddMore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPayment}
            className="h-6 px-2 text-xs"
          >
            <Plus size={12} className="mr-1" />
            Agregar
          </Button>
        )}
        {noMoreMethods && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled
            title="No quedan más medios de pago disponibles"
            className="h-6 px-2 text-xs opacity-50 cursor-not-allowed"
          >
            <Plus size={12} className="mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {/* Payment Methods - Scrollable list (max ~3 rows visible) */}
      <div className="max-h-[156px] overflow-y-auto pr-1 space-y-1.5 min-h-[0px]">
        {payments.map((payment) => {
          const isCaja = payment.medio === "EFECTIVO_CAJA";
          const isFondosExternos = payment.medio === "FONDOS_EXTERNOS";
          const availableMethods = getAvailableMethods(payment.id);
          const rowError = getRowError(payment);

          return (
            <div key={payment.id} className="space-y-1">
              <div
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded-lg border",
                  isCaja ? "border-[var(--brand)]/30 bg-[var(--brand-light)]/10" : "border-[var(--border)] bg-[var(--bg)]",
                  rowError && "border-[var(--danger)] bg-[var(--danger-light)]/10"
                )}
              >
                {/* Payment Method Select */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={payment.medio}
                    onValueChange={(value) => updatePayment(payment.id, "medio", value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.filter(m => 
                        availableMethods.some(am => am.value === m.value) || m.value === payment.medio
                      ).map((method) => (
                        <SelectItem 
                          key={method.value} 
                          value={method.value}
                          disabled={!availableMethods.some(am => am.value === method.value) && method.value !== payment.medio}
                        >
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Input */}
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.monto || ""}
                    onChange={(e) => updatePayment(payment.id, "monto", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    placeholder="0"
                    className="h-8 pl-5 pr-2 text-xs font-mono text-right"
                  />
                </div>

                {/* Remove Button */}
                {payments.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() => removePayment(payment.id)}
                    className="p-1 rounded hover:bg-[var(--danger-light)] text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Fondos Externos observation field - compact, only when monto > 0 */}
              {isFondosExternos && payment.monto > 0 && (
                <div className="flex items-center gap-1 pl-1">
                  <Input
                    type="text"
                    value={payment.observacion || ""}
                    onChange={(e) => updatePayment(payment.id, "observacion", e.target.value)}
                    disabled={disabled}
                    placeholder="Origen de fondos (opcional)"
                    className="h-6 text-[11px]"
                  />
                </div>
              )}

              {/* Row error hint */}
              {rowError && (
                <div className="flex items-center gap-1 pl-1 text-[11px] text-[var(--danger)]">
                  <AlertTriangle size={11} />
                  <span>{rowError}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary - ALWAYS visible, outside the scrollable list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1.5 border-t border-[var(--border)]/50">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Total:</span>
          <span className="font-semibold text-[var(--text)]">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Disponible Caja:</span>
          <span className="font-semibold text-[var(--brand)]">{formatCurrency(cajaBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Asignado:</span>
          <span className={cn(
            "font-semibold",
            assignedStatus === "success" && "text-[var(--success)]",
            assignedStatus === "muted" && "text-[var(--text-secondary)]",
          )}>
            {formatCurrency(totalAssigned)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Restante:</span>
          <span className={cn(
            "font-semibold",
            getRemainingStatus() === "success" && "text-[var(--success)]",
            getRemainingStatus() === "warning" && "text-[var(--warning)]",
            getRemainingStatus() === "danger" && "text-[var(--danger)]",
          )}>
            {formatCurrency(Math.max(0, remaining))}
          </span>
        </div>
      </div>

      {/* Use Max Button - contextual label */}
      {payments.some(p => p.medio === "EFECTIVO_CAJA") && cajaAbierta && cajaBalance > 0 && remaining > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={useMaxAvailable}
          disabled={disabled}
          className="w-full h-7 text-xs"
        >
          <Wallet size={12} className="mr-1" />
          Completar con efectivo disponible ({formatCurrency(Math.min(cajaBalance, remaining))})
        </Button>
      )}

      {/* Caja closed warning */}
      {!cajaAbierta && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
          <Info size={12} />
          <span>Caja cerrada — Efectivo de Caja no disponible</span>
        </div>
      )}

      {/* Errors - red ONLY for real blocking issues, amber for guidance */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, index) => {
            const isBlocking = 
              error.includes("insuficientes") || 
              error.includes("No hay") || 
              error.includes("duplicados") || 
              error.includes("superó") ||
              error.includes("negativos") ||
              error.includes("al menos");
            return (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isBlocking ? "text-[var(--danger)]" : "text-[var(--warning)]"
                )}
              >
                <AlertTriangle size={12} />
                <span>{error}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Success State */}
      {errors.length === 0 && payments.some(p => p.monto > 0) && remaining === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--success)]">
          <CheckCircle size={12} />
          <span>Pago distribuido correctamente</span>
        </div>
      )}
    </div>
  );
}

export default PaymentDistribution;
