"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Bell,
  CheckCircle,
  XCircle,
  CheckCheck,
  Loader2,
} from "lucide-react";
import {
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "@/actions/solicitudes-stock";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

/* ────────────────────── Types ────────────────────── */

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: Date | string;
}

interface NotificationPanelProps {
  onClose: () => void;
  onCountChange: (updater: (prev: number) => number) => void;
}

/* ────────────────────── Helpers ────────────────────── */

function tipoIcon(tipo: string) {
  switch (tipo) {
    case "SOLICITUD_CREADA":
      return <Bell size={14} className="text-[var(--info)]" />;
    case "SOLICITUD_APROBADA":
      return <CheckCircle size={14} className="text-[var(--success)]" />;
    case "SOLICITUD_RECHAZADA":
      return <XCircle size={14} className="text-[var(--danger)]" />;
    default:
      return <Bell size={14} className="text-[var(--text-muted)]" />;
  }
}

function timeAgo(date: Date | string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

/* ────────────────────── Component ────────────────────── */

export default function NotificationPanel({
  onClose,
  onCountChange,
}: NotificationPanelProps) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, startMarkAllTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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

  const handleMarkRead = async (id: number) => {
    const noti = notificaciones.find((n) => n.id === id);
    if (!noti || noti.leida) return;

    // Optimistic update
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    onCountChange((prev) => Math.max(0, prev - 1));

    try {
      const res = await marcarNotificacionLeida(id);
      if ("error" in res) {
        // Revert on failure
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
    const unreadCount = notificaciones.filter((n) => !n.leida).length;
    if (unreadCount === 0) return;

    startMarkAllTransition(async () => {
      // Optimistic
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      onCountChange(() => 0);

      try {
        const res = await marcarTodasLeidas();
        if ("error" in res) {
          // Revert
          setNotificaciones((prev) =>
            prev.map((n) => ({ ...n, leida: false }))
          );
          onCountChange(() => unreadCount);
        }
      } catch {
        setNotificaciones((prev) =>
          prev.map((n) => ({ ...n, leida: false }))
        );
        onCountChange(() => unreadCount);
      }
    });
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-[var(--panel)] border border-[var(--border)]/60 rounded-[var(--radius-xl)] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]/40">
        <h3 className="text-sm font-bold text-[var(--text)]">Notificaciones</h3>
        <button
          onClick={handleMarkAllRead}
          disabled={markingAll || notificaciones.every((n) => n.leida)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {markingAll ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCheck size={12} />
          )}
          Marcar todo como leído
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell size={28} className="text-[var(--text-muted)] mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-muted)]">
              No tenés notificaciones pendientes
            </p>
          </div>
        ) : (
          notificaciones.map((noti) => (
            <button
              key={noti.id}
              onClick={() => handleMarkRead(noti.id)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-[var(--border)]/20 transition-colors hover:bg-[var(--card)]/60 ${
                noti.leida
                  ? "opacity-60"
                  : "bg-[var(--card)]/30"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {tipoIcon(noti.tipo)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">
                    {noti.titulo}
                  </p>
                  {!noti.leida && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                  {noti.mensaje}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {timeAgo(noti.createdAt)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border)]/40 text-center">
        <span className="text-[11px] text-[var(--text-muted)]">
          Próximamente: ver todas las notificaciones
        </span>
      </div>
    </div>
  );
}
