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

/* ── Helpers monetarios (convención es-AR del sistema, sin librería nueva) ── */

/** Formatea un número sin símbolo: 21000 -> "21.000,00" */
function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parsea texto es-AR a número:
 * "16.039,20" -> 16039.2 | "16039.20" -> 16039.2 | "2" -> 2 | "" -> 0
 */
function parseAmountInput(raw: string): number {
  if (raw === "") return 0;
  const hasComma = raw.includes(",");
  const normalized = hasComma ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ".");
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? 0 : num;
}

/** Filtra caracteres no monetarios: solo dígitos, punto y coma */
function sanitizeAmountInput(raw: string): string {
  return raw.replace(/[^\d.,]/g, "");
}

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

  // Texto crudo del input por fila ("" = vacío, NO es un valor real)
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  // Filas que el usuario dejó (blur) — usadas para errores de importe 0
  const [blurredRows, setBlurredRows] = useState<Record<string, boolean>>({});

  const totalAssigned = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
  const remaining = total - totalAssigned;

  // Only show validation errors when there's an actual total > 0
  const hasReposition = total > 0;

  // Validate payments - compute errors as derived state
  const errors = useMemo(() => {
    if (!hasReposition) return [];

    const newErrors: string[] = [];

    // Cero: SOLO si el usuario escribió algo en la fila (touched) y la dejó (blur)
    const hasTouchedZero = payments.some(p =>
      Object.prototype.hasOwnProperty.call(rawInputs, p.id) &&
      blurredRows[p.id] === true &&
      p.monto === 0
    );
    if (hasTouchedZero) {
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
      newErrors.push("Fondos insuficientes en Caja");
    }

    // Check if EFECTIVO_CAJA is used when Caja is closed
    if (!cajaAbierta && efectivoCajaPago && efectivoCajaPago.monto > 0) {
      newErrors.push("No hay una caja abierta para utilizar Efectivo de Caja");
    }

    // Check sum matches total (only if user started entering)
    const hasNonZeroPayment = payments.some(p => p.monto > 0);
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
  }, [payments, remaining, cajaBalance, cajaAbierta, hasReposition, rawInputs, blurredRows]);

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
    setRawInputs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBlurredRows(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [disabled]);

  const updatePayment = useCallback((id: string, field: keyof PaymentMethod, value: string | number) => {
    if (disabled) return;
    
    setPayments(prev =>
      prev.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  }, [disabled]);

  /** Handler del input monetario: guarda raw + monto parseado */
  const handleAmountChange = useCallback((id: string, raw: string) => {
    if (disabled) return;
    const clean = sanitizeAmountInput(raw);
    setRawInputs(prev => ({ ...prev, [id]: clean }));
    setBlurredRows(prev => ({ ...prev, [id]: false }));
    updatePayment(id, "monto", parseAmountInput(clean));
  }, [disabled, updatePayment]);

  /** Al salir del campo: formatea es-AR y marca la fila como blurred */
  const handleAmountBlur = useCallback((id: string, raw: string) => {
    if (disabled) return;
    const value = parseAmountInput(raw);
    setRawInputs(prev => ({ ...prev, [id]: value > 0 ? formatAmount(value) : "0,00" }));
    setBlurredRows(prev => ({ ...prev, [id]: true }));
  }, [disabled]);

  const useMaxAvailable = useCallback(() => {
    if (disabled) return;
    
    const efectivoCajaPago = payments.find(p => p.medio === "EFECTIVO_CAJA");
    if (efectivoCajaPago) {
      const maxAmount = Math.min(cajaBalance, remaining + efectivoCajaPago.monto);
      const amount = Math.max(0, maxAmount);
      setRawInputs(prev => ({ ...prev, [efectivoCajaPago.id]: formatAmount(amount) }));
      setBlurredRows(prev => ({ ...prev, [efectivoCajaPago.id]: true }));
      updatePayment(efectivoCajaPago.id, "monto", amount);
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

  /** Disponible Caja: neutral normalmente, rojo SOLO si el efectivo solicitado supera el saldo */
  const efectivoSolicitado = payments.find(p => p.medio === "EFECTIVO_CAJA")?.monto ?? 0;
  const cajaInsuficiente = efectivoSolicitado > cajaBalance;

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

  /** Etiqueta contextual de la acción de completar con efectivo */
  const cajaCubreRestante = cajaBalance >= remaining && remaining > 0;
  const completarLabel = cajaCubreRestante
    ? `Completar con efectivo (${formatCurrency(remaining)})`
    : `Usar efectivo disponible (${formatCurrency(cajaBalance)})`;

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
      <div className="scrollbar-thin max-h-[156px] overflow-y-auto pr-2 space-y-1.5 min-h-[0px]">
        {payments.map((payment) => {
          const isCaja = payment.medio === "EFECTIVO_CAJA";
          const isFondosExternos = payment.medio === "FONDOS_EXTERNOS";
          const availableMethods = getAvailableMethods(payment.id);
          const rowError = getRowError(payment);
          const raw = rawInputs[payment.id] ?? "";

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

                {/* Amount Input - text + inputMode decimal (sin flechas nativas) */}
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={raw}
                    onChange={(e) => handleAmountChange(payment.id, e.target.value)}
                    onBlur={(e) => handleAmountBlur(payment.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    disabled={disabled}
                    placeholder="0,00"
                    className="h-8 pl-5 pr-2 text-xs font-mono text-right"
                  />
                </div>

                {/* Remove Button */}
                {payments.length > 1 && !disabled && (
                  <button
                    type="button"
                    title="Eliminar método"
                    onClick={() => removePayment(payment.id)}
                    className="p-1 rounded text-[var(--text-secondary)] opacity-70 hover:opacity-100 hover:bg-[var(--danger-light)] hover:text-[var(--danger)] transition-colors"
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
        <div className="flex justify-between items-baseline">
          <span className="text-[var(--text-muted)]">Total:</span>
          <span className="font-semibold text-[var(--text)] font-mono">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[var(--text-muted)]">Disponible Caja:</span>
          <span className={cn(
            "font-semibold font-mono",
            cajaInsuficiente ? "text-[var(--danger)]" : "text-[var(--text)]"
          )}>
            {formatCurrency(cajaBalance)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[var(--text-muted)]">Asignado:</span>
          <span className={cn(
            "font-semibold font-mono",
            assignedStatus === "success" && "text-[var(--success)]",
            assignedStatus === "muted" && "text-[var(--text-secondary)]",
          )}>
            {formatCurrency(totalAssigned)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[var(--text-muted)]">Restante:</span>
          <span className={cn(
            "font-semibold font-mono",
            getRemainingStatus() === "success" && "text-[var(--success)]",
            getRemainingStatus() === "warning" && "text-[var(--warning)]",
            getRemainingStatus() === "danger" && "text-[var(--danger)]",
          )}>
            {formatCurrency(Math.max(0, remaining))}
          </span>
        </div>
      </div>

      {/* Nota de reposición - compacta, debajo del resumen (solo si hay distribución) */}
      <div className="flex items-start gap-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
        <Info size={11} className="shrink-0 mt-0.5 text-[var(--brand)]" />
        <span>
          <strong>Regla:</strong> Al incrementar stock se registrará una reposición. Solo la parte abonada con
          Efectivo de Caja afecta el saldo de la caja activa.
        </span>
      </div>

      {/* Completar con efectivo - acción secundaria discreta */}
      {payments.some(p => p.medio === "EFECTIVO_CAJA") && cajaAbierta && cajaBalance > 0 && remaining > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={useMaxAvailable}
          disabled={disabled}
          className="w-full h-7 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--border)]/40"
        >
          <Wallet size={12} className="mr-1" />
          {completarLabel}
        </Button>
      )}

      {/* Caja closed warning */}
      {!cajaAbierta && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
          <Info size={12} />
          <span>Caja cerrada — Efectivo de Caja no disponible</span>
        </div>
      )}

      {/* Errors - below the summary, red ONLY for real blocking issues, amber for guidance */}
      {errors.length > 0 && (
        <div className="space-y-1 mt-0.5">
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
