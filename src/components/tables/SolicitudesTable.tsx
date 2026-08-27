"use client";

import React, { useState, useMemo, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Filter,
  TrendingUp,
  TrendingDown,
  Wallet,
  Check,
  X,
  Ban,
  Loader2,
  AlertTriangle,
  Search,
  Eraser,
  Layers,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import SolicitudStockDetail from "@/components/ui/SolicitudStockDetail";
import {
  aprobarSolicitudUnificada,
  rechazarSolicitudUnificada,
  cancelarSolicitudUnificada,
} from "@/actions/solicitudes";
import {
  aprobarSolicitudCaja,
  rechazarSolicitudCaja,
} from "@/actions/caja";
import { toast } from "sonner";

/* ────────────────────── Types ────────────────────── */

interface SolicitudUnificada {
  id: number;
  origen: "PRODUCTOS" | "CAJA";
  tipo: string;
  solicitanteId: number;
  solicitanteNombre: string;
  fecha: Date | string;
  estado: string;
  detalle: string;
  productoNombre?: string;
  cantidad?: number;
  monto?: number | null;
  motivo?: string | null;
  proveedorNombre?: string | null;
  origenTabla?: "solicitud_stock" | "solicitud_reposicion" | "solicitud_caja";
}

interface SolicitudesTableProps {
  solicitudes: SolicitudUnificada[];
  userRole: string;
  userId: number;
  initialFilter?: string;
}

type EstadoTab = "TODAS" | "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";

type ModuloFilter = "TODOS" | "PRODUCTOS" | "CAJA";

type TipoFilter =
  | "TODOS"
  | "Producto-Resta"
  | "Producto-Reposición"
  | "Caja-Apertura"
  | "Caja-Cierre"
  | "Caja-Ajuste efectivo"
  | "Caja-Ajuste banco"
  | "Caja-Egreso";

/* ────────────────────── Helpers & Select ────────────────────── */

const ESTADO_TABS: { key: EstadoTab; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "APROBADA", label: "Aprobadas" },
  { key: "RECHAZADA", label: "Rechazadas" },
  { key: "CANCELADA", label: "Canceladas" },
];

const MODULO_OPTIONS: { value: ModuloFilter; label: string; icon: React.ElementType }[] = [
  { value: "TODOS", label: "Todos los módulos", icon: Layers },
  { value: "PRODUCTOS", label: "Productos / Stock", icon: Boxes },
  { value: "CAJA", label: "Caja", icon: Wallet },
];

const SUBTIPO_BY_MODULO: Record<
  ModuloFilter,
  { value: TipoFilter; label: string; icon: React.ElementType }[]
> = {
  TODOS: [
    { value: "TODOS", label: "Todos los tipos", icon: Filter },
    { value: "Producto-Reposición", label: "Producto — Reposición", icon: TrendingUp },
    { value: "Producto-Resta", label: "Producto — Resta", icon: TrendingDown },
    { value: "Caja-Apertura", label: "Caja — Apertura", icon: Wallet },
    { value: "Caja-Cierre", label: "Caja — Cierre", icon: Wallet },
    { value: "Caja-Ajuste efectivo", label: "Caja — Ajuste efectivo", icon: Wallet },
    { value: "Caja-Ajuste banco", label: "Caja — Ajuste banco", icon: Wallet },
    { value: "Caja-Egreso", label: "Caja — Egreso / Gasto", icon: Wallet },
  ],
  PRODUCTOS: [
    { value: "TODOS", label: "Todos de productos", icon: Boxes },
    { value: "Producto-Reposición", label: "Reposición de stock", icon: TrendingUp },
    { value: "Producto-Resta", label: "Resta de stock", icon: TrendingDown },
  ],
  CAJA: [
    { value: "TODOS", label: "Todos de caja", icon: Wallet },
    { value: "Caja-Apertura", label: "Apertura de caja", icon: Wallet },
    { value: "Caja-Cierre", label: "Cierre de caja", icon: Wallet },
    { value: "Caja-Ajuste efectivo", label: "Ajuste de efectivo", icon: Wallet },
    { value: "Caja-Ajuste banco", label: "Ajuste de banco", icon: Wallet },
    { value: "Caja-Egreso", label: "Egreso / Gasto", icon: Wallet },
  ],
};

const MODULO_TONE = {
  trigger: "border-[#0284C7]/25 hover:border-[#0284C7]/60 focus-visible:border-[#0284C7] focus-visible:ring-[#0284C7]/20 data-[state=open]:border-[#0284C7]/70 data-[state=open]:ring-[#0284C7]/20",
  icon: "bg-[#0284C7]/15 text-[#38BDF8] ring-[#0284C7]/20",
  content: "border-[#0284C7]/30",
  itemFocus: "focus:bg-[#0284C7]/10",
  selected: "data-[state=checked]:bg-[#0284C7]/12 data-[state=checked]:text-[#BAE6FD]",
  check: "text-[#38BDF8]",
  chevron: "text-[#38BDF8]",
};

const TIPO_TONE = {
  trigger: "border-[#8B5CF6]/30 hover:border-[#8B5CF6]/60 focus-visible:border-[#8B5CF6] focus-visible:ring-[#8B5CF6]/20 data-[state=open]:border-[#8B5CF6]/70 data-[state=open]:ring-[#8B5CF6]/20",
  icon: "bg-[#8B5CF6]/15 text-[#A78BFA] ring-[#8B5CF6]/25",
  content: "border-[#8B5CF6]/30",
  itemFocus: "focus:bg-[#8B5CF6]/10",
  selected: "data-[state=checked]:bg-[#8B5CF6]/15 data-[state=checked]:text-[#DDD6FE]",
  check: "text-[#A78BFA]",
  chevron: "text-[#A78BFA]",
};

function ModuloFilterSelect({
  value,
  onValueChange,
}: {
  value: ModuloFilter;
  onValueChange: (v: ModuloFilter) => void;
}) {
  const selectedOption = MODULO_OPTIONS.find((o) => o.value === value) ?? MODULO_OPTIONS[0];
  const IconComponent = selectedOption.icon;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Módulo
      </label>
      <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as ModuloFilter)}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 min-w-[170px] max-w-[210px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200",
            MODULO_TONE.trigger
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", MODULO_TONE.icon)}>
              <IconComponent size={13} />
            </span>
            <span className="truncate">{selectedOption.label}</span>
          </span>
          <SelectPrimitive.Icon asChild>
            <svg
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", MODULO_TONE.chevron)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[170px] overflow-hidden rounded-xl border bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)] animate-in fade-in-80",
              MODULO_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="space-y-1">
              {MODULO_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text)] outline-none transition-colors",
                      MODULO_TONE.itemFocus,
                      MODULO_TONE.selected
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-md ring-1", MODULO_TONE.icon)}>
                        <OptionIcon size={12} />
                      </span>
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    </span>
                    <SelectPrimitive.ItemIndicator>
                      <Check size={14} className={cn("shrink-0", MODULO_TONE.check)} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

function TipoFilterSelect({
  value,
  onValueChange,
  modulo,
}: {
  value: TipoFilter;
  onValueChange: (v: TipoFilter) => void;
  modulo: ModuloFilter;
}) {
  const options = SUBTIPO_BY_MODULO[modulo] || SUBTIPO_BY_MODULO.TODOS;
  const selectedOption = options.find((o) => o.value === value) ?? options[0];
  const IconComponent = selectedOption.icon;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Tipo de solicitud
      </label>
      <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as TipoFilter)}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 min-w-[190px] max-w-[240px] items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200",
            TIPO_TONE.trigger
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", TIPO_TONE.icon)}>
              <IconComponent size={13} />
            </span>
            <span className="truncate">{selectedOption.label}</span>
          </span>
          <SelectPrimitive.Icon asChild>
            <svg
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", TIPO_TONE.chevron)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[190px] overflow-hidden rounded-xl border bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)] animate-in fade-in-80",
              TIPO_TONE.content
            )}
          >
            <SelectPrimitive.Viewport className="space-y-1">
              {options.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text)] outline-none transition-colors",
                      TIPO_TONE.itemFocus,
                      TIPO_TONE.selected
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-md ring-1", TIPO_TONE.icon)}>
                        <OptionIcon size={12} />
                      </span>
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    </span>
                    <SelectPrimitive.ItemIndicator>
                      <Check size={14} className={cn("shrink-0", TIPO_TONE.check)} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

function estadoBadge(estado: string) {
  switch (estado) {
    case "PENDIENTE":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#78350F]/40 text-[#FBBF24] border border-[#D97706]/30">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
          Pendiente
        </span>
      );
    case "APROBADA":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#064E3B]/40 text-[#34D399] border border-[#059669]/30">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
          Aprobada
        </span>
      );
    case "RECHAZADA":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#450A0A]/40 text-[#F87171] border border-[#DC2626]/30">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F87171]" />
          Rechazada
        </span>
      );
    case "CANCELADA":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1F2937]/50 text-gray-400 border border-gray-600/30">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
          Cancelada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--panel)] text-[var(--text-muted)] border border-[var(--border)]">
          {estado}
        </span>
      );
  }
}

function origenBadge(origen: "PRODUCTOS" | "CAJA") {
  if (origen === "CAJA") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#5B21B6]/15 text-[#A78BFA] border border-[#7C3AED]/25">
        <Wallet size={11} strokeWidth={2.5} />
        CAJA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#047857]/15 text-[#34D399] border border-[#059669]/25">
      <TrendingUp size={11} strokeWidth={2.5} />
      PRODUCTOS
    </span>
  );
}

function formatDateOnly(d: Date | string) {
  try {
    return format(new Date(d), "dd/MM/yy", { locale: es });
  } catch {
    return "—";
  }
}

function formatTimeOnly(d: Date | string) {
  try {
    return format(new Date(d), "HH:mm", { locale: es });
  } catch {
    return "";
  }
}

/* ────────────────────── Caja Detail Modal ────────────────────── */

function CajaDetailModal({
  open,
  onOpenChange,
  solicitud,
  userRole,
  currentUserId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitud: SolicitudUnificada;
  userRole: string;
  currentUserId?: number;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [showRechazo, setShowRechazo] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isAdmin = userRole === "ADMINISTRADOR";
  const isPendiente = solicitud.estado === "PENDIENTE";
  const isOwnSolicitud = currentUserId !== undefined && solicitud.solicitanteId === currentUserId;

  const handleAprobar = () => {
    startTransition(async () => {
      const res = await aprobarSolicitudCaja(solicitud.id);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Solicitud de caja #${solicitud.id} aprobada`);
      onOpenChange(false);
      onSuccess();
    });
  };

  const handleRechazar = () => {
    if (!motivoRechazo.trim()) {
      toast.error("El motivo de rechazo es obligatorio.");
      return;
    }
    startTransition(async () => {
      const res = await rechazarSolicitudCaja(solicitud.id, motivoRechazo.trim());
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Solicitud de caja #${solicitud.id} rechazada`);
      onOpenChange(false);
      onSuccess();
    });
  };

  const handleCancelar = () => {
    startTransition(async () => {
      const res = await cancelarSolicitudUnificada(solicitud.id, "solicitud_caja");
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Solicitud de caja #${solicitud.id} cancelada`);
      onOpenChange(false);
      onSuccess();
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-[#111318] border border-[#232734] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Solicitud de caja #{solicitud.id}
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">{solicitud.tipo}</p>
          </div>
          <div className="flex items-center gap-2">
            {estadoBadge(solicitud.estado)}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Tipo</span>
            <span className="font-medium text-[var(--text)]">
              {solicitud.tipo}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Solicitante</span>
            <span className="font-medium text-[var(--text)]">
              {solicitud.solicitanteNombre}
            </span>
          </div>
          {solicitud.monto != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Monto</span>
              <span className="font-medium text-[var(--text)]">
                ${solicitud.monto.toLocaleString("es-AR")}
              </span>
            </div>
          )}
          {solicitud.motivo && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Motivo</span>
              <span className="font-medium text-[var(--text)] text-right max-w-[250px]">
                {solicitud.motivo}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Fecha</span>
            <span className="font-medium text-[var(--text)]">
              {formatDateOnly(solicitud.fecha)}{" "}
              {formatTimeOnly(solicitud.fecha)}
            </span>
          </div>
        </div>

        {/* Admin Pending Actions */}
        {isAdmin && isPendiente && !showRechazo && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowRechazo(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
            >
              <X size={14} />
              Rechazar
            </button>
            <button
              type="button"
              onClick={handleAprobar}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#047857] hover:bg-[#065F46] text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Check size={14} />
              {isPending ? "Aprobando..." : "Aprobar"}
            </button>
          </div>
        )}

        {/* Admin Reject Form */}
        {isAdmin && isPendiente && showRechazo && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">
                Motivo del rechazo <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indicá el motivo del rechazo..."
                rows={3}
                className="w-full px-3 py-2 bg-[#161922] border border-[#232734] rounded-xl text-sm text-white focus:outline-none focus:border-[#7C3AED] resize-none transition-colors"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRechazo(false);
                  setMotivoRechazo("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--panel)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRechazar}
                disabled={isPending || !motivoRechazo.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                <X size={14} />
                {isPending ? "Rechazando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        )}

        {/* Employee Cancel Confirm */}
        {!isAdmin && isPendiente && isOwnSolicitud && showCancelConfirm && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-[var(--text-secondary)]">
              ¿Estás seguro de que deseás cancelar tu solicitud? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--panel)] transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelar}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                <Ban size={14} />
                {isPending ? "Cancelando..." : "Sí, Cancelar"}
              </button>
            </div>
          </div>
        )}

        {/* Non-Admin Normal Pending View */}
        {!isAdmin && isPendiente && isOwnSolicitud && !showCancelConfirm && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Ban size={14} />
              Cancelar solicitud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudesTable({
  solicitudes,
  userRole,
  userId,
  initialFilter,
}: SolicitudesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<EstadoTab>(() => {
    const estadoParam = searchParams.get("estado") || searchParams.get("filter") || initialFilter;
    if (
      estadoParam === "PENDIENTE" ||
      estadoParam === "APROBADA" ||
      estadoParam === "RECHAZADA" ||
      estadoParam === "CANCELADA" ||
      estadoParam === "TODAS"
    ) {
      return estadoParam;
    }
    return "TODAS";
  });
  const [search, setSearch] = useState("");
  const [moduloFilter, setModuloFilter] = useState<ModuloFilter>(() => {
    if (initialFilter === "PRODUCTOS") return "PRODUCTOS";
    if (initialFilter === "CAJA") return "CAJA";
    return "TODOS";
  });
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("TODOS");
  const [highlightedSolicitudId, setHighlightedSolicitudId] = useState<number | null>(() => {
    const idParam = searchParams.get("solicitudId") || searchParams.get("highlight") || searchParams.get("id");
    const parsed = Number(idParam);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  });
  const [selectedSolicitud, setSelectedSolicitud] =
    useState<SolicitudUnificada | null>(null);
  const [rejectModalSolicitud, setRejectModalSolicitud] =
    useState<SolicitudUnificada | null>(null);
  const [cancelModalSolicitud, setCancelModalSolicitud] =
    useState<SolicitudUnificada | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);
  const [, startActionTransition] = useTransition();

  const lastProcessedParamsRef = useRef<string | null>(null);

  /* ── Sincronizar filtros y highlight con query params de la URL ── */
  useEffect(() => {
    const paramsStr = searchParams.toString();
    if (lastProcessedParamsRef.current === paramsStr) return;
    lastProcessedParamsRef.current = paramsStr;

    startActionTransition(() => {
      const estadoParam = searchParams.get("estado") || searchParams.get("filter");
      if (
        estadoParam === "PENDIENTE" ||
        estadoParam === "APROBADA" ||
        estadoParam === "RECHAZADA" ||
        estadoParam === "CANCELADA" ||
        estadoParam === "TODAS"
      ) {
        setFilter(estadoParam);
      }

      const idParam = searchParams.get("solicitudId") || searchParams.get("highlight") || searchParams.get("id");
      const parsed = Number(idParam);
      if (!Number.isNaN(parsed) && parsed > 0) {
        setHighlightedSolicitudId(parsed);
        setSearch("");
        setModuloFilter("TODOS");
        setTipoFilter("TODOS");
      } else if (!idParam) {
        setHighlightedSolicitudId(null);
      }
    });
  }, [searchParams]);

  /* ── Auto-scroll a la solicitud resaltada ── */
  useEffect(() => {
    if (highlightedSolicitudId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`solicitud-row-${highlightedSolicitudId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedSolicitudId, solicitudes]);

  const handleModuloChange = useCallback((newMod: ModuloFilter) => {
    setModuloFilter(newMod);
    setTipoFilter("TODOS");
  }, []);

  const hasActiveFilters =
    search !== "" ||
    moduloFilter !== "TODOS" ||
    tipoFilter !== "TODOS" ||
    filter !== "TODAS" ||
    highlightedSolicitudId !== null;

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setModuloFilter("TODOS");
    setTipoFilter("TODOS");
    setFilter("TODAS");
    setHighlightedSolicitudId(null);
    lastProcessedParamsRef.current = "";
    if (searchParams.toString()) {
      router.replace("/solicitudes");
    }
  }, [router, searchParams]);

  const handleQuickApprove = (e: React.MouseEvent, sol: SolicitudUnificada) => {
    e.stopPropagation();
    if (!sol.origenTabla) return;
    setActionPendingId(sol.id);
    startActionTransition(async () => {
      try {
        const res = await aprobarSolicitudUnificada(sol.id, sol.origenTabla);
        if ("error" in res && res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Solicitud #${sol.id} aprobada`);
          router.refresh();
        }
      } catch {
        toast.error("Error inesperado al aprobar la solicitud");
      } finally {
        setActionPendingId(null);
      }
    });
  };

  const handleOpenRejectModal = (e: React.MouseEvent, sol: SolicitudUnificada) => {
    e.stopPropagation();
    setRejectModalSolicitud(sol);
    setRejectionReason("");
  };

  const handleConfirmReject = () => {
    if (!rejectModalSolicitud || !rejectModalSolicitud.origenTabla) return;
    if (!rejectionReason.trim()) {
      toast.error("Debe ingresar un motivo de rechazo");
      return;
    }
    setActionPendingId(rejectModalSolicitud.id);
    startActionTransition(async () => {
      try {
        const res = await rechazarSolicitudUnificada(
          rejectModalSolicitud.id,
          rejectModalSolicitud.origenTabla!,
          rejectionReason.trim()
        );
        if ("error" in res && res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Solicitud #${rejectModalSolicitud.id} rechazada`);
          setRejectModalSolicitud(null);
          router.refresh();
        }
      } catch {
        toast.error("Error inesperado al rechazar la solicitud");
      } finally {
        setActionPendingId(null);
      }
    });
  };

  const handleOpenCancelModal = (e: React.MouseEvent, sol: SolicitudUnificada) => {
    e.stopPropagation();
    setCancelModalSolicitud(sol);
  };

  const handleConfirmCancel = () => {
    if (!cancelModalSolicitud || !cancelModalSolicitud.origenTabla) return;
    setActionPendingId(cancelModalSolicitud.id);
    startActionTransition(async () => {
      try {
        const res = await cancelarSolicitudUnificada(
          cancelModalSolicitud.id,
          cancelModalSolicitud.origenTabla!
        );
        if ("error" in res && res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Solicitud #${cancelModalSolicitud.id} cancelada`);
          setCancelModalSolicitud(null);
          router.refresh();
        }
      } catch {
        toast.error("Error inesperado al cancelar la solicitud");
      } finally {
        setActionPendingId(null);
      }
    });
  };

  const filteredByCriteria = useMemo(() => {
    return solicitudes.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const matchId = String(s.id).includes(q) || `#${s.id}`.includes(q);
        const matchSolicitante = s.solicitanteNombre?.toLowerCase().includes(q);
        const matchProducto = s.productoNombre?.toLowerCase().includes(q) ?? false;
        const matchProveedor = s.proveedorNombre?.toLowerCase().includes(q) ?? false;
        const matchDetalle = s.detalle?.toLowerCase().includes(q) ?? false;
        const matchTipo = s.tipo?.toLowerCase().includes(q);
        const matchMonto = s.monto != null ? String(s.monto).includes(q) : false;
        if (!matchId && !matchSolicitante && !matchProducto && !matchProveedor && !matchDetalle && !matchTipo && !matchMonto) {
          return false;
        }
      }
      if (moduloFilter !== "TODOS" && s.origen !== moduloFilter) {
        return false;
      }
      if (tipoFilter !== "TODOS" && s.tipo !== tipoFilter) {
        return false;
      }
      return true;
    });
  }, [solicitudes, search, moduloFilter, tipoFilter]);

  const counts = useMemo(() => {
    return {
      TODAS: filteredByCriteria.length,
      PENDIENTE: filteredByCriteria.filter((s) => s.estado === "PENDIENTE").length,
      APROBADA: filteredByCriteria.filter((s) => s.estado === "APROBADA").length,
      RECHAZADA: filteredByCriteria.filter((s) => s.estado === "RECHAZADA").length,
      CANCELADA: filteredByCriteria.filter((s) => s.estado === "CANCELADA").length,
    };
  }, [filteredByCriteria]);

  const filtered = useMemo(() => {
    if (filter === "TODAS") return filteredByCriteria;
    return filteredByCriteria.filter((s) => s.estado === filter);
  }, [filteredByCriteria, filter]);

  const handleVer = (sol: SolicitudUnificada) => {
    setSelectedSolicitud(sol);
  };

  const handleCloseModal = () => {
    setSelectedSolicitud(null);
  };

  const mapToStockSolicitud = (sol: SolicitudUnificada) => ({
    id: sol.id,
    tipo: (sol.tipo === "Producto-Resta" ? "RESTA" : "REPOSICION") as
      | "RESTA"
      | "REPOSICION",
    cantidad: sol.cantidad ?? 0,
    stockAnterior: 0,
    motivo: sol.detalle,
    estado: sol.estado,
    createdAt: sol.fecha,
    producto: {
      id: 0,
      nombre: sol.productoNombre ?? "—",
      cantidad: sol.cantidad ?? 0,
    },
    solicitante: { id: sol.solicitanteId, nombreCompleto: sol.solicitanteNombre },
    origenTabla: sol.origenTabla,
  });

  const showActionsColumn = filter === "TODAS" || filter === "PENDIENTE";

  const tableColumns = useMemo(() => {
    if (showActionsColumn) {
      return [
        { label: "ID", className: "w-[5%] text-left" },
        { label: "ORIGEN", className: "w-[8%] text-left" },
        { label: "TIPO", className: "w-[14%] text-left" },
        { label: "PRODUCTO / DETALLE", className: "w-[26%] text-left" },
        { label: "SOLICITANTE", className: "w-[13%] text-left" },
        { label: "FECHA", className: "w-[10%] text-left" },
        { label: "ESTADO", className: "w-[10%] text-center" },
        { label: "ACCIONES", className: "w-[14%] text-center" },
      ];
    }
    return [
      { label: "ID", className: "w-[6%] text-left" },
      { label: "ORIGEN", className: "w-[9%] text-left" },
      { label: "TIPO", className: "w-[16%] text-left" },
      { label: "PRODUCTO / DETALLE", className: "w-[30%] text-left" },
      { label: "SOLICITANTE", className: "w-[15%] text-left" },
      { label: "FECHA", className: "w-[12%] text-left" },
      { label: "ESTADO", className: "w-[12%] text-center" },
    ];
  }, [showActionsColumn]);

  return (
    <div className="space-y-3.5 flex flex-col h-full min-h-0">
      {/* Top Bar: Centered Filters + Search */}
      <div className="shrink-0 flex items-end justify-center gap-3 bg-[var(--card)] p-3 min-h-[76px] rounded-2xl border border-[var(--border)] flex-wrap shadow-sm">
        {/* Estado tabs */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Estado
          </label>
          <div className="flex items-center justify-center gap-1 p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
            {ESTADO_TABS.map((tab) => {
              const count = counts[tab.key];
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1.5",
                    isActive
                      ? "bg-[var(--brand)] text-white shadow-sm"
                      : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.04]"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-[var(--text-muted)] bg-[var(--panel)]"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separator */}
        <div className="hidden xl:block w-px h-10 bg-[var(--border)]/70 mb-0.5" />

        {/* Search input */}
        <div className="flex flex-col gap-1 w-full sm:w-[400px] lg:w-[460px] xl:w-[500px] min-w-[340px]">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Búsqueda
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar solicitud, producto, usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 hover:border-[var(--border-hover)] transition-all shadow-[var(--shadow-sm)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-md transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Botón Limpiar */}
        {hasActiveFilters && (
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="h-[14px]" />
            <button
              type="button"
              onClick={handleClearFilters}
              className="group flex h-10 min-w-[110px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] py-2 px-3 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 hover:bg-[var(--brand)]/10 hover:text-white focus-visible:border-[var(--brand)] active:scale-[0.98]"
              title="Limpiar filtros"
            >
              <Eraser size={13} className="text-[var(--brand)]" />
              <span>Limpiar</span>
            </button>
          </div>
        )}

        {/* Separator */}
        <div className="hidden xl:block w-px h-10 bg-[var(--border)]/70 mb-0.5" />

        {/* Modulo Filter */}
        <ModuloFilterSelect value={moduloFilter} onValueChange={handleModuloChange} />

        {/* Tipo Filter */}
        <TipoFilterSelect
          value={tipoFilter}
          onValueChange={setTipoFilter}
          modulo={moduloFilter}
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm border-collapse min-w-[960px] table-auto">
          <thead>
            <tr className="bg-[#17191f]">
              {tableColumns.map((col) => (
                <th
                  key={col.label}
                  className={`sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] ${col.className}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-4 py-20 text-center text-[var(--text-muted)] text-sm"
                >
                  No hay solicitudes para mostrar en este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((sol) => {
                const isHighlighted = highlightedSolicitudId === sol.id;
                return (
                  <tr
                    key={`${sol.origen}-${sol.origenTabla || "tab"}-${sol.id}`}
                    id={`solicitud-row-${sol.id}`}
                    className={cn(
                      "border-b border-[var(--border)]/40 transition-colors duration-200 cursor-pointer relative",
                      isHighlighted
                        ? "bg-amber-500/[0.12] ring-2 ring-inset ring-amber-500/50 hover:bg-amber-500/[0.18]"
                        : "hover:bg-white/[0.02]"
                    )}
                    onClick={() => {
                      if (isHighlighted) {
                        setHighlightedSolicitudId(null);
                      }
                      handleVer(sol);
                    }}
                  >
                    {/* ID */}
                    <td className="relative px-4 py-3.5 font-mono text-xs font-bold text-[var(--text-muted)]">
                      {isHighlighted && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-r-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                      )}
                      #{sol.id}
                    </td>

                    {/* Origen badge */}
                    <td className="px-4 py-3.5">{origenBadge(sol.origen)}</td>

                  {/* Tipo */}
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-bold text-[var(--text)]">
                      {sol.tipo}
                    </span>
                  </td>

                  {/* Detalle / Producto */}
                  <td className="px-4 py-3.5">
                    {sol.productoNombre ? (
                      <div className="min-w-0 max-w-[280px]">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--text)] text-xs truncate">
                          <span className="truncate">{sol.productoNombre}</span>
                          {sol.cantidad != null && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-black bg-[var(--panel)] border border-[var(--border)] text-[var(--text-secondary)]">
                              x{sol.cantidad}
                            </span>
                          )}
                        </div>
                        {sol.proveedorNombre && (
                          <span className="text-[11px] text-[var(--text-muted)] block truncate">
                            Proveedor: {sol.proveedorNombre}
                          </span>
                        )}
                        {sol.detalle && (
                          <span className="text-[11px] text-[var(--text-secondary)] block truncate">
                            {sol.detalle}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0 max-w-[280px]">
                        <span className="text-xs font-semibold text-[var(--text)] block truncate">
                          {sol.detalle || "—"}
                        </span>
                        {sol.monto != null && (
                          <span className="text-[11px] font-bold text-[#A78BFA] block">
                            Monto: ${sol.monto.toLocaleString("es-AR")}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Solicitante */}
                  <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)] truncate max-w-[130px]">
                    <span className="font-medium text-[var(--text)] block truncate">
                      {sol.solicitanteNombre}
                    </span>
                    {sol.solicitanteId === userId && (
                      <span className="inline-block mt-0.5 text-[10px] font-bold text-[#34D399]">
                        (Tú)
                      </span>
                    )}
                  </td>

                  {/* Fecha */}
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap leading-tight">
                      <span className="text-[var(--text)] block font-medium">
                        {formatDateOnly(sol.fecha)}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatTimeOnly(sol.fecha)}
                      </span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5 text-center">
                    {estadoBadge(sol.estado)}
                  </td>

                  {/* Acciones */}
                  {showActionsColumn && (
                    <td
                      className="px-4 py-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {sol.estado === "PENDIENTE" && userRole === "ADMINISTRADOR" && (
                          <>
                            <button
                              type="button"
                              disabled={actionPendingId === sol.id}
                              onClick={(e) => handleQuickApprove(e, sol)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/60 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                              title="Aprobar solicitud"
                            >
                              {actionPendingId === sol.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={13} strokeWidth={2.5} />
                              )}
                              <span>Aprobar</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionPendingId === sol.id}
                              onClick={(e) => handleOpenRejectModal(e, sol)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/60 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                              title="Rechazar solicitud"
                            >
                              <X size={13} strokeWidth={2.5} />
                              <span>Rechazar</span>
                            </button>
                          </>
                        )}

                        {sol.estado === "PENDIENTE" && sol.solicitanteId === userId && userRole !== "ADMINISTRADOR" && (
                          <button
                            type="button"
                            disabled={actionPendingId === sol.id}
                            onClick={(e) => handleOpenCancelModal(e, sol)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/60 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            title="Cancelar mi solicitud"
                          >
                            {actionPendingId === sol.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Ban size={12} strokeWidth={2.2} />
                            )}
                            <span>Cancelar</span>
                          </button>
                        )}

                        {sol.estado !== "PENDIENTE" && (
                          <span className="text-xs text-[var(--text-muted)] font-mono">—</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      {/* Modal: PRODUCTOS → SolicitudStockDetail */}
      {selectedSolicitud && selectedSolicitud.origen === "PRODUCTOS" && (
        <SolicitudStockDetail
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCloseModal();
          }}
          solicitud={mapToStockSolicitud(selectedSolicitud)}
          currentUserId={userId}
          userRole={userRole}
          onSuccess={() => {
            handleCloseModal();
            router.refresh();
          }}
        />
      )}

      {/* Modal: CAJA → CajaDetailModal */}
      {selectedSolicitud && selectedSolicitud.origen === "CAJA" && (
        <CajaDetailModal
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCloseModal();
          }}
          solicitud={selectedSolicitud}
          userRole={userRole}
          currentUserId={userId}
          onSuccess={() => {
            handleCloseModal();
            router.refresh();
          }}
        />
      )}

      {/* Modal: Confirmación de Rechazo */}
      {rejectModalSolicitud && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-50"
          onClick={() => setRejectModalSolicitud(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">
                  Rechazar Solicitud #{rejectModalSolicitud.id}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {rejectModalSolicitud.tipo} — {rejectModalSolicitud.solicitanteNombre}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Motivo del rechazo <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explicá la razón por la cual se rechaza este pedido..."
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalSolicitud(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--panel)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || actionPendingId === rejectModalSolicitud.id}
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {actionPendingId === rejectModalSolicitud.id && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Cancelación para Empleado */}
      {cancelModalSolicitud && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-50"
          onClick={() => setCancelModalSolicitud(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20">
                <Ban size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">
                  ¿Cancelar tu solicitud #{cancelModalSolicitud.id}?
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {cancelModalSolicitud.tipo} — {cancelModalSolicitud.detalle || cancelModalSolicitud.productoNombre}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Esta acción dará de baja la solicitud y no podrá volver a abrirse. ¿Estás seguro de continuar?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalSolicitud(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--panel)] transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={actionPendingId === cancelModalSolicitud.id}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {actionPendingId === cancelModalSolicitud.id && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                <span>Sí, Cancelar Solicitud</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
