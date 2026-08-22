"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PackageX,
  TrendingDown,
  TrendingUp,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import {
  getPreferenciasNotificacion,
  togglePreferenciaNotificacion,
} from "@/actions/solicitudes-stock";

/* ────────────────────── Types ────────────────────── */

interface PreferenciasNotificacionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ────────────────────── Config ────────────────────── */

const TIPO_CONFIG: Record<
  string,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  SOLICITUD_CREADA: {
    label: "Solicitud creada",
    description: "Cuando se crea un nuevo pedido de reposición",
    icon: <Bell size={16} />,
    color: "text-[var(--info)]",
  },
  SOLICITUD_APROBADA: {
    label: "Solicitud aprobada",
    description: "Cuando un admin aprueba tu pedido",
    icon: <CheckCircle size={16} />,
    color: "text-[var(--success)]",
  },
  SOLICITUD_RECHAZADA: {
    label: "Solicitud rechazada",
    description: "Cuando un admin rechaza tu pedido",
    icon: <XCircle size={16} />,
    color: "text-[var(--danger)]",
  },
  STOCK_CRITICO: {
    label: "Stock crítico",
    description: "Cuando un producto llega al mínimo",
    icon: <AlertTriangle size={16} />,
    color: "text-yellow-500",
  },
  STOCK_AGOTADO: {
    label: "Stock agotado",
    description: "Cuando un producto se queda sin stock",
    icon: <PackageX size={16} />,
    color: "text-[var(--danger)]",
  },
  STOCK_RESTADO: {
    label: "Stock reducido",
    description: "Cuando se descuenta stock de un producto",
    icon: <TrendingDown size={16} />,
    color: "text-orange-500",
  },
  STOCK_RECARGADO: {
    label: "Stock recargado",
    description: "Cuando se suma stock a un producto",
    icon: <TrendingUp size={16} />,
    color: "text-[var(--success)]",
  },
  VENTA_CREADA: {
    label: "Ventas realizadas",
    description: "Cuando se registra una nueva venta",
    icon: <ShoppingCart size={16} />,
    color: "text-blue-500",
  },
};

/* ────────────────────── Component ────────────────────── */

export default function PreferenciasNotificacionModal({
  open,
  onOpenChange,
}: PreferenciasNotificacionModalProps) {
  const [preferencias, setPreferencias] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, startSavingTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const res = await getPreferenciasNotificacion();
      if (!("error" in res)) {
        setPreferencias(res.preferencias);
      }
      setLoading(false);
    })();
  }, [open]);

  const handleToggle = (tipo: string) => {
    const nuevoValor = !preferencias[tipo];
    setPreferencias((prev) => ({ ...prev, [tipo]: nuevoValor }));

    startSavingTransition(async () => {
      const res = await togglePreferenciaNotificacion(tipo, nuevoValor);
      if ("error" in res) {
        // Revert on error
        setPreferencias((prev) => ({ ...prev, [tipo]: !nuevoValor }));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-[var(--panel)] border border-[var(--border)]/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[var(--text)]">
            <div className="p-2 bg-[var(--brand-light)] rounded-xl text-[var(--brand)] ring-1 ring-[var(--brand)]/20">
              <Bell size={18} />
            </div>
            Preferencias de notificación
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--text-secondary)]">
            Elegí qué notificaciones querés recibir. Las que desactives no van a llegar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {Object.entries(TIPO_CONFIG).map(([tipo, config]) => (
              <button
                key={tipo}
                onClick={() => handleToggle(tipo)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all hover:bg-white/[0.03]"
              >
                <div className={`shrink-0 ${config.color}`}>{config.icon}</div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{config.label}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{config.description}</p>
                </div>
                <div className="shrink-0">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      preferencias[tipo]
                        ? "bg-[var(--brand)]"
                        : "bg-[var(--border)]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        preferencias[tipo] ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
