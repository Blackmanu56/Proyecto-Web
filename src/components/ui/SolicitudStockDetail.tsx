"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  aprobarSolicitudUnificada,
  rechazarSolicitudUnificada,
  cancelarSolicitudUnificada,
} from "@/actions/solicitudes";
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Landmark,
  Layers,
  Minus,
  Package,
  Plus,
  Tag,
  Truck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import AjustarPrecioIndividualModal from "@/components/ui/AjustarPrecioIndividualModal";

/* ────────────────────── Types ────────────────────── */

interface SolicitudData {
  id: number;
  tipo: "RESTA" | "REPOSICION" | string;
  cantidad: number;
  stockAnterior: number;
  motivo: string;
  estado: string;
  observacionResolucion?: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  producto: {
    id: number;
    nombre: string;
    cantidad: number;
    precioCompra?: number;
    precioVenta?: number;
    codigo?: string | null;
    imagen?: string | null;
    marca?: string | null;
    categoria?: { id: number; nombre: string } | null;
    proveedor?: { id: number; nombre: string } | null;
    activo?: boolean;
  };
  solicitante: { id: number; nombreCompleto: string };
  resueltoPor?: { id: number; nombreCompleto: string } | null;
  origenTabla?: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja";
}

interface SolicitudStockDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudData;
  currentUserId?: number;
  userRole?: string;
  onSuccess: () => void;
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudStockDetail({
  open,
  onOpenChange,
  solicitud,
  currentUserId,
  userRole,
  onSuccess,
}: SolicitudStockDetailProps) {
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  // Payment method & Price adjustment states
  const [metodoPago, setMetodoPago] = useState<"EFECTIVO" | "BANCO">("EFECTIVO");
  const [precioCompraActual, setPrecioCompraActual] = useState<number>(
    solicitud.producto.precioCompra ?? 0
  );
  const [precioVentaActual, setPrecioVentaActual] = useState<number>(
    solicitud.producto.precioVenta ?? 0
  );
  const [showAjustarPrecioModal, setShowAjustarPrecioModal] = useState(false);

  useEffect(() => {
    if (solicitud.producto.precioCompra !== undefined) {
      setPrecioCompraActual(solicitud.producto.precioCompra);
    }
    if (solicitud.producto.precioVenta !== undefined) {
      setPrecioVentaActual(solicitud.producto.precioVenta);
    }
  }, [solicitud.producto.precioCompra, solicitud.producto.precioVenta]);

  const isResta = solicitud.tipo === "RESTA";
  const isPendiente = solicitud.estado === "PENDIENTE";
  const isAdmin = userRole === "ADMINISTRADOR";
  const isOwnSolicitud = currentUserId !== undefined && solicitud.solicitante.id === currentUserId;
  const origenTabla = solicitud.origenTabla ?? "solicitud_stock";

  const handleApprove = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await aprobarSolicitudUnificada(
          solicitud.id,
          origenTabla,
          isResta ? undefined : metodoPago
        );
        if ("error" in res && res.error) {
          setError(res.error ?? "Error al aprobar");
          return;
        }
        setSuccess(true);
        toast.success("Solicitud aprobada");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al aprobar.");
      }
    });
  };

  const handleReject = () => {
    if (!rejectMotivo.trim()) {
      setError("El motivo de rechazo es obligatorio.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const res = await rechazarSolicitudUnificada(solicitud.id, origenTabla, rejectMotivo.trim());
        if ("error" in res && res.error) {
          setError(res.error ?? "Error al rechazar");
          return;
        }
        setSuccess(true);
        toast.success("Solicitud rechazada");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al rechazar.");
      }
    });
  };

  const handleCancel = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await cancelarSolicitudUnificada(solicitud.id, origenTabla);
        if ("error" in res && res.error) {
          setError(res.error ?? "Error al cancelar");
          return;
        }
        setSuccess(true);
        toast.success("Solicitud cancelada");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1200);
      } catch {
        setError("Error inesperado al cancelar.");
      }
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setRejectMotivo("");
    setShowRejectInput(false);
    setError("");
    setSuccess(false);
  };

  const fechaStr = (() => {
    try {
      return format(new Date(solicitud.createdAt), "dd 'de' MMMM, HH:mm", { locale: es });
    } catch {
      return String(solicitud.createdAt);
    }
  })();

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="p-6 text-center">
            <CheckCircle
              size={40}
              className="mx-auto text-[var(--success)] mb-3"
            />
            <p className="text-sm font-semibold text-[var(--success)]">
              Acción completada
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={`p-2 rounded-[var(--radius-md)] ${
                isResta
                  ? "bg-[var(--danger-light)] text-[var(--danger)]"
                  : "bg-[var(--success-light)] text-[var(--success)]"
              }`}
            >
              {isResta ? <Minus size={18} /> : <Plus size={18} />}
            </div>
            Solicitud #{solicitud.id}
          </DialogTitle>
          <DialogDescription>
            {isPendiente
              ? "Revisá los detalles y aprobá o rechazá esta solicitud."
              : `Estado: ${solicitud.estado}`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Metadata grid (Fecha, Hora, Solicitante, Referencia) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs">
          <div className="space-y-0.5">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar size={10} />
              Fecha
            </p>
            <p className="text-xs text-[var(--text)] font-semibold">{fechaStr.split(",")[0] || fechaStr}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} />
              Hora
            </p>
            <p className="text-xs text-[var(--text)] font-mono font-semibold">{fechaStr.includes(",") ? fechaStr.split(",")[1]?.trim() : "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
              <User size={10} />
              Solicitante
            </p>
            <p className="text-xs text-[var(--text)] font-semibold truncate" title={solicitud.solicitante.nombreCompleto}>
              {solicitud.solicitante.nombreCompleto}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
              <Tag size={10} />
              Tipo
            </p>
            <p className={`text-xs font-bold uppercase ${isResta ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
              {solicitud.tipo}
            </p>
          </div>
        </div>

        {/* ── Detalle del Producto Card ── */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3.5 space-y-3">
          <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
            <Package size={11} />
            Detalle del Producto
          </p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="col-span-2 space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Producto</p>
              <p className="text-sm text-[var(--text)] font-semibold">{solicitud.producto.nombre}</p>
              {solicitud.producto.codigo && (
                <p className="text-[11px] font-mono text-[var(--text-muted)]">Cód: {solicitud.producto.codigo}</p>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} /> Marca
              </p>
              <p className="text-xs text-[var(--text)] font-semibold">{solicitud.producto.marca ?? "—"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers size={10} /> Categoría
              </p>
              <p className="text-xs text-[var(--text)] font-semibold">{solicitud.producto.categoria?.nombre ?? "—"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Truck size={10} /> Proveedor
              </p>
              <p className="text-xs text-[var(--text)] font-semibold">{solicitud.producto.proveedor?.nombre ?? "—"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Cantidad solicitada</p>
              <p className="text-xs text-[var(--text)] font-mono font-bold">{solicitud.cantidad} unidades</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Stock actual</p>
              <p className="text-xs text-[var(--text)] font-mono font-semibold">{solicitud.producto.cantidad} unidades</p>
            </div>
            {isResta ? (
              <div className="space-y-0.5">
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Stock post-aprobación</p>
                <p className="text-xs text-[var(--danger)] font-mono font-bold">
                  {Math.max(0, solicitud.producto.cantidad - solicitud.cantidad)} unidades
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Precio compra unit.</p>
                  <p className="text-xs text-[var(--text)] font-mono font-semibold">{formatCurrency(precioCompraActual)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Importe total</p>
                  <p className="text-xs text-[var(--warning)] font-mono font-bold">{formatCurrency(precioCompraActual * solicitud.cantidad)}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Motivo y Observaciones Card ── */}
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2 text-xs">
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Motivo de la solicitud</p>
            <p className="text-xs text-[var(--text)] leading-relaxed">{solicitud.motivo || "—"}</p>
          </div>
          {solicitud.resueltoPor && (
            <div className="pt-2 border-t border-[var(--border)]/70 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <UserCheck size={11} className="text-[var(--brand)]" />
                Resuelto por: <strong className="text-[var(--text)]">{solicitud.resueltoPor.nombreCompleto}</strong>
              </span>
              {solicitud.resolvedAt && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {format(new Date(solicitud.resolvedAt), "dd/MM/yyyy HH:mm")}
                </span>
              )}
            </div>
          )}
          {solicitud.observacionResolucion && (
            <div className="pt-1.5 border-t border-[var(--border)]/70 space-y-0.5">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Observación de resolución</p>
              <p className="text-xs text-[var(--text)]">{solicitud.observacionResolucion}</p>
            </div>
          )}
        </div>

        {/* ═══ FORMA DE PAGO OBLIGATORIA & AJUSTE DE PRECIO (Solo REPOSICIÓN para Admin en estado Pendiente) ═══ */}
        {!isResta && isPendiente && isAdmin && !showRejectInput && !showCancelConfirm && (
          <div className="space-y-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)]">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Forma de Pago <span className="text-[var(--danger)]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetodoPago("EFECTIVO")}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                    metodoPago === "EFECTIVO"
                      ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                  disabled={isTransitionPending}
                >
                  <Banknote size={15} />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago("BANCO")}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                    metodoPago === "BANCO"
                      ? "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                  disabled={isTransitionPending}
                >
                  <Landmark size={15} />
                  Transferencia / Banco
                </button>
              </div>
            </div>

            {/* Resumen Financiero y Enlace Ajustar Precio */}
            <div className="p-3 rounded-xl bg-[var(--panel)]/70 border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Precio de compra actual:</span>
                <span className="font-mono font-bold text-[var(--text)]">
                  {formatCurrency(precioCompraActual)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Cantidad solicitada:</span>
                <span className="font-mono font-bold text-[var(--text)]">
                  {solicitud.cantidad} u.
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-[var(--border)]/70 pt-2">
                <span className="font-semibold text-[var(--text)]">
                  Monto del egreso ({metodoPago === "EFECTIVO" ? "Caja" : "Banco"}):
                </span>
                <span className="font-mono font-black text-base text-[var(--warning)]">
                  {formatCurrency(precioCompraActual * solicitud.cantidad)}
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

        {/* Error */}
        {error && (
          <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Actions — only for PENDIENTE */}
        {isPendiente && !success && (
          <div className="space-y-3">
            {showRejectInput && (
              <div>
                <label className="block text-xs font-medium text-[var(--text)] mb-1.5">
                  Motivo de rechazo *
                </label>
                <textarea
                  value={rejectMotivo}
                  onChange={(e) => setRejectMotivo(e.target.value)}
                  placeholder="Indicá por qué se rechaza esta solicitud..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none transition-colors"
                />
              </div>
            )}

            {showCancelConfirm && (
              <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 rounded-[var(--radius-md)]">
                <p className="text-xs text-[var(--danger)] font-semibold mb-2">
                  ¿Seguro que querés cancelar esta solicitud?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isTransitionPending}
                  >
                    No, volver
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleCancel}
                    disabled={isTransitionPending}
                    loading={isTransitionPending}
                    leftIcon={<XCircle size={14} />}
                  >
                    Sí, cancelar
                  </Button>
                </div>
              </div>
            )}

            {!showRejectInput && !showCancelConfirm && (
              <div className="flex justify-end gap-3">
                {/* Empleado: "Cancelar solicitud" si es su solicitud y está pendiente */}
                {!isAdmin && isOwnSolicitud && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isTransitionPending}
                    leftIcon={<XCircle size={14} />}
                  >
                    Cancelar solicitud
                  </Button>
                )}
                {/* Admin: Botones de Aprobar y Rechazar si la solicitud está pendiente */}
                {isAdmin && (
                  <>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => setShowRejectInput(true)}
                      disabled={isTransitionPending}
                      leftIcon={<XCircle size={14} />}
                    >
                      Rechazar
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      onClick={handleApprove}
                      disabled={isTransitionPending}
                      loading={isTransitionPending}
                      leftIcon={<CheckCircle size={14} />}
                    >
                      Aprobar
                    </Button>
                  </>
                )}
              </div>
            )}

            {showRejectInput && (
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectMotivo("");
                    setError("");
                  }}
                  disabled={isTransitionPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleReject}
                  disabled={isTransitionPending || !rejectMotivo.trim()}
                  loading={isTransitionPending}
                  leftIcon={<XCircle size={14} />}
                >
                  Confirmar rechazo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Modal existente: Ajustar Precios de Producto */}
        {showAjustarPrecioModal && (
          <AjustarPrecioIndividualModal
            open={true}
            onOpenChange={(v) => {
              if (!v) setShowAjustarPrecioModal(false);
            }}
            producto={{
              id: solicitud.producto.id,
              nombre: solicitud.producto.nombre,
              codigo: solicitud.producto.codigo ?? null,
              imagen: solicitud.producto.imagen ?? null,
              marca: solicitud.producto.marca ?? null,
              precioCompra: precioCompraActual,
              precioVenta: precioVentaActual,
              activo: solicitud.producto.activo ?? true,
              categoria: solicitud.producto.categoria ?? undefined,
              proveedor: solicitud.producto.proveedor ?? undefined,
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
