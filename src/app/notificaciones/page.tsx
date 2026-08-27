"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle,
  XCircle,
  CheckCheck,
  Check,
  Loader2,
  AlertTriangle,
  PackageX,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  X,
  Inbox,
  Eraser,
  Settings,
  ShoppingCart,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  getNotificacionesPaginadas,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  verificarStockAlertas,
} from "@/actions/solicitudes-stock";
import PreferenciasNotificacionModal from "@/components/ui/PreferenciasNotificacionModal";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

/* ────────────────────── Types ────────────────────── */

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: Date | string;
  entidad?: string | null;
  solicitudStockId?: number | null;
  solicitudReposicionId?: number | null;
  solicitudCajaId?: number | null;
  productoId?: number | null;
  solicitudStock?: {
    id: number;
    tipo: string;
    cantidad: number;
    estado: string;
    producto: { nombre: string };
  } | null;
  solicitudReposicion?: {
    id: number;
    cantidad: number;
    estado: string;
    producto: { nombre: string };
  } | null;
}

interface TipoOption {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface TipoGroup {
  group: string;
  options: TipoOption[];
}

const TIPO_GROUPS: TipoGroup[] = [
  {
    group: "GENERAL",
    options: [
      { value: "TODOS", label: "Todos los tipos", icon: Filter },
    ],
  },
  {
    group: "SOLICITUDES",
    options: [
      { value: "SOLICITUD_CREADA", label: "Solicitudes creadas", icon: Bell },
      { value: "SOLICITUD_APROBADA", label: "Solicitudes aprobadas", icon: CheckCircle },
      { value: "SOLICITUD_RECHAZADA", label: "Solicitudes rechazadas", icon: XCircle },
      { value: "SOLICITUD_CANCELADA", label: "Solicitudes canceladas", icon: XCircle },
    ],
  },
  {
    group: "STOCK",
    options: [
      { value: "STOCK_CRITICO", label: "Stock crítico", icon: AlertTriangle },
      { value: "STOCK_AGOTADO", label: "Stock agotado", icon: PackageX },
      { value: "STOCK_RESTADO", label: "Stock reducido", icon: TrendingDown },
      { value: "STOCK_RECARGADO", label: "Stock recargado", icon: TrendingUp },
    ],
  },
  {
    group: "VENTAS",
    options: [
      { value: "VENTA_CREADA", label: "Ventas realizadas", icon: ShoppingCart },
    ],
  },
];

const TIPO_OPTIONS = TIPO_GROUPS.flatMap((g) =>
  g.options.map((opt) => ({
    value: opt.value === "TODOS" ? "" : opt.value,
    label: opt.label,
  }))
);

/* ────────────────────── Component: TipoNotificacionSelect ────────────────────── */

function TipoNotificacionSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const currentValue = value || "TODOS";
  const allOptions = TIPO_GROUPS.flatMap((g) => g.options);
  const selectedOption = allOptions.find((o) => o.value === currentValue) ?? allOptions[0];
  const IconComponent = selectedOption.icon;

  return (
    <SelectPrimitive.Root
      value={currentValue}
      onValueChange={(val) => onValueChange(val === "TODOS" ? "" : val)}
    >
      <SelectPrimitive.Trigger
        className="group flex h-10 min-w-[190px] max-w-[240px] items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--brand)] transition-all"
        title="Filtrar por tipo de notificación"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--panel)] text-[var(--brand)] ring-1 ring-[var(--border)]">
            <IconComponent size={12} />
          </span>
          <span className="truncate">{selectedOption.label}</span>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[230px] max-h-[340px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl animate-in fade-in-80"
        >
          <SelectPrimitive.Viewport className="space-y-1">
            {TIPO_GROUPS.map((group, groupIdx) => (
              <React.Fragment key={group.group}>
                {groupIdx > 0 && <div className="my-1 border-t border-[var(--border)]/60" />}
                <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {group.group}
                </div>
                {group.options.map((option) => {
                  const OptionIcon = option.icon;
                  const isSelected = option.value === currentValue;
                  return (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      className={`relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold outline-none transition-colors ${
                        isSelected
                          ? "bg-[var(--brand)]/10 text-[var(--brand)] font-bold"
                          : "text-[var(--text)] hover:bg-[var(--panel)]"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--panel)] text-[var(--text-secondary)]">
                          <OptionIcon size={12} />
                        </span>
                        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      </span>
                      <SelectPrimitive.ItemIndicator>
                        <Check size={14} className="shrink-0 text-[var(--brand)]" />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  );
                })}
              </React.Fragment>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ────────────────────── Helpers ────────────────────── */

function tipoIcon(tipo: string) {
  switch (tipo) {
    case "SOLICITUD_CREADA":
      return <Bell size={16} className="text-[var(--info)]" />;
    case "SOLICITUD_APROBADA":
      return <CheckCircle size={16} className="text-[var(--success)]" />;
    case "SOLICITUD_RECHAZADA":
      return <XCircle size={16} className="text-[var(--danger)]" />;
    case "SOLICITUD_CANCELADA":
      return <XCircle size={16} className="text-[var(--text-muted)]" />;
    case "STOCK_CRITICO":
      return <AlertTriangle size={16} className="text-yellow-500" />;
    case "STOCK_AGOTADO":
      return <PackageX size={16} className="text-[var(--danger)]" />;
    case "STOCK_RESTADO":
      return <TrendingDown size={16} className="text-orange-500" />;
    case "STOCK_RECARGADO":
      return <TrendingUp size={16} className="text-[var(--success)]" />;
    case "VENTA_CREADA":
      return <ShoppingCart size={16} className="text-blue-500" />;
    default:
      return <Bell size={16} className="text-[var(--text-muted)]" />;
  }
}

function tipoBadgeColor(tipo: string) {
  switch (tipo) {
    case "SOLICITUD_CREADA":
      return "bg-[var(--info)]/10 text-[var(--info)] ring-1 ring-[var(--info)]/20";
    case "SOLICITUD_APROBADA":
      return "bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-[var(--success)]/20";
    case "SOLICITUD_RECHAZADA":
      return "bg-[var(--danger)]/10 text-[var(--danger)] ring-1 ring-[var(--danger)]/20";
    case "STOCK_CRITICO":
      return "bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/20";
    case "STOCK_AGOTADO":
      return "bg-[var(--danger)]/10 text-[var(--danger)] ring-1 ring-[var(--danger)]/20";
    case "STOCK_RESTADO":
      return "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20";
    case "STOCK_RECARGADO":
      return "bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-[var(--success)]/20";
    case "VENTA_CREADA":
      return "bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20";
    default:
      return "bg-[var(--text-muted)]/10 text-[var(--text-muted)] ring-1 ring-[var(--text-muted)]/20";
  }
}

function tipoLabel(tipo: string) {
  const opt = TIPO_OPTIONS.find((o) => o.value === tipo);
  return opt?.label ?? tipo;
}

function timeAgo(date: Date | string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

function absoluteDate(date: Date | string) {
  try {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return "";
  }
}

function buildHref(noti: Notificacion): string | null {
  const solicitudId = noti.solicitudStockId || noti.solicitudReposicionId || noti.solicitudCajaId;

  switch (noti.tipo) {
    case "SOLICITUD_CREADA":
      return solicitudId
        ? `/solicitudes?estado=PENDIENTE&solicitudId=${solicitudId}`
        : "/solicitudes?estado=PENDIENTE";
    case "SOLICITUD_APROBADA":
      return solicitudId
        ? `/solicitudes?estado=APROBADA&solicitudId=${solicitudId}`
        : "/solicitudes?estado=APROBADA";
    case "SOLICITUD_RECHAZADA":
      return solicitudId
        ? `/solicitudes?estado=RECHAZADA&solicitudId=${solicitudId}`
        : "/solicitudes?estado=RECHAZADA";
    case "SOLICITUD_CANCELADA":
      return solicitudId
        ? `/solicitudes?estado=CANCELADA&solicitudId=${solicitudId}`
        : "/solicitudes?estado=CANCELADA";
    case "STOCK_CRITICO":
      return noti.productoId
        ? `/productos?stock=critico&productoId=${noti.productoId}`
        : "/productos?stock=critico";
    case "STOCK_AGOTADO":
      return noti.productoId
        ? `/productos?stock=sin_stock&productoId=${noti.productoId}`
        : "/productos?stock=sin_stock";
    case "STOCK_RESTADO":
    case "STOCK_RECARGADO":
      return noti.productoId ? `/productos?highlight=${noti.productoId}` : "/productos";
    case "VENTA_CREADA": {
      const match = noti.mensaje.match(/Venta\s+N[°º]?\s*(\d+)/i);
      const ventaId = match ? match[1] : null;
      return ventaId ? `/caja?ventaId=${ventaId}` : "/caja";
    }
    default:
      if (
        solicitudId ||
        noti.entidad === "solicitud_stock" ||
        noti.entidad === "reposicion" ||
        noti.entidad === "solicitud_caja"
      ) {
        return solicitudId ? `/solicitudes?solicitudId=${solicitudId}` : "/solicitudes";
      }
      if (noti.productoId || noti.entidad === "stock") {
        return noti.productoId ? `/productos?highlight=${noti.productoId}` : "/productos";
      }
      if (noti.entidad === "venta") {
        return "/ventas";
      }
      return null;
  }
}

/* ────────────────────── Component ────────────────────── */

export default function NotificacionesPage() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [noLeidas, setNoLeidas] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [markingAll, startMarkAllTransition] = useTransition();
  const [markingSelected, startMarkSelectedTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefModalOpen, setPrefModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await verificarStockAlertas();
        const res = await getNotificacionesPaginadas({
          busqueda: busqueda || undefined,
          tipo: tipoFilter || undefined,
          soloNoLeidas,
          page,
          pageSize: 20,
        });
        if (!cancelled && !("error" in res)) {
          setNotificaciones(res.data as Notificacion[]);
          setTotal(res.total);
          setNoLeidas(res.noLeidas);
          setTotalPages(Math.max(1, Math.ceil(res.total / 20)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busqueda, tipoFilter, soloNoLeidas, page, refreshKey]);

  const handleMarkRead = async (id: number) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    setNoLeidas((prev) => Math.max(0, prev - 1));

    const res = await marcarNotificacionLeida(id);
    if ("error" in res) {
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: false } : n))
      );
      setNoLeidas((prev) => prev + 1);
    }
  };

  const handleMarkAllRead = () => {
    if (noLeidas === 0) return;
    startMarkAllTransition(async () => {
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
      const res = await marcarTodasLeidas();
      if ("error" in res) {
        setRefreshKey((k) => k + 1);
      }
    });
  };

  const handleMarkSelectedRead = () => {
    if (selectedIds.size === 0) return;
    startMarkSelectedTransition(async () => {
      const ids = Array.from(selectedIds);
      setNotificaciones((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n))
      );
      setNoLeidas((prev) => Math.max(0, prev - ids.length));
      setSelectedIds(new Set());
      for (const id of ids) {
        await marcarNotificacionLeida(id);
      }
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notificaciones.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notificaciones.map((n) => n.id)));
    }
  };

  const handleClearFilters = () => {
    setBusqueda("");
    setTipoFilter("");
    setSoloNoLeidas(false);
  };

  const hasActiveFilters = busqueda !== "" || tipoFilter !== "" || soloNoLeidas;

  const handleNavigate = (noti: Notificacion) => {
    // Mark as read on click if unread
    if (!noti.leida) {
      handleMarkRead(noti.id);
    }
    const href = buildHref(noti);
    if (href) router.push(href);
  };

  return (
    <div className="fixed inset-0 top-[5.5rem] bg-[var(--bg)] flex flex-col overflow-hidden z-10">
      <div className="flex-1 flex flex-col min-h-0 p-2 lg:p-3">
        {/* Header */}
        <div className="flex flex-col items-center justify-center shrink-0 mb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <Bell size={24} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
              Notificaciones
            </h1>
            <button
              onClick={() => setPrefModalOpen(true)}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]/40 transition-all"
              title="Preferencias de notificación"
            >
              <Settings size={18} />
            </button>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {noLeidas > 0
              ? `Tenés ${noLeidas} notificación${noLeidas !== 1 ? "es" : ""} sin leer`
              : "No tenés notificaciones sin leer"}
          </p>
        </div>

        {/* Toolbar */}
        <div className="shrink-0 flex items-end justify-between gap-3 bg-[var(--card)] p-3 rounded-2xl border border-[var(--border)] shadow-sm flex-wrap mb-3">
          {/* Left: Search & Filter Type */}
          <div className="flex items-end gap-2.5 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Búsqueda
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar notificaciones..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full h-10 pl-9 pr-9 text-xs font-medium bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] hover:border-[var(--border-hover)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 transition-all shadow-[var(--shadow-sm)]"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Tipo Filter (Grouped Radix Dropdown) */}
            <div className="flex flex-col gap-1 min-w-[190px] max-w-[240px]">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Tipo
              </label>
              <TipoNotificacionSelect
                value={tipoFilter}
                onValueChange={setTipoFilter}
              />
            </div>

            {/* Clear Filters button */}
            {hasActiveFilters && (
              <div className="flex flex-col gap-1">
                <span aria-hidden="true" className="h-[14px]" />
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-1.5 h-10 px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10 rounded-xl transition-all shadow-[var(--shadow-sm)] shrink-0"
                  title="Limpiar todos los filtros"
                >
                  <Eraser size={13} className="text-[var(--brand)]" />
                  <span>Limpiar</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Toggle "Sin leer" & Action "Marcar leído" */}
          <div className="flex items-end gap-2.5 shrink-0">
            {/* No leídas toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Estado
              </label>
              <button
                type="button"
                onClick={() => setSoloNoLeidas((prev) => !prev)}
                title={soloNoLeidas ? "Mostrar todas las notificaciones" : "Mostrar solo notificaciones sin leer"}
                className={`flex items-center gap-2 h-10 px-3.5 text-xs font-bold rounded-xl transition-all shadow-[var(--shadow-sm)] active:scale-[0.98] ${
                  soloNoLeidas
                    ? "bg-[#047857] hover:bg-[#065F46] text-white shadow-sm"
                    : "bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-hover)]"
                }`}
              >
                <Bell size={14} className={soloNoLeidas ? "fill-current" : ""} />
                <span>Sin leer</span>
                {noLeidas > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      soloNoLeidas
                        ? "bg-white/20 text-white"
                        : "bg-[var(--panel)] text-[var(--text-muted)] border border-[var(--border)]"
                    }`}
                  >
                    {noLeidas}
                  </span>
                )}
              </button>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-10 bg-[var(--border)]/70 mb-0.5" />

            {/* Unified Action Button */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Acción
              </label>
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkSelectedRead}
                  disabled={markingSelected}
                  title={`Marcar las ${selectedIds.size} notificaciones seleccionadas como leídas`}
                  className="flex items-center gap-2 h-10 px-3.5 text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand)]/90 rounded-xl transition-all shadow-[var(--shadow-sm)] active:scale-[0.98]"
                >
                  {markingSelected ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCheck size={14} />
                  )}
                  <span>Marcar seleccionadas ({selectedIds.size})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || noLeidas === 0}
                  title="Marcar todas las notificaciones pendientes como leídas"
                  className="flex items-center gap-2 h-10 px-3.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[var(--shadow-sm)] active:scale-[0.98]"
                >
                  {markingAll ? (
                    <Loader2 size={14} className="animate-spin text-[var(--brand)]" />
                  ) : (
                    <CheckCheck size={14} className={noLeidas > 0 ? "text-[var(--brand)]" : ""} />
                  )}
                  <span>Marcar todo leído</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 bg-[var(--card)] border border-[var(--border)]/60 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Inbox size={40} className="text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">
                No se encontraron notificaciones
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto h-full min-h-0">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[#17191f] sticky top-0 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                <input
                  type="checkbox"
                  checked={selectedIds.size === notificaciones.length && notificaciones.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]/40 cursor-pointer"
                />
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} seleccionada${selectedIds.size !== 1 ? "s" : ""}`
                    : `${total} notificación${total !== 1 ? "es" : ""}`}
                </span>
              </div>

              {/* Rows */}
              {notificaciones.map((noti) => {
                const href = buildHref(noti);
                const isUnread = !noti.leida;
                return (
                  <div
                    key={noti.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("input, button")) return;
                      handleNavigate(noti);
                    }}
                    className={`group relative flex items-start gap-3.5 px-5 py-4 border-b border-[var(--border)]/25 transition-all duration-150 ${
                      href ? "cursor-pointer" : ""
                    } ${
                      isUnread
                        ? "bg-[#1E2129]/60 hover:bg-white/[0.04]"
                        : "opacity-60 hover:opacity-85 hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Unread indicator bar */}
                    {isUnread && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-[var(--brand)] shadow-[0_0_8px_rgba(214,40,40,0.5)]" />
                    )}

                    <input
                      type="checkbox"
                      checked={selectedIds.has(noti.id)}
                      onChange={() => toggleSelect(noti.id)}
                      className="w-4 h-4 mt-1 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]/40 cursor-pointer shrink-0"
                    />
                    <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-[var(--panel)] border border-[var(--border)]/60 flex items-center justify-center">
                      {tipoIcon(noti.tipo)}
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${tipoBadgeColor(
                            noti.tipo
                          )}`}
                        >
                          {tipoLabel(noti.tipo)}
                        </span>
                        {isUnread && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_rgba(214,40,40,0.8)]" />
                        )}
                        <span
                          className="text-[11px] text-[var(--text-muted)] ml-auto"
                          title={absoluteDate(noti.createdAt)}
                        >
                          {timeAgo(noti.createdAt)}
                        </span>
                      </div>
                      <p className={`text-sm mt-1.5 leading-relaxed ${isUnread ? "text-[var(--text)] font-medium" : "text-[var(--text-secondary)]"}`}>
                        {noti.mensaje}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                      {isUnread && (
                        <button
                          onClick={() => handleMarkRead(noti.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--success)]/10 border border-[var(--border)]/60 hover:border-[var(--success)]/30 transition-all"
                          title="Marcar como leída"
                        >
                          <CheckCircle size={13} />
                          Leído
                        </button>
                      )}
                      {href && (
                        <button
                          onClick={() => handleNavigate(noti)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] shadow-[0_2px_8px_rgba(214,40,40,0.25)] hover:shadow-[0_2px_12px_rgba(214,40,40,0.4)] active:scale-95 transition-all"
                          title="Ver en inventario"
                        >
                          <ExternalLink size={13} />
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between shrink-0 mt-3">
            <p className="text-xs text-[var(--text-muted)]">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)]/60 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      p === page
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--card)] border border-[var(--border)]/60 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/80"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)]/60 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preferences modal */}
      <PreferenciasNotificacionModal
        open={prefModalOpen}
        onOpenChange={setPrefModalOpen}
      />
    </div>
  );
}
