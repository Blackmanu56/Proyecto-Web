"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Landmark,
  CreditCard,
  Wallet,
  Building2,
  Globe,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
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
  disabled?: boolean;
}

const PAYMENT_METHODS = [
  { value: "EFECTIVO_CAJA", label: "Efectivo de Caja", icon: Wallet, cajaImpact: true },
  { value: "TRANSFERENCIA_BANCARIA", label: "Transferencia Bancaria", icon: Landmark, cajaImpact: false },
  { value: "MERCADO_PAGO", label: "Mercado Pago", icon: CreditCard, cajaImpact: false },
  { value: "CUENTA_CORRIENTE_PROVEEDOR", label: "Cuenta Corriente Proveedor", icon: Building2, cajaImpact: false },
  { value: "FONDOS_EXTERNOS", label: "Fondos Externos", icon: Globe, cajaImpact: false },
] as const;

export function PaymentDistribution({
  total,
  onChange,
  cajaBalance = 0,
  disabled = false,
}: PaymentDistributionProps) {
  const [payments, setPayments] = useState<PaymentMethod[]>([
    { id: "1", medio: "EFECTIVO_CAJA", monto: 0 },
  ]);

  const totalAssigned = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
  const remaining = total - totalAssigned;

  // Validate payments - compute errors as derived state
  const errors = useMemo(() => {
    const newErrors: string[] = [];

    // Check if sum matches total
    if (Math.abs(remaining) > 0.01) {
      if (remaining > 0) {
        newErrors.push(`Faltan ${formatCurrency(remaining)} para cubrir el total`);
      } else {
        newErrors.push(`Excedido por ${formatCurrency(Math.abs(remaining))}`);
      }
    }

    // Check for zero amounts
    const hasZeroAmount = payments.some(p => p.monto === 0);
    if (hasZeroAmount) {
      newErrors.push("Todos los montos deben ser mayores a 0");
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
      newErrors.push(`El monto en efectivo excede el saldo disponible en caja (${formatCurrency(cajaBalance)})`);
    }

    // Check for empty payments
    if (payments.length === 0) {
      newErrors.push("Debe agregar al menos un método de pago");
    }

    return newErrors;
  }, [payments, remaining, cajaBalance]);

  // Notify parent of changes - only valid payments
  const validPayments = useMemo(() => {
    return errors.length === 0 ? payments.filter(p => p.monto > 0) : [];
  }, [payments, errors]);

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
    
    // Find first unused payment method
    const usedMethods = new Set(payments.map(p => p.medio));
    const availableMethod = PAYMENT_METHODS.find(m => !usedMethods.has(m.value));
    
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
  }, [payments, disabled]);

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

  const getPaymentMethodInfo = (medio: string) => {
    return PAYMENT_METHODS.find(m => m.value === medio);
  };

  const getRemainingStatus = () => {
    if (Math.abs(remaining) < 0.01) return "success";
    if (remaining > 0) return "warning";
    return "error";
  };

  const canAddMore = payments.length < PAYMENT_METHODS.length && !disabled;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-[var(--brand)]" />
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Distribución de Pago
          </span>
        </div>
        {canAddMore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPayment}
            className="h-7 px-2 text-xs"
          >
            <Plus size={12} className="mr-1" />
            Agregar Método
          </Button>
        )}
      </div>

      {/* Payment Methods */}
      <div className="space-y-2">
        {payments.map((payment) => {
          const methodInfo = getPaymentMethodInfo(payment.medio);
          const Icon = methodInfo?.icon || Wallet;
          const isCaja = payment.medio === "EFECTIVO_CAJA";

          return (
            <div
              key={payment.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border",
                isCaja ? "border-[var(--brand)]/30 bg-[var(--brand-light)]/10" : "border-[var(--border)] bg-[var(--bg)]"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon size={14} className={cn("shrink-0", isCaja ? "text-[var(--brand)]" : "text-[var(--text-secondary)]")} />
                
                {/* Payment Method Select */}
                <select
                  value={payment.medio}
                  onChange={(e) => updatePayment(payment.id, "medio", e.target.value)}
                  disabled={disabled}
                  className="flex-1 min-w-0 bg-transparent border-0 text-sm font-medium text-[var(--text)] focus:outline-none cursor-pointer"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option
                      key={method.value}
                      value={method.value}
                      disabled={payments.some(p => p.id !== payment.id && p.medio === method.value)}
                    >
                      {method.label}
                    </option>
                  ))}
                </select>

                {/* Amount Input */}
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.monto || ""}
                    onChange={(e) => updatePayment(payment.id, "monto", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    placeholder="0.00"
                    className="h-7 pl-6 pr-2 text-xs font-mono text-right"
                  />
                </div>

                {/* Caja Badge */}
                {isCaja && (
                  <span className="text-[10px] font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-1.5 py-0.5 rounded">
                    CAJA
                  </span>
                )}
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
          );
        })}
      </div>

      {/* Summary */}
      <div className="space-y-2">
        {/* Total Row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Total:</span>
          <span className="font-semibold text-[var(--text)]">{formatCurrency(total)}</span>
        </div>

        {/* Assigned Row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Asignado:</span>
          <span className={cn(
            "font-semibold",
            getRemainingStatus() === "success" && "text-[var(--success)]",
            getRemainingStatus() === "warning" && "text-[var(--warning)]",
            getRemainingStatus() === "error" && "text-[var(--danger)]",
          )}>
            {formatCurrency(totalAssigned)}
          </span>
        </div>

        {/* Remaining Row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Restante:</span>
          <span className={cn(
            "font-semibold",
            getRemainingStatus() === "success" && "text-[var(--success)]",
            getRemainingStatus() === "warning" && "text-[var(--warning)]",
            getRemainingStatus() === "error" && "text-[var(--danger)]",
          )}>
            {formatCurrency(remaining)}
          </span>
        </div>

        {/* Caja Balance Info */}
        {cajaBalance > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Saldo Caja:</span>
            <span className="font-semibold text-[var(--brand)]">{formatCurrency(cajaBalance)}</span>
          </div>
        )}

        {/* Use Max Button */}
        {payments.some(p => p.medio === "EFECTIVO_CAJA") && cajaBalance > 0 && remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={useMaxAvailable}
            disabled={disabled}
            className="w-full h-7 text-xs"
          >
            <Wallet size={12} className="mr-1" />
            Usar máximo disponible ({formatCurrency(Math.min(cajaBalance, remaining))})
          </Button>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 text-xs text-[var(--danger)]"
            >
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success State */}
      {errors.length === 0 && payments.some(p => p.monto > 0) && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--success)]">
          <CheckCircle size={12} />
          <span>Pago distribuido correctamente</span>
        </div>
      )}
    </div>
  );
}

export default PaymentDistribution;