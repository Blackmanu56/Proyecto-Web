"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  aprobarSolicitudUnificada,
  rechazarSolicitudUnificada,
  cancelarSolicitudUnificada,
} from "@/actions/solicitudes";
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  UserCheck,
  Calendar,
  XCircle,
  Ban,
  Tag,
  Percent,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";

/* ────────────────────── Types ────────────────────── */

export interface SolicitudPrecioData {
  id: number;
  tipo: string;
  estado: string;
  fecha: Date | string;
  solicitanteId: number;
  solicitanteNombre: string;
  motivo?: string | null;
  detalle?: string | null;
  precioCompraActual?: number | null;
  precioCompraNuevo?: number | null;
  precioVentaActual?: number | null;
  precioVentaNuevo?: number | null;
  observacionResolucion?: string | null;
  aprobadorNombre?: string | null;
  fechaResolucion?: Date | string | null;
  producto?: {
    id: number;
    nombre: string;
    codigo?: string | null;
    imagen?: string | null;
    marca?: string | null;
    precioCompra: number;
    precioVenta: number;
    cantidad: number;
    activo: boolean;
    categoria?: { id: number; nombre: string };
    proveedor?: { id: number; nombre: string };
  };
}

interface SolicitudPrecioDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudPrecioData;
  currentUserId?: number;
  userRole?: string;
  onSuccess: () => void;
}

/* ────────────────────── Helpers ────────────────────── */

function calcularMargen(compra: number, venta: number): number {
  if (venta <= 0) return 0;
  return Number((((venta - compra) / venta) * 100).toFixed(1));
}

function calcularVariacion(anterior: number, nuevo: number): { diff: number; pct: number } {
  const diff = nuevo - anterior;
  if (anterior <= 0) return { diff, pct: 0 };
  const pct = Number(((diff / anterior) * 100).toFixed(1));
  return { diff, pct };
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudPrecioDetail({
  open,
  onOpenChange,
  solicitud,
  currentUserId,
  userRole,
  onSuccess,
}: SolicitudPrecioDetailProps) {
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isPendiente = solicitud.estado === "PENDIENTE";
  const isAdmin = userRole === "ADMINISTRADOR";
  const isOwnSolicitud = currentUserId !== undefined && solicitud.solicitanteId === currentUserId;

  const compraActual = solicitud.precioCompraActual ?? solicitud.producto?.precioCompra ?? 0;
  const compraNuevo = solicitud.precioCompraNuevo ?? compraActual;
  const ventaActual = solicitud.precioVentaActual ?? solicitud.producto?.precioVenta ?? 0;
  const ventaNuevo = solicitud.precioVentaNuevo ?? ventaActual;

  const tieneCambioCompra = compraNuevo !== compraActual;
  const tieneCambioVenta = ventaNuevo !== ventaActual;

  const varCompra = calcularVariacion(compraActual, compraNuevo);
  const varVenta = calcularVariacion(ventaActual, ventaNuevo);

  const margenActual = calcularMargen(compraActual, ventaActual);
  const margenNuevo = calcularMargen(compraNuevo, ventaNuevo);

  const handleApprove = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await aprobarSolicitudUnificada(solicitud.id, "solicitud_precio");
        if ("error" in res && res.error) {
          setError(res.error);
          return;
        }
        toast.success(`Solicitud #${solicitud.id} aprobada y precios actualizados`);
        onOpenChange(false);
        onSuccess();
      } catch {
        setError("Error inesperado al aprobar la solicitud.");
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
        const res = await rechazarSolicitudUnificada(
          solicitud.id,
          "solicitud_precio",
          rejectMotivo.trim()
        );
        if ("error" in res && res.error) {
          setError(res.error);
          return;
        }
        toast.success(`Solicitud #${solicitud.id} rechazada`);
        onOpenChange(false);
        onSuccess();
      } catch {
        setError("Error inesperado al rechazar la solicitud.");
      }
    });
  };

  const handleCancel = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await cancelarSolicitudUnificada(solicitud.id, "solicitud_precio");
        if ("error" in res && res.error) {
          setError(res.error);
          return;
        }
        toast.success(`Solicitud #${solicitud.id} cancelada`);
        onOpenChange(false);
        onSuccess();
      } catch {
        setError("Error inesperado al cancelar la solicitud.");
      }
    });
  };

  const handleClose = () => {
    setShowRejectInput(false);
    setShowCancelConfirm(false);
    setRejectMotivo("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto bg-[#13151b] border-[#232734] text-white p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-3 pb-4 border-b border-[#232734]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25">
                <DollarSign size={22} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Solicitud #{solicitud.id}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    Cambio de Precios
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  Revisión y aprobación de actualización de precios para producto
                </DialogDescription>
              </div>
            </div>

            {/* Estado Badge */}
            <div className="shrink-0">
              {solicitud.estado === "PENDIENTE" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Clock size={13} />
                  Pendiente
                </span>
              )}
              {solicitud.estado === "APROBADA" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle size={13} />
                  Aprobada
                </span>
              )}
              {solicitud.estado === "RECHAZADA" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <XCircle size={13} />
                  Rechazada
                </span>
              )}
              {solicitud.estado === "CANCELADA" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                  <Ban size={13} />
                  Cancelada
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Product Summary Header */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#1a1d26] border border-[#262b3a] mt-2">
          {solicitud.producto?.imagen ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#2a2f40] bg-[#12141a]">
              <Image
                src={solicitud.producto.imagen}
                alt={solicitud.producto.nombre}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#2a2f40] bg-[#12141a] text-gray-400">
              <Package size={24} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate" title={solicitud.producto?.nombre}>
              {solicitud.producto?.nombre || "Producto no encontrado"}
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
              {solicitud.producto?.codigo && (
                <span className="font-mono text-gray-300">Cód: {solicitud.producto.codigo}</span>
              )}
              {solicitud.producto?.marca && (
                <span>Marca: <strong className="text-gray-200">{solicitud.producto.marca}</strong></span>
              )}
              {solicitud.producto?.categoria && (
                <span className="flex items-center gap-1">
                  <Tag size={11} />
                  {solicitud.producto.categoria.nombre}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price Comparison Grid */}
        <div className="space-y-2 mt-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Comparativa de Precios
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Precio Compra Card */}
            <div
              className={cn(
                "p-3.5 rounded-xl border transition-all",
                tieneCambioCompra
                  ? "bg-gradient-to-br from-[#1a1e2b] to-[#141722] border-blue-500/30"
                  : "bg-[#161922] border-[#232734] opacity-80"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300">Precio de Compra</span>
                {tieneCambioCompra ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md",
                      varCompra.diff > 0
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    )}
                  >
                    {varCompra.diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {varCompra.diff > 0 ? `+${varCompra.pct}%` : `${varCompra.pct}%`}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                    Sin cambios
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block">Actual</span>
                  <span className="text-sm font-semibold text-gray-400 line-through">
                    {formatCurrency(compraActual)}
                  </span>
                </div>
                <ArrowRight size={14} className="text-gray-500" />
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">Solicitado</span>
                  <span
                    className={cn(
                      "text-base font-black",
                      tieneCambioCompra ? "text-blue-400" : "text-gray-300"
                    )}
                  >
                    {formatCurrency(compraNuevo)}
                  </span>
                </div>
              </div>
            </div>

            {/* Precio Venta Card */}
            <div
              className={cn(
                "p-3.5 rounded-xl border transition-all",
                tieneCambioVenta
                  ? "bg-gradient-to-br from-[#1a231f] to-[#141d18] border-emerald-500/30"
                  : "bg-[#161922] border-[#232734] opacity-80"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300">Precio de Venta</span>
                {tieneCambioVenta ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md",
                      varVenta.diff > 0
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    )}
                  >
                    {varVenta.diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {varVenta.diff > 0 ? `+${varVenta.pct}%` : `${varVenta.pct}%`}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                    Sin cambios
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block">Actual</span>
                  <span className="text-sm font-semibold text-gray-400 line-through">
                    {formatCurrency(ventaActual)}
                  </span>
                </div>
                <ArrowRight size={14} className="text-gray-500" />
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">Solicitado</span>
                  <span
                    className={cn(
                      "text-base font-black",
                      tieneCambioVenta ? "text-emerald-400" : "text-gray-300"
                    )}
                  >
                    {formatCurrency(ventaNuevo)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Margen Summary */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#161922] border border-[#232734] text-xs">
            <span className="text-gray-400 flex items-center gap-1.5 font-medium">
              <Percent size={13} className="text-violet-400" />
              Margen de ganancia comercial estimado
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{margenActual}%</span>
              <ArrowRight size={12} className="text-gray-600" />
              <span
                className={cn(
                  "font-bold",
                  margenNuevo >= margenActual ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {margenNuevo}%
              </span>
            </div>
          </div>
        </div>

        {/* Motivo informado */}
        <div className="space-y-1.5 mt-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Motivo del cambio
          </label>
          <div className="p-3 rounded-xl bg-[#161922] border border-[#232734] text-xs text-gray-200 leading-relaxed italic">
            "{solicitud.motivo || solicitud.detalle || "Sin motivo especificado"}"
          </div>
        </div>

        {/* Meta details: Solicitante, Fechas, Resolucion */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#161922]/60 border border-[#232734] text-xs mt-3">
          <div className="flex items-center gap-2">
            <User size={13} className="text-gray-500 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-500 block uppercase">Solicitante</span>
              <span className="font-semibold text-gray-200">{solicitud.solicitanteNombre}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-gray-500 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-500 block uppercase">Fecha Solicitud</span>
              <span className="font-semibold text-gray-200">
                {format(new Date(solicitud.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
              </span>
            </div>
          </div>

          {solicitud.aprobadorNombre && (
            <div className="flex items-center gap-2">
              <UserCheck size={13} className="text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 block uppercase">Resuelto por</span>
                <span className="font-semibold text-gray-200">{solicitud.aprobadorNombre}</span>
              </div>
            </div>
          )}

          {solicitud.fechaResolucion && (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 block uppercase">Fecha Resolución</span>
                <span className="font-semibold text-gray-200">
                  {format(new Date(solicitud.fechaResolucion), "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Observacion de resolucion */}
        {solicitud.observacionResolucion && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 mt-2">
            <span className="font-bold block mb-1">Nota de resolución:</span>
            {solicitud.observacionResolucion}
          </div>
        )}

        {/* Mensaje de error si hubo */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 mt-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Reject form for Admin */}
        {isAdmin && isPendiente && showRejectInput && (
          <div className="space-y-3 pt-3 border-t border-[#232734] mt-3">
            <div>
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">
                Motivo del rechazo <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={rejectMotivo}
                onChange={(e) => setRejectMotivo(e.target.value)}
                placeholder="Indicá el motivo por el cual se rechaza el cambio de precio..."
                rows={3}
                className="w-full px-3 py-2 bg-[#161922] border border-[#232734] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 resize-none transition-colors"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectMotivo("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#232734] text-gray-400 hover:bg-white/5 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending || !rejectMotivo.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                <XCircle size={14} />
                {isPending ? "Rechazando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        )}

        {/* Cancel confirmation for Employee */}
        {!isAdmin && isPendiente && isOwnSolicitud && showCancelConfirm && (
          <div className="space-y-3 pt-3 border-t border-[#232734] mt-3">
            <p className="text-xs text-gray-400">
              ¿Estás seguro de que deseás cancelar tu solicitud de cambio de precio? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#232734] text-gray-400 hover:bg-white/5 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                <Ban size={14} />
                {isPending ? "Cancelando..." : "Sí, Cancelar Solicitud"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#232734] mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#232734] text-gray-400 hover:bg-white/5 transition-colors"
          >
            Cerrar
          </button>

          {/* Admin Pending Actions */}
          {isAdmin && isPendiente && !showRejectInput && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRejectInput(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
              >
                <XCircle size={14} />
                Rechazar
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle size={14} />
                {isPending ? "Aplicando..." : "Aprobar y Aplicar"}
              </button>
            </div>
          )}

          {/* Employee Cancel Button */}
          {!isAdmin && isPendiente && isOwnSolicitud && !showCancelConfirm && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              <Ban size={14} />
              Cancelar solicitud
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
