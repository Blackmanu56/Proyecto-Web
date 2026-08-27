"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, AlertTriangle, CheckCircle, Package, Banknote, Landmark, DollarSign } from "lucide-react";
import { crearSolicitudStock } from "@/actions/solicitudes-stock";
import { crearYaprobarReposicion } from "@/actions/reposiciones";
import { formatCurrency } from "@/lib/utils";
import AjustarPrecioIndividualModal from "@/components/ui/AjustarPrecioIndividualModal";

/* ────────────────────── Types ────────────────────── */

interface CrearPedidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: {
    id: number;
    nombre: string;
    imagen: string | null;
    cantidad: number;
    precioCompra: number;
    precioVenta?: number;
    codigo?: string | null;
    marca?: string | null;
    proveedorId: number;
    proveedorNombre: string;
    categoria?: { id: number; nombre: string };
    proveedor?: { id: number; nombre: string };
  };
  onSuccess: () => void;
  canApprove?: boolean;
}

/* ────────────────────── Constants ────────────────────── */

const MOTIVO_OPTIONS = [
  "Stock bajo por ventas",
  "Reposición urgente",
  "Pedido de cliente",
  "Previsión de temporada",
  "Nuevo proveedor",
  "Otro",
] as const;

/* ────────────────────── Component ────────────────────── */

export default function CrearPedidoModal({
  open,
  onOpenChange,
  producto,
  onSuccess,
  canApprove,
}: CrearPedidoModalProps) {
  const [cantidad, setCantidad] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [observacion, setObservacion] = useState("");
  const [formaPago, setFormaPago] = useState<"EFECTIVO" | "BANCO">("EFECTIVO");
  const [precioCompraActual, setPrecioCompraActual] = useState(producto.precioCompra);
  const [precioVentaActual, setPrecioVentaActual] = useState(producto.precioVenta ?? 0);
  const [showAjustarPrecioModal, setShowAjustarPrecioModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  React.useEffect(() => {
    setPrecioCompraActual(producto.precioCompra);
    setPrecioVentaActual(producto.precioVenta ?? 0);
  }, [producto.precioCompra, producto.precioVenta, open]);

  const cantidadNum = typeof cantidad === "number" ? cantidad : 0;
  const esOtro = motivo === "Otro";
  const motivoFinal = esOtro ? motivoOtro.trim() : motivo;

  const isValid =
    cantidadNum > 0 &&
    motivoFinal.length > 0 &&
    (!esOtro || motivoOtro.trim().length > 0);

  /* ── Construir string de motivo para guardar en DB ── */
  const buildMotivoString = (): string | undefined => {
    const parts: string[] = [];
    if (esOtro) {
      parts.push(`Otro: ${motivoOtro.trim()}`);
    } else if (motivo) {
      parts.push(motivo);
    }
    if (observacion.trim()) {
      parts.push(`Observación: ${observacion.trim()}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  };

  /* ── Helper de stock ── */
  const stockBadge = (cantidad: number) => {
    if (cantidad === 0) {
      return <Badge variant="danger" size="sm">Sin stock</Badge>;
    }
    if (cantidad <= 5) {
      return <Badge variant="warning" size="sm">{cantidad} uds</Badge>;
    }
    return <Badge variant="success" size="sm">{cantidad} uds</Badge>;
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      let res: { success?: boolean; error?: string };

      if (canApprove) {
        res = await crearYaprobarReposicion(producto.id, {
          cantidad: cantidadNum,
          proveedorId: producto.proveedorId,
          origenPago: formaPago === "BANCO" ? "TRANSFERENCIA_BANCARIA" : "EFECTIVO_CAJA",
          motivo: buildMotivoString(),
        });
      } else {
        const obs = observacion.trim() ? observacion.trim() : undefined;
        const stockRes = await crearSolicitudStock(
          "REPOSICION",
          producto.id,
          cantidadNum,
          motivoFinal,
          obs
        );
        res = {
          success: !("error" in stockRes) && Boolean(stockRes.success),
          error: "error" in stockRes ? stockRes.error : undefined,
        };
      }

      if (res.success) {
        setSuccess(true);
        setSuccessMessage(
          canApprove
            ? "Pedido creado y ejecutado. El stock se actualizó inmediatamente."
            : "Pedido creado correctamente. El administrador deberá aprobarlo antes de ejecutar la reposición."
        );
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
          resetForm();
        }, 1500);
      } else {
        setError(res.error || "Error al crear el pedido.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset ── */
  const resetForm = () => {
    setCantidad("");
    setMotivo("");
    setMotivoOtro("");
    setObservacion("");
    setError("");
    setSuccess(false);
    setSuccessMessage("");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <ShoppingCart size={18} />
            </div>
            Crear pedido
          </DialogTitle>
          <DialogDescription className="text-sm text-text-muted whitespace-normal break-words [overflow-wrap:anywhere] leading-relaxed">
            Crear una solicitud de reposición para{" "}
            <strong className="text-[var(--text)] font-semibold">{producto.nombre}</strong>.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-[var(--radius-md)] text-center">
            <CheckCircle size={32} className="mx-auto text-[var(--success)] mb-2" />
            <p className="text-sm font-semibold text-[var(--success)]">
              {successMessage}
            </p>
          </div>
        ) : (
          <>
            {/* ── Resumen del producto ── */}
            <div className="flex items-start gap-3 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] min-w-0 w-full overflow-hidden">
              <div className="relative h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center overflow-hidden">
                {producto.imagen ? (
                  <Image
                    src={producto.imagen}
                    alt={producto.nombre}
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                  />
                ) : (
                  <Package size={20} className="text-[var(--text-secondary)] opacity-40" />
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p
                  className="text-sm font-semibold text-[var(--text)] leading-snug whitespace-normal break-words [overflow-wrap:anywhere]"
                  title={producto.nombre}
                >
                  {producto.nombre}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-[var(--text-secondary)]">Stock:</span>
                  {stockBadge(producto.cantidad)}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-normal break-words">
                  Proveedor:{" "}
                  <strong className="text-[var(--text)]">{producto.proveedorNombre}</strong>
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Precio compra:{" "}
                  <strong className="font-mono text-[var(--text)]">
                    {formatCurrency(precioCompraActual)}
                  </strong>
                </p>
              </div>
            </div>

            {/* ── Cantidad ── */}
            <FormField label="Cantidad a solicitar" required>
              <input
                type="number"
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCantidad(isNaN(val) ? "" : Math.max(1, val));
                }}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === ".") e.preventDefault();
                }}
                placeholder="Cantidad"
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </FormField>

            {/* ── Motivo ── */}
            <FormField label="Motivo de la reposición" required>
              <select
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  if (e.target.value !== "Otro") setMotivoOtro("");
                }}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors"
              >
                <option value="" disabled>
                  Seleccioná un motivo...
                </option>
                {MOTIVO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </FormField>

            {/* ── Motivo "Otro" (condicional) ── */}
            {esOtro && (
              <FormField label="Especificá el motivo" required>
                <textarea
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                  placeholder="Describí el motivo de la reposición..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
                />
              </FormField>
            )}

            {/* ── Observación (opcional) ── */}
            <FormField label="Observación">
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Agregá una observación para el administrador..."
                rows={2}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
              />
            </FormField>

            {/* ── Crear y aprobar automáticamente (solo admin) ── */}
            {canApprove && (
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Forma de pago <span className="text-[var(--danger)]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormaPago("EFECTIVO")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        formaPago === "EFECTIVO"
                          ? "border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E] shadow-sm"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <Banknote size={15} />
                      Efectivo (Caja)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPago("BANCO")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        formaPago === "BANCO"
                          ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8] shadow-sm"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <Landmark size={15} />
                      Transferencia / Banco
                    </button>
                  </div>
                </div>

                {/* Resumen Financiero y Botón Ajustar Precio */}
                <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Precio de compra actual:</span>
                    <span className="font-mono font-bold text-[var(--text)]">
                      {formatCurrency(precioCompraActual)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Cantidad a reponer:</span>
                    <span className="font-mono font-bold text-[var(--text)]">
                      {cantidadNum} u.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-[var(--border)]/70 pt-2">
                    <span className="font-semibold text-[var(--text)]">
                      Monto del egreso ({formaPago === "EFECTIVO" ? "Caja" : "Banco"}):
                    </span>
                    <span className="font-mono font-black text-base text-[var(--warning)]">
                      {formatCurrency(precioCompraActual * cantidadNum)}
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAjustarPrecioModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-transparent hover:bg-[var(--card)] hover:border-[var(--text-muted)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] transition-all shadow-sm"
                    >
                      <DollarSign size={13} className="text-[var(--brand)]" />
                      ¿Cambió el precio de compra?
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            {/* ── Botones ── */}
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
                className="bg-[var(--brand)] hover:bg-[var(--brand)]/85 text-white shadow-sm font-bold active:scale-95"
              >
                {loading ? "Creando pedido..." : canApprove ? "Crear y aprobar" : "Crear pedido"}
              </Button>
            </div>
          </>
        )}

        {/* Modal existente: Ajustar Precios de Producto */}
        {showAjustarPrecioModal && (
          <AjustarPrecioIndividualModal
            open={true}
            onOpenChange={(v) => {
              if (!v) setShowAjustarPrecioModal(false);
            }}
            producto={{
              id: producto.id,
              nombre: producto.nombre,
              codigo: producto.codigo ?? null,
              imagen: producto.imagen ?? null,
              marca: producto.marca ?? null,
              precioCompra: precioCompraActual,
              precioVenta: precioVentaActual,
              activo: true,
              categoria: producto.categoria,
              proveedor: producto.proveedor ?? { id: producto.proveedorId, nombre: producto.proveedorNombre },
            }}
            initialAjustarCompra={true}
            initialAjustarVenta={false}
            onPriceUpdated={(newCompra, newVenta) => {
              setPrecioCompraActual(newCompra);
              if (newVenta) setPrecioVentaActual(newVenta);
            }}
            onSuccess={() => {
              setShowAjustarPrecioModal(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
