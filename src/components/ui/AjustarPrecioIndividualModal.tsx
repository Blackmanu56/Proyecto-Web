"use client";

import React, { useState, useMemo, useTransition } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Percent,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import {
  calcularNuevoPrecio,
  calcularMargenGanancia,
  type TipoAjustePrecio,
  type TipoRedondeo,
} from "@/lib/ajuste-precios";
import { ajustarPrecioIndividual } from "@/actions/productos";

/* ────────────────────── Types ────────────────────── */

interface ProductData {
  id: number;
  nombre: string;
  codigo?: string | null;
  imagen?: string | null;
  marca?: string | null;
  categoria?: { id: number; nombre: string };
  proveedor?: { id: number; nombre: string };
  precioCompra: number;
  precioVenta: number;
  activo: boolean;
}

interface AjustarPrecioIndividualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductData;
  onSuccess: () => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20, 25, -5, -10];

const MOTIVO_SUGGESTIONS = [
  "Actualización por nueva lista del proveedor",
  "Ajuste por inflación / variación de costos",
  "Corrección de error de carga",
  "Actualización de margen comercial",
  "Cambio de lista de precios de temporada",
];

export default function AjustarPrecioIndividualModal({
  open,
  onOpenChange,
  producto,
  onSuccess,
}: AjustarPrecioIndividualModalProps) {
  const [isPending, startTransition] = useTransition();

  // Toggles
  const [ajustarCompra, setAjustarCompra] = useState(false);
  const [ajustarVenta, setAjustarVenta] = useState(true);

  // Compra state
  const [metodoCompra, setMetodoCompra] = useState<TipoAjustePrecio>("PORCENTAJE");
  const [valorCompra, setValorCompra] = useState<number | "">("");

  // Venta state
  const [metodoVenta, setMetodoVenta] = useState<TipoAjustePrecio>("PORCENTAJE");
  const [valorVenta, setValorVenta] = useState<number | "">("");

  // Redondeo
  const [redondeo, setRedondeo] = useState<TipoRedondeo>("SIN_REDONDEO");

  // Motivo
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ── Reset Form ── */
  const resetForm = () => {
    setAjustarCompra(false);
    setAjustarVenta(true);
    setMetodoCompra("PORCENTAJE");
    setValorCompra("");
    setMetodoVenta("PORCENTAJE");
    setValorVenta("");
    setRedondeo("SIN_REDONDEO");
    setMotivo("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  /* ── Calculations ── */
  const numValorCompra = typeof valorCompra === "number" ? valorCompra : 0;
  const numValorVenta = typeof valorVenta === "number" ? valorVenta : 0;

  const nuevoPrecioCompra = useMemo(() => {
    if (!ajustarCompra || valorCompra === "") return producto.precioCompra;
    return calcularNuevoPrecio(producto.precioCompra, metodoCompra, numValorCompra, redondeo);
  }, [ajustarCompra, valorCompra, producto.precioCompra, metodoCompra, numValorCompra, redondeo]);

  const nuevoPrecioVenta = useMemo(() => {
    if (!ajustarVenta || valorVenta === "") return producto.precioVenta;
    return calcularNuevoPrecio(producto.precioVenta, metodoVenta, numValorVenta, redondeo);
  }, [ajustarVenta, valorVenta, producto.precioVenta, metodoVenta, numValorVenta, redondeo]);

  const diffCompra = nuevoPrecioCompra - producto.precioCompra;
  const diffVenta = nuevoPrecioVenta - producto.precioVenta;

  const margenActual = useMemo(
    () => calcularMargenGanancia(producto.precioCompra, producto.precioVenta),
    [producto.precioCompra, producto.precioVenta]
  );

  const margenNuevo = useMemo(
    () => calcularMargenGanancia(nuevoPrecioCompra, nuevoPrecioVenta),
    [nuevoPrecioCompra, nuevoPrecioVenta]
  );

  const variacionMargen =
    margenActual !== null && margenNuevo !== null ? margenNuevo - margenActual : null;

  // Validation
  const isValid =
    (ajustarCompra || ajustarVenta) &&
    (!ajustarCompra || (valorCompra !== "" && nuevoPrecioCompra > 0)) &&
    (!ajustarVenta || (valorVenta !== "" && nuevoPrecioVenta > 0)) &&
    motivo.trim().length >= 3;

  /* ── Submit Handler ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isPending) return;

    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          productoId: producto.id,
          ajustarCompra,
          ajustarVenta,
          metodoCompra: ajustarCompra ? metodoCompra : undefined,
          valorCompra: ajustarCompra ? numValorCompra : undefined,
          metodoVenta: ajustarVenta ? metodoVenta : undefined,
          valorVenta: ajustarVenta ? numValorVenta : undefined,
          redondeo,
          motivo: motivo.trim(),
        };

        const result = await ajustarPrecioIndividual(payload);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
          return;
        }

        toast.success(`Precios actualizados para ${producto.nombre}`);
        onSuccess();
        handleClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error inesperado al ajustar precios";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-[var(--card)] border-[var(--border)] rounded-2xl shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25">
              <DollarSign size={22} strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[var(--text)]">
                Ajustar Precios de Producto
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-secondary)]">
                Modificá el precio de compra, venta o ambos con cálculo de margen en tiempo real.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin]">
          {/* 1. Header Card Producto */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center overflow-hidden">
                {producto.imagen ? (
                  <Image src={producto.imagen} alt={producto.nombre} fill sizes="48px" className="object-contain p-1" />
                ) : (
                  <Package size={20} className="text-[var(--text-secondary)] opacity-40" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-[var(--text)] truncate">{producto.nombre}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
                  {producto.codigo && <span className="font-mono bg-[var(--panel)] px-1.5 py-0.5 rounded text-[11px]">{producto.codigo}</span>}
                  {producto.categoria && <span>{producto.categoria.nombre}</span>}
                  {producto.marca && <span>· {producto.marca}</span>}
                  {producto.proveedor && <span>· {producto.proveedor.nombre}</span>}
                </div>
              </div>
            </div>
            <Badge variant={producto.activo ? "success" : "danger"} size="sm">
              {producto.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>

          {/* 2. Configuración de Precios en 2 Columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* PRECIO DE COMPRA */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all duration-200",
                ajustarCompra
                  ? "bg-blue-500/[0.04] border-blue-500/40 ring-1 ring-blue-500/20"
                  : "bg-[var(--bg)]/50 border-[var(--border)]/70 opacity-70"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ajustarCompra}
                    onChange={(e) => setAjustarCompra(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Precio de Compra
                  </span>
                </label>
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Actual: <strong className="text-[var(--text)]">{formatCurrency(producto.precioCompra)}</strong>
                </span>
              </div>

              {ajustarCompra ? (
                <div className="space-y-3 animate-in fade-in-0 duration-150">
                  {/* Selector Método */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--panel)] rounded-lg border border-[var(--border)] text-xs font-semibold">
                    {(
                      [
                        { key: "PORCENTAJE", label: "% Porcentaje" },
                        { key: "MONTO_FIJO", label: "$ Monto Fijo" },
                        { key: "VALOR_DIRECTO", label: "Nuevo Valor" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setMetodoCompra(m.key);
                          setValorCompra("");
                        }}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors",
                          metodoCompra === m.key
                            ? "bg-blue-500 text-white shadow-sm"
                            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Input Valor */}
                  <div className="relative">
                    <input
                      type="number"
                      step={metodoCompra === "PORCENTAJE" ? "0.1" : "1"}
                      placeholder={
                        metodoCompra === "PORCENTAJE"
                          ? "Ej. 10 para +10% o -5 para -5%"
                          : metodoCompra === "MONTO_FIJO"
                          ? "Ej. 500 para +$500 o -200"
                          : "Ej. 15000"
                      }
                      value={valorCompra}
                      onChange={(e) =>
                        setValorCompra(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Chips rápidos si es porcentaje */}
                  {metodoCompra === "PORCENTAJE" && (
                    <div className="flex flex-wrap gap-1">
                      {QUICK_PERCENTAGES.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setValorCompra(pct)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors",
                            valorCompra === pct
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "bg-[var(--panel)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                          )}
                        >
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Preview Compra */}
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Nuevo costo:</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-blue-400">
                        {formatCurrency(nuevoPrecioCompra)}
                      </span>
                      {diffCompra !== 0 && (
                        <span
                          className={cn(
                            "block text-[10px] font-bold font-mono",
                            diffCompra > 0 ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {diffCompra > 0 ? `+${formatCurrency(diffCompra)}` : formatCurrency(diffCompra)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] py-2">
                  El precio de compra se mantendrá en {formatCurrency(producto.precioCompra)}.
                </p>
              )}
            </div>

            {/* PRECIO DE VENTA */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all duration-200",
                ajustarVenta
                  ? "bg-[#047857]/[0.04] border-[#047857]/40 ring-1 ring-[#047857]/20"
                  : "bg-[var(--bg)]/50 border-[var(--border)]/70 opacity-70"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ajustarVenta}
                    onChange={(e) => setAjustarVenta(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[#047857] cursor-pointer"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
                    Precio de Venta
                  </span>
                </label>
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Actual: <strong className="text-[var(--text)]">{formatCurrency(producto.precioVenta)}</strong>
                </span>
              </div>

              {ajustarVenta ? (
                <div className="space-y-3 animate-in fade-in-0 duration-150">
                  {/* Selector Método */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--panel)] rounded-lg border border-[var(--border)] text-xs font-semibold">
                    {(
                      [
                        { key: "PORCENTAJE", label: "% Porcentaje" },
                        { key: "MONTO_FIJO", label: "$ Monto Fijo" },
                        { key: "VALOR_DIRECTO", label: "Nuevo Valor" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setMetodoVenta(m.key);
                          setValorVenta("");
                        }}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors",
                          metodoVenta === m.key
                            ? "bg-[#047857] text-white shadow-sm"
                            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Input Valor */}
                  <div className="relative">
                    <input
                      type="number"
                      step={metodoVenta === "PORCENTAJE" ? "0.1" : "1"}
                      placeholder={
                        metodoVenta === "PORCENTAJE"
                          ? "Ej. 15 para +15% o -10"
                          : metodoVenta === "MONTO_FIJO"
                          ? "Ej. 1000 para +$1000"
                          : "Ej. 25000"
                      }
                      value={valorVenta}
                      onChange={(e) =>
                        setValorVenta(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:border-[#047857] transition-colors"
                    />
                  </div>

                  {/* Chips rápidos si es porcentaje */}
                  {metodoVenta === "PORCENTAJE" && (
                    <div className="flex flex-wrap gap-1">
                      {QUICK_PERCENTAGES.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setValorVenta(pct)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors",
                            valorVenta === pct
                              ? "bg-[#047857] border-[#047857] text-white"
                              : "bg-[var(--panel)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                          )}
                        >
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Preview Venta */}
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Nuevo precio:</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-[#34D399]">
                        {formatCurrency(nuevoPrecioVenta)}
                      </span>
                      {diffVenta !== 0 && (
                        <span
                          className={cn(
                            "block text-[10px] font-bold font-mono",
                            diffVenta > 0 ? "text-[#34D399]" : "text-[#F87171]"
                          )}
                        >
                          {diffVenta > 0 ? `+${formatCurrency(diffVenta)}` : formatCurrency(diffVenta)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] py-2">
                  El precio de venta se mantendrá en {formatCurrency(producto.precioVenta)}.
                </p>
              )}
            </div>
          </div>

          {/* 3. Margen de Ganancia y Redondeo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            {/* Margen */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <Calculator size={13} className="text-amber-400" />
                Margen de Ganancia
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="font-mono text-sm">
                  <span className="text-[var(--text-secondary)]">Actual: </span>
                  <strong className="text-[var(--text)]">
                    {margenActual !== null ? `${margenActual}%` : "—"}
                  </strong>
                </div>
                <ArrowRight size={14} className="text-[var(--text-muted)]" />
                <div className="font-mono text-sm">
                  <span className="text-[var(--text-secondary)]">Nuevo: </span>
                  <strong
                    className={cn(
                      margenNuevo !== null && margenNuevo >= 30
                        ? "text-[#34D399]"
                        : margenNuevo !== null && margenNuevo > 0
                        ? "text-amber-400"
                        : "text-[#F87171]"
                    )}
                  >
                    {margenNuevo !== null ? `${margenNuevo}%` : "—"}
                  </strong>
                </div>
                {variacionMargen !== null && variacionMargen !== 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                      variacionMargen > 0
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {variacionMargen > 0 ? `+${variacionMargen.toFixed(1)}%` : `${variacionMargen.toFixed(1)}%`}
                  </span>
                )}
              </div>
            </div>

            {/* Redondeo */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                Redondeo aplicado
              </label>
              <select
                value={redondeo}
                onChange={(e) => setRedondeo(e.target.value as TipoRedondeo)}
                className="w-full h-8 px-2 bg-[var(--panel)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="SIN_REDONDEO">Sin redondeo (2 decimales)</option>
                <option value="ENTERO">Al peso más cercano ($1)</option>
                <option value="MULTIPLO_10">Al múltiplo de $10</option>
                <option value="MULTIPLO_100">Al múltiplo de $100</option>
                <option value="MULTIPLO_1000">Al múltiplo de $1.000</option>
              </select>
            </div>
          </div>

          {/* 4. Motivo obligatorio */}
          <div>
            <label className="block text-xs font-bold text-[var(--text)] mb-1">
              Motivo del ajuste * <span className="text-[11px] font-normal text-[var(--text-secondary)]">(Obligatorio para auditoría)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Actualización por lista de proveedor, inflación, error de carga..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
            />
            {/* Sugerencias de motivo */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {MOTIVO_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setMotivo(sug)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 5. Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={!isValid || isPending}
              loading={isPending}
              leftIcon={<CheckCircle size={15} />}
            >
              Confirmar ajuste de precio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
