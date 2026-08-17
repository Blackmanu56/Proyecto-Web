"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { aprobarReposicion, rechazarReposicion } from "@/actions/reposiciones";
import { useRouter } from "next/navigation";

/* ────────────────────── Types ────────────────────── */

type SolicitudEstado = "PENDIENTE" | "APROBADA" | "RECHAZADA";

interface SolicitudItem {
  id: number;
  cantidad: number;
  costoUnitario: number;
  total: number;
  origenPago: string;
  pagos?: unknown;
  motivo?: string | null;
  respuesta?: string | null;
  estado: string;
  createdAt: string | Date;
  resueltoEn?: string | Date | null;
  producto: { id: number; nombre: string; precioCompra: number };
  proveedor: { id: number; nombre: string };
  solicitante: { username: string };
  aprobador?: { username: string } | null;
  compra?: { id: number; total: number } | null;
}

interface SolicitudesTableProps {
  solicitudes: SolicitudItem[];
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudesTable({ solicitudes }: SolicitudesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<SolicitudEstado | "TODAS">("PENDIENTE");
  const [rejectModal, setRejectModal] = useState<{ open: boolean; solicitudId: number | null }>({
    open: false,
    solicitudId: null,
  });
  const [rejectRespuesta, setRejectRespuesta] = useState("");
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredSolicitudes =
    activeTab === "TODAS"
      ? solicitudes
      : solicitudes.filter((s) => s.estado === activeTab);

  const counts = {
    PENDIENTE: solicitudes.filter((s) => s.estado === "PENDIENTE").length,
    APROBADA: solicitudes.filter((s) => s.estado === "APROBADA").length,
    RECHAZADA: solicitudes.filter((s) => s.estado === "RECHAZADA").length,
  };

  const handleApprove = (id: number) => {
    setActionResult(null);
    startTransition(async () => {
      const res = await aprobarReposicion(id);
      if (res.success) {
        setActionResult({ type: "success", message: "Solicitud aprobada exitosamente." });
        router.refresh();
      } else {
        setActionResult({ type: "error", message: res.error || "Error al aprobar." });
      }
    });
  };

  const handleReject = () => {
    if (!rejectModal.solicitudId || !rejectRespuesta.trim()) return;
    setActionResult(null);
    startTransition(async () => {
      const res = await rechazarReposicion(rejectModal.solicitudId!, rejectRespuesta.trim());
      if (res.success) {
        setActionResult({ type: "success", message: "Solicitud rechazada." });
        setRejectModal({ open: false, solicitudId: null });
        setRejectRespuesta("");
        router.refresh();
      } else {
        setActionResult({ type: "error", message: res.error || "Error al rechazar." });
      }
    });
  };

  const tabs: { key: SolicitudEstado | "TODAS"; label: string }[] = [
    { key: "PENDIENTE", label: `Pendientes (${counts.PENDIENTE})` },
    { key: "APROBADA", label: `Aprobadas (${counts.APROBADA})` },
    { key: "RECHAZADA", label: `Rechazadas (${counts.RECHAZADA})` },
    { key: "TODAS", label: "Todas" },
  ];

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B]"><Clock size={11} /> Pendiente</span>;
      case "APROBADA":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--success)]/15 text-[var(--success)]"><CheckCircle size={11} /> Aprobada</span>;
      case "RECHAZADA":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--danger)]/15 text-[var(--danger)]"><XCircle size={11} /> Rechazada</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg)] text-[var(--text-secondary)]">{estado}</span>;
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-[#047857] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {actionResult && (
        <div
          className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
            actionResult.type === "success"
              ? "bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--success)]"
              : "bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)]"
          }`}
        >
          {actionResult.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {actionResult.message}
        </div>
      )}

      {/* Table */}
      {filteredSolicitudes.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <p className="text-sm">No hay solicitudes {activeTab !== "TODAS" ? `con estado "${activeTab.toLowerCase()}"` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSolicitudes.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-[var(--text)]">{s.producto.nombre}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Proveedor: {s.proveedor.nombre} · Solicitante: {s.solicitante.username}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {estadoBadge(s.estado)}
                  <span className="text-xs text-[var(--text-secondary)]">#{s.id}</span>
                </div>
              </div>

              {/* Snapshot */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Cantidad</p>
                  <p className="font-mono font-semibold">{s.cantidad}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Costo Unit.</p>
                  <p className="font-mono font-semibold">{formatCurrency(s.costoUnitario)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Total</p>
                  <p className="font-mono font-bold text-[var(--brand)]">{formatCurrency(s.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Origen Pago</p>
                  <p className="font-semibold">{s.origenPago.replace(/_/g, " ")}</p>
                </div>
              </div>

              {/* Payment distribution snapshot (read-only, D8) */}
              {Array.isArray(s.pagos) && s.pagos.length > 0 && (
                <div className="p-2 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Distribución de pago</p>
                  <div className="flex flex-wrap gap-2">
                    {(s.pagos as Array<{ medio: string; monto: number; observacion?: string }>).map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs font-mono">
                        {p.medio.replace(/_/g, " ")}: {formatCurrency(p.monto)}
                        {p.observacion && <span className="text-[var(--text-secondary)] ml-1">({p.observacion})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivo / Respuesta */}
              {s.motivo && (
                <p className="text-xs text-[var(--text-secondary)]">
                  <strong>Motivo:</strong> {s.motivo}
                </p>
              )}
              {s.respuesta && (
                <p className="text-xs text-[var(--danger)]">
                  <strong>Respuesta:</strong> {s.respuesta}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Creada: {formatDate(s.createdAt)}
                  {s.resueltoEn && ` · Resuelta: ${formatDate(s.resueltoEn)}`}
                  {s.aprobador && ` · Aprobada por: ${s.aprobador.username}`}
                </p>

                {s.estado === "PENDIENTE" && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handleApprove(s.id)}
                      disabled={isPending}
                      className="bg-[#047857] hover:bg-[#065F46] text-white text-xs px-3 py-1.5 h-auto"
                    >
                      <CheckCircle size={13} className="mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRejectModal({ open: true, solicitudId: s.id })}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 h-auto border-[var(--danger)]/40 text-[var(--danger)]"
                    >
                      <XCircle size={13} className="mr-1" />
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="font-bold text-[var(--text)]">Rechazar solicitud</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Indicá el motivo del rechazo. Esta información quedará registrada.
            </p>
            <textarea
              value={rejectRespuesta}
              onChange={(e) => setRejectRespuesta(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] resize-none"
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setRejectModal({ open: false, solicitudId: null }); setRejectRespuesta(""); }}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleReject}
                disabled={isPending || !rejectRespuesta.trim()}
                className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white"
              >
                Rechazar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
