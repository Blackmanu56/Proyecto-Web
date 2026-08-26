"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
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
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import {
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  verificarStockAlertas,
} from "@/actions/solicitudes-stock";
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

interface NotificationPanelProps {
  onClose: () => void;
  onCountChange: (updater: (prev: number) => number) => void;
}

/* ────────────────────── Helpers ────────────────────── */

function tipoConfig(tipo: string) {
  switch (tipo) {
    case "SOLICITUD_CREADA":
      return {
        icon: <Bell size={15} />,
        color: "text-[var(--info)]",
        bg: "bg-[var(--info)]/10",
        ring: "ring-[var(--info)]/20",
        dot: "bg-[var(--info)]",
      };
    case "SOLICITUD_APROBADA":
      return {
        icon: <CheckCircle size={15} />,
        color: "text-[var(--success)]",
        bg: "bg-[var(--success)]/10",
        ring: "ring-[var(--success)]/20",
        dot: "bg-[var(--success)]",
      };
    case "SOLICITUD_RECHAZADA":
      return {
        icon: <XCircle size={15} />,
        color: "text-[var(--danger)]",
        bg: "bg-[var(--danger)]/10",
        ring: "ring-[var(--danger)]/20",
        dot: "bg-[var(--danger)]",
      };
    case "SOLICITUD_CANCELADA":
      return {
        icon: <XCircle size={15} />,
        color: "text-[var(--text-muted)]",
        bg: "bg-[var(--text-muted)]/10",
        ring: "ring-[var(--text-muted)]/20",
        dot: "bg-[var(--text-muted)]",
      };
    case "STOCK_CRITICO":
      return {
        icon: <AlertTriangle size={15} />,
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
        ring: "ring-yellow-500/20",
        dot: "bg-yellow-500",
      };
    case "STOCK_AGOTADO":
      return {
        icon: <PackageX size={15} />,
        color: "text-[var(--danger)]",
        bg: "bg-[var(--danger)]/10",
        ring: "ring-[var(--danger)]/20",
        dot: "bg-[var(--danger)]",
      };
    case "STOCK_RESTADO":
      return {
        icon: <TrendingDown size={15} />,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        ring: "ring-orange-500/20",
        dot: "bg-orange-500",
      };
    case "STOCK_RECARGADO":
      return {
        icon: <TrendingUp size={15} />,
        color: "text-[var(--success)]",
        bg: "bg-[var(--success)]/10",
        ring: "ring-[var(--success)]/20",
        dot: "bg-[var(--success)]",
      };
    case "VENTA_CREADA":
      return {
        icon: <ShoppingCart size={15} />,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        ring: "ring-blue-500/20",
        dot: "bg-blue-500",
      };
    default:
      return {
        icon: <Bell size={15} />,
        color: "text-[var(--text-muted)]",
        bg: "bg-[var(--text-muted)]/10",
        ring: "ring-[var(--text-muted)]/20",
        dot: "bg-[var(--text-muted)]",
      };
  }
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

export default function NotificationPanel({
  onClose,
  onCountChange,
}: NotificationPanelProps) {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, startMarkAllTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // First, ensure stock alerts exist for current stock levels
        await verificarStockAlertas();
        // Then fetch all notifications
        const res = await getNotificaciones();
        if (!cancelled && !("error" in res)) {
          setNotificaciones(res.notificaciones as Notificacion[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { nuevas, leidas } = useMemo(() => {
    const unread: Notificacion[] = [];
    const read: Notificacion[] = [];
    for (const n of notificaciones) {
      if (n.leida) read.push(n);
      else unread.push(n);
    }
    return { nuevas: unread, leidas: read };
  }, [notificaciones]);

  // Panel only shows unread notifications — read ones are history in /notificaciones
  const displayNotificaciones = nuevas;

  const handleMarkRead = async (id: number) => {
    const noti = notificaciones.find((n) => n.id === id);
    if (!noti || noti.leida) return;

    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    onCountChange((prev) => Math.max(0, prev - 1));

    try {
      const res = await marcarNotificacionLeida(id);
      if ("error" in res) {
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === id ? { ...n, leida: false } : n))
        );
        onCountChange((prev) => prev + 1);
      }
    } catch {
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: false } : n))
      );
      onCountChange((prev) => prev + 1);
    }
  };

  const handleMarkAllRead = () => {
    if (nuevas.length === 0) return;

    startMarkAllTransition(async () => {
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      onCountChange(() => 0);

      try {
        const res = await marcarTodasLeidas();
        if ("error" in res) {
          setNotificaciones((prev) =>
            prev.map((n) => ({ ...n, leida: false }))
          );
          onCountChange(() => nuevas.length);
        }
      } catch {
        setNotificaciones((prev) =>
          prev.map((n) => ({ ...n, leida: false }))
        );
        onCountChange(() => nuevas.length);
      }
    });
  };

  const handleNavigate = (noti: Notificacion) => {
    const href = buildHref(noti);
    if (!noti.leida) {
      handleMarkRead(noti.id);
    }
    if (href) {
      onClose();
      router.push(href);
    }
  };

  const renderNoti = (noti: Notificacion) => {
    const config = tipoConfig(noti.tipo);
    const href = buildHref(noti);
    const canView = href !== null;

    return (
      <div
        key={noti.id}
        className={`group relative flex items-start gap-3 px-4 py-3 transition-all duration-150 cursor-pointer border-b border-[var(--border)]/15 ${
          noti.leida
            ? "opacity-55 hover:opacity-75"
            : "hover:bg-white/[0.03]"
        }`}
        onClick={() => handleNavigate(noti)}
      >
        {/* Unread indicator */}
        {!noti.leida && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-[var(--brand)] shadow-[0_0_8px_rgba(214,40,40,0.5)]" />
        )}

        {/* Icon */}
        <div
          className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg ${config.bg} ring-1 ${config.ring} flex items-center justify-center ${config.color}`}
        >
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`text-[13px] leading-tight truncate ${
                noti.leida
                  ? "font-medium text-[var(--text-secondary)]"
                  : "font-semibold text-[var(--text)]"
              }`}
            >
              {noti.titulo}
            </p>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]/80 mt-1 line-clamp-2 leading-relaxed">
            {noti.mensaje}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <p
              className="text-[10px] text-[var(--text-muted)]"
              title={absoluteDate(noti.createdAt)}
            >
              {timeAgo(noti.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1.5 mt-2">
          {!noti.leida && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkRead(noti.id);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--success)]/10 transition-all duration-150"
            >
              <CheckCircle size={13} />
              Leído
            </button>
          )}
          {canView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate(noti);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] shadow-[0_2px_6px_rgba(214,40,40,0.3)] transition-all duration-150 active:scale-95"
            >
              <ExternalLink size={12} />
              Ver
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-[var(--panel)] border border-[var(--border)]/50 rounded-2xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]/30">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold text-[var(--text)] tracking-tight">
            Notificaciones
          </h3>
          {nuevas.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brand)] text-white text-[10px] font-bold leading-none">
              {nuevas.length}
            </span>
          )}
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={markingAll || nuevas.length === 0}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {markingAll ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <CheckCheck size={11} />
          )}
          Marcar todo leído
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : displayNotificaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--text-muted)]/5 flex items-center justify-center mb-3">
              <Bell size={22} className="text-[var(--text-muted)] opacity-40" />
            </div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Todo al día
            </p>
            <p className="text-[11px] text-[var(--text-muted)]/60 mt-1">
              No tenés notificaciones nuevas
            </p>
          </div>
        ) : (
          <div>
            {displayNotificaciones.map(renderNoti)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--border)]/30">
        <button
          onClick={() => {
            onClose();
            router.push("/notificaciones");
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-[var(--brand)] hover:text-[var(--text)] bg-[var(--brand)]/5 hover:bg-[var(--brand)]/10 rounded-xl transition-all duration-150"
        >
          Ver todas las notificaciones
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
