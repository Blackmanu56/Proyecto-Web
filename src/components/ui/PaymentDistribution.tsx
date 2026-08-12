"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { SELECTABLE_PRODUCT_PAYMENT_METHODS } from "@/lib/product-purchase-payments";
import {
  Wallet,
  Plus,
  X,
  AlertTriangle,
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

const PAYMENT_METHODS = SELECTABLE_PRODUCT_PAYMENT_METHODS;

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

  /** Error por fila: específico, solo tras interacción real o problema concreto */
  const getRowError = useCallback((payment: PaymentMethod): string | null => {
    if (!hasReposition) return null;
    const label = PAYMENT_METHODS.find(m => m.value === payment.medio)?.label ?? payment.medio;
    // Importe 0 (el usuario escribió y salió del campo) o negativo
    if (payment.monto < 0) return `El importe de ${label} debe ser mayor a 0.`;
    if (blurredRows[payment.id] === true && payment.monto === 0) {
      return `El importe de ${label} debe ser mayor a 0.`;
    }
    if (payment.medio === "EFECTIVO_CAJA" && payment.monto > cajaBalance) {
      return "El efectivo solicitado supera el saldo disponible.";
    }
    if (payment.medio === "EFECTIVO_CAJA" && !cajaAbierta && payment.monto > 0) {
      return "No hay una caja abierta para utilizar Efectivo de Caja.";
    }
    return null;
  }, [blurredRows, cajaBalance, cajaAbierta, hasReposition]);

  /**
   * Errores GLOBALES de bloqueo real. Lo demás es estado pendiente
   * (Restante en amarillo) o error por fila (bajo cada fila).
   */
  const errors = useMemo(() => {
    if (!hasReposition) return [];

    const newErrors: string[] = [];

    // Métodos duplicados (resguardo; el Select ya los impide)
    const medios = payments.map(p => p.medio);
    if (new Set(medios).size !== medios.length) {
      newErrors.push("No se permiten métodos de pago duplicados");
    }

    // Se superó el total: único caso global con rojo
    const hasNonZeroPayment = payments.some(p => p.monto > 0);
    if (hasNonZeroPayment && remaining < -0.01) {
      newErrors.push(`Se superó el total por ${formatCurrency(Math.abs(remaining))}`);
    }

    return newErrors;
  }, [payments, remaining, hasReposition]);

  // Hay al menos una fila con error
  const hasRowErrors = useMemo(
    () => payments.some(p => getRowError(p) !== null),
    [payments, getRowError]
  );

  // Distribución completa: sin errores y total cubierto
  const isComplete = hasReposition && Math.abs(remaining) < 0.01 && payments.some(p => p.monto > 0);

  // Notify parent of changes - only valid payments
  const validPayments = useMemo(() => {
    if (!isComplete || hasRowErrors || errors.length > 0) return [];
    return payments.filter(p => p.monto > 0);
  }, [payments, isComplete, hasRowErrors, errors]);

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

  /** Al salir del campo: formatea es-AR. Si nunca escribió nada, queda vacía (placeholder) y NO es un error. */
  const handleAmountBlur = useCallback((id: string, raw: string) => {
    if (disabled) return;
    const value = parseAmountInput(raw);
    if (raw === "") {
      // Fila recién creada o campo vacío: no marca blur ni error
      setRawInputs(prev => ({ ...prev, [id]: "" }));
      setBlurredRows(prev => ({ ...prev, [id]: false }));
      updatePayment(id, "monto", 0);
      return;
    }
    setRawInputs(prev => ({ ...prev, [id]: value > 0 ? formatAmount(value) : "0,00" }));
    setBlurredRows(prev => ({ ...prev, [id]: true }));
  }, [disabled, updatePayment]);

  /** Completar con efectivo: actualiza la fila existente o la agrega si está disponible */
  const useMaxAvailable = useCallback(() => {
    if (disabled) return;

    const efectivoCajaPago = payments.find(p => p.medio === "EFECTIVO_CAJA");
    if (efectivoCajaPago) {
      // Actualiza ESA fila (no crea otra)
      const amount = Math.max(0, Math.min(cajaBalance, remaining + efectivoCajaPago.monto));
      setRawInputs(prev => ({ ...prev, [efectivoCajaPago.id]: formatAmount(amount) }));
      setBlurredRows(prev => ({ ...prev, [efectivoCajaPago.id]: true }));
      updatePayment(efectivoCajaPago.id, "monto", amount);
    } else if (cajaAbierta && payments.length < PAYMENT_METHODS.length) {
      // No existe la fila: la agrega con el efectivo disponible (solo si queda como medio y hay caja abierta)
      const amount = Math.max(0, Math.min(remaining, cajaBalance));
      const id = Date.now().toString();
      setPayments(prev => [...prev, { id, medio: "EFECTIVO_CAJA", monto: amount }]);
      setRawInputs(prev => ({ ...prev, [id]: formatAmount(amount) }));
      setBlurredRows(prev => ({ ...prev, [id]: true }));
    }
  }, [payments, cajaBalance, remaining, cajaAbierta, disabled, updatePayment]);

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
  const efectivoSolicitado = payments.reduce(
    (sum, payment) =>
      payment.medio === "EFECTIVO_CAJA" ? sum + payment.monto : sum,
    0
  );
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

  /** Acción de completar con efectivo: visible si hay caja abierta, saldo y algo por cubrir,
   *  y el medio está disponible (ya existe la fila o queda como método). */
  const hasEfectivoRow = payments.some(p => p.medio === "EFECTIVO_CAJA");
  const canCompleteWithCaja =
    cajaAbierta && cajaBalance > 0 && remaining > 0 &&
    (hasEfectivoRow || payments.length < PAYMENT_METHODS.length);

  /** Etiqueta contextual: min(restante, saldo de caja) */
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
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Distribución de Pago
          </span>
          <span
            title="Al incrementar stock se registra una reposición. Solo la parte abonada con Efectivo de Caja afecta el saldo de la caja activa."
            className="inline-flex cursor-help text-[var(--text-secondary)] hover:text-[var(--brand)] transition-colors"
          >
            <Info size={12} />
          </span>
        </div>
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

              {/* Optional origin/reference for external funds */}
              {isFondosExternos && (
                <div className="pl-1">
                  <Input
                    type="text"
                    value={payment.observacion || ""}
                    onChange={(e) => updatePayment(payment.id, "observacion", e.target.value)}
                    disabled={disabled}
                    aria-label="Origen o referencia de fondos externos"
                    placeholder="Aporte del propietario, caja externa, etc."
                    className="h-6 w-full border-[var(--border)] bg-transparent px-2 text-[11px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs pt-1 border-t border-[var(--border)]/50">
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
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>

      {/* Completar con efectivo - inmediatamente debajo del resumen */}
      {canCompleteWithCaja && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={useMaxAvailable}
          disabled={disabled}
          className="w-full h-7 mt-0.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-light)]/30 cursor-pointer"
        >
          <Wallet size={12} className="mr-1" />
          {completarLabel}
        </Button>
      )}

      {/* Errores globales - solo bloqueos reales (rojo) */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentDistribution;
