"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Landmark, MinusCircle, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

export interface AjusteBancoPayload {
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  motivo: string;
  referencia?: string;
}

interface AjustarBancoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: AjusteBancoPayload) => void;
  isPending: boolean;
  saldoActual: number;
  errorMessage?: string;
}

export default function AjustarBancoModal({
  open,
  onClose,
  onConfirm,
  isPending,
  saldoActual,
  errorMessage,
}: AjustarBancoModalProps) {
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("INGRESO");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");

  const montoNumero = monto === "" ? Number.NaN : Number(monto);
  const montoValido = Number.isFinite(montoNumero) && montoNumero > 0;
  const motivoValido = motivo.trim().length > 0;
  const saldoResultante = useMemo(() => {
    if (!montoValido) return saldoActual;
    return tipo === "INGRESO" ? saldoActual + montoNumero : saldoActual - montoNumero;
  }, [montoNumero, montoValido, saldoActual, tipo]);
  const egresoExcedeSaldo = tipo === "EGRESO" && montoValido && montoNumero > saldoActual;
  const canSubmit = montoValido && motivoValido && !egresoExcedeSaldo && !isPending;

  const reset = () => {
    setTipo("INGRESO");
    setMonto("");
    setMotivo("");
    setReferencia("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-[var(--border)] bg-[var(--card)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--text)]">
            <Landmark size={18} className="text-[#38bdf8]" />
            Ajustar Banco
          </DialogTitle>
          <DialogDescription>
            Registrá un movimiento manual auditable sobre el Banco principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Saldo actual
            </div>
            <div className="mt-1 text-lg font-black font-mono text-[#38bdf8]">
              {formatCurrency(saldoActual)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("INGRESO")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                tipo === "INGRESO"
                  ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)]"
              }`}
              disabled={isPending}
            >
              <span className="flex items-center justify-center gap-2">
                <PlusCircle size={14} />
                Ingreso
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTipo("EGRESO")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                tipo === "EGRESO"
                  ? "border-[var(--danger)]/40 bg-[var(--danger-light)] text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)]"
              }`}
              disabled={isPending}
            >
              <span className="flex items-center justify-center gap-2">
                <MinusCircle size={14} />
                Egreso
              </span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Monto
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              disabled={isPending}
              className="font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Motivo
            </label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Saldo inicial Banco"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Referencia (opcional)
            </label>
            <Input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: Comprobante, ticket o nota"
              disabled={isPending}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Confirmación
            </div>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Saldo actual</span>
                <span className="font-mono font-bold text-[var(--text)]">{formatCurrency(saldoActual)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-secondary)]">Movimiento</span>
                <span className={`font-mono font-bold ${tipo === "INGRESO" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {montoValido ? `${tipo === "INGRESO" ? "+" : "-"}${formatCurrency(montoNumero)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text-secondary)]">Saldo resultante</span>
                <span className={`font-mono text-base font-black ${saldoResultante >= 0 ? "text-[#38bdf8]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(saldoResultante)}
                </span>
              </div>
            </div>
          </div>

          {egresoExcedeSaldo && (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
              El egreso supera el saldo disponible del Banco.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant={tipo === "INGRESO" ? "success" : "danger"}
            loading={isPending}
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                tipo,
                monto: montoNumero,
                motivo: motivo.trim(),
                referencia: referencia.trim() || undefined,
              })
            }
          >
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
