"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle,
  XCircle,
  CheckCheck,
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

/* ────────────────────── Constants ────────────────────── */

const TIPO_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "SOLICITUD_CREADA", label: "Solicitudes creadas" },
  { value: "SOLICITUD_APROBADA", label: "Solicitudes aprobadas" },
  { value: "SOLICITUD_RECHAZADA", label: "Solicitudes rechazadas" },
  { value: "SOLICITUD_CANCELADA", label: "Solicitudes canceladas" },
  { value: "STOCK_CRITICO", label: "Stock crítico" },
  { value: "STOCK_AGOTADO", label: "Stock agotado" },
  { value: "STOCK_RESTADO", label: "Stock reducido" },
  { value: "STOCK_RECARGADO", label: "Stock recargado" },
  { value: "VENTA_CREADA", label: "Ventas realizadas" },
];

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
  switch (noti.tipo) {
    case "SOLICITUD_CREADA":
    case "SOLICITUD_APROBADA":
    case "SOLICITUD_RECHAZADA":
    case "SOLICITUD_CANCELADA":
      return "/pedidos?tab=solicitudes-stock";
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
    case "VENTA_CREADA":
      return "/ventas";
    default:
      if (
        noti.solicitudStockId ||
        noti.solicitudReposicionId ||
        noti.entidad === "solicitud_stock" ||
        noti.entidad === "reposicion"
      ) {
        return "/pedidos?tab=solicitudes-stock";
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
  const [prefModalOpen, setPrefModalOpen] = useState(false);

  const fetchNotificaciones = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure stock alerts exist for current stock levels
      await verificarStockAlertas();
      const res = await getNotificacionesPaginadas({
        busqueda: busqueda || undefined,
        tipo: tipoFilter || undefined,
        soloNoLeidas,
        page,
        pageSize: 20,
      });
      if (!("error" in res)) {
        setNotificaciones(res.data as Notificacion[]);
        setTotal(res.total);
        setNoLeidas(res.noLeidas);
        setTotalPages(Math.max(1, Math.ceil(res.total / 20)));
      }
    } finally {
      setLoading(false);
    }
  }, [busqueda, tipoFilter, soloNoLeidas, page]);

  useEffect(() => {
    fetchNotificaciones();
  }, [fetchNotificaciones]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [busqueda, tipoFilter, soloNoLeidas]);

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
        fetchNotificaciones();
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]/60 rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]/60 transition-all"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--border)]/40 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Tipo filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]/60 rounded-xl text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]/60 transition-all appearance-none cursor-pointer"
            >
              {TIPO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          {/* No leídas toggle */}
          <button
            onClick={() => setSoloNoLeidas((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border transition-all ${
              soloNoLeidas
                ? "bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/30 ring-1 ring-[var(--brand)]/20"
                : "bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)]/60 hover:border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <Bell size={14} />
            Sin leer
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--bg)] border border-[var(--border)]/60 hover:border-[var(--border)] rounded-xl transition-all"
            >
              <Eraser size={14} />
              Limpiar
            </button>
          )}

          {/* Separator */}
          <div className="hidden sm:block w-px h-6 bg-[var(--border)]/40" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleMarkSelectedRead}
                disabled={markingSelected}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--brand)] bg-[var(--brand)]/10 hover:bg-[var(--brand)]/20 rounded-xl border border-[var(--brand)]/30 transition-all"
              >
                {markingSelected ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Marcar ({selectedIds.size})
              </button>
            )}
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || noLeidas === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--bg)] border border-[var(--border)]/60 hover:border-[var(--border)] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {markingAll ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCheck size={14} />
              )}
              Marcar todo leído
            </button>
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
