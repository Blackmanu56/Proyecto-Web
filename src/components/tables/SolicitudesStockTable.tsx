"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SolicitudStockDetail from "@/components/ui/SolicitudStockDetail";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check,
  X,
  ShieldCheck,
  User,
  Ban,
  Filter,
  Eye,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  aprobarSolicitudStock,
  rechazarSolicitudStock,
  cancelarSolicitudStock,
} from "@/actions/solicitudes-stock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ────────────────────── Types ────────────────────── */

export interface SolicitudRow {
  id: number;
  tipo: "RESTA" | "REPOSICION";
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
    imagen?: string | null;
    proveedor?: { id: number; nombre: string } | null;
  };
  solicitante: { id: number; nombreCompleto: string };
  resueltoPor?: { id: number; nombreCompleto: string } | null;
}

interface SolicitudesStockTableProps {
  solicitudes: SolicitudRow[];
  onRefresh: () => void;
  currentUserId?: number;
  userRole?: string;
}

type EstadoFilter = "TODAS" | "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";
type TipoFilter = "TODAS" | "REPOSICION" | "RESTA";

const FILTER_TABS: { key: EstadoFilter; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "APROBADA", label: "Aprobadas" },
  { key: "RECHAZADA", label: "Rechazadas" },
  { key: "CANCELADA", label: "Canceladas" },
];

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
      return <Badge variant="default" size="sm">{estado}</Badge>;
  }
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudesStockTable({
  solicitudes,
  onRefresh,
  currentUserId,
  userRole,
}: SolicitudesStockTableProps) {
  const isAdmin = userRole === "ADMINISTRADOR";
  const [filter, setFilter] = useState<EstadoFilter>("TODAS");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("TODAS");
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudRow | null>(null);
  const [isTransitionPending, startTransition] = useTransition();

  // Modal rechazo inline para admin
  const [rechazarModal, setRechazarModal] = useState<{
    open: boolean;
    solicitudId: number;
    solicitudNombre: string;
    motivo: string;
  }>({ open: false, solicitudId: 0, solicitudNombre: "", motivo: "" });

  // Modal cancelar solicitud para empleado
  const [cancelarModal, setCancelarModal] = useState<{
    open: boolean;
    solicitudId: number;
    solicitudNombre: string;
  }>({ open: false, solicitudId: 0, solicitudNombre: "" });

  // Base dataset: admin ve todas, empleado ve las suyas
  const baseSolicitudes = useMemo(() => {
    if (!isAdmin && currentUserId) {
      return solicitudes.filter((s) => s.solicitante.id === currentUserId);
    }
    return solicitudes;
  }, [solicitudes, isAdmin, currentUserId]);

  // Dataset con filtro de tipo aplicado
  const solicitudesConTipo = useMemo(() => {
    if (tipoFilter === "TODAS") return baseSolicitudes;
    return baseSolicitudes.filter((s) => s.tipo === tipoFilter);
  }, [baseSolicitudes, tipoFilter]);

  // Contadores dinámicos por estado (calculados sobre el tipo seleccionado)
  const counts = useMemo(() => {
    return {
      TODAS: solicitudesConTipo.length,
      PENDIENTE: solicitudesConTipo.filter((s) => s.estado === "PENDIENTE").length,
      APROBADA: solicitudesConTipo.filter((s) => s.estado === "APROBADA").length,
      RECHAZADA: solicitudesConTipo.filter((s) => s.estado === "RECHAZADA").length,
      CANCELADA: solicitudesConTipo.filter((s) => s.estado === "CANCELADA").length,
    };
  }, [solicitudesConTipo]);

  const filtered = useMemo(() => {
    if (filter === "TODAS") return solicitudesConTipo;
    return solicitudesConTipo.filter((s) => s.estado === filter);
  }, [solicitudesConTipo, filter]);

  const formatDateOnly = (d: Date | string) => {
    try {
      return format(new Date(d), "dd/MM/yy", { locale: es });
    } catch {
      return "—";
    }
  };

  const formatTimeOnly = (d: Date | string) => {
    try {
      return format(new Date(d), "HH:mm", { locale: es });
    } catch {
      return "";
    }
  };

  // Acciones inline del admin
  const handleAprobarInline = (s: SolicitudRow) => {
    startTransition(async () => {
      try {
        const res = await aprobarSolicitudStock(s.id);
        if ("error" in res) {
          toast.error(res.error ?? "Error al aprobar la solicitud");
          return;
        }
        toast.success(`Solicitud #${s.id} aprobada con éxito`);
        onRefresh();
      } catch {
        toast.error("Error inesperado al aprobar.");
      }
    });
  };

  const handleRechazarInline = () => {
    if (!rechazarModal.motivo.trim()) {
      toast.error("El motivo de rechazo es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await rechazarSolicitudStock(
          rechazarModal.solicitudId,
          rechazarModal.motivo
        );
        if ("error" in res) {
          toast.error(res.error ?? "Error al rechazar");
          return;
        }
        toast.success(`Solicitud #${rechazarModal.solicitudId} rechazada`);
        setRechazarModal({ open: false, solicitudId: 0, solicitudNombre: "", motivo: "" });
        onRefresh();
      } catch {
        toast.error("Error inesperado al rechazar.");
      }
    });
  };

  // Acción cancelar solicitud para empleado
  const handleCancelarInline = () => {
    startTransition(async () => {
      try {
        const res = await cancelarSolicitudStock(cancelarModal.solicitudId);
        if ("error" in res) {
          toast.error(res.error ?? "Error al cancelar");
          return;
        }
        toast.success(`Solicitud #${cancelarModal.solicitudId} cancelada`);
        setCancelarModal({ open: false, solicitudId: 0, solicitudNombre: "" });
        onRefresh();
      } catch {
        toast.error("Error inesperado al cancelar.");
      }
    });
  };

  return (
    <div className="space-y-3.5 flex flex-col h-full min-h-0">
      {/* Top Bar: Filters (Estado + Tipo) Centrado y con mayor tamaño */}
      <div className="shrink-0 flex items-center justify-center gap-3.5 bg-[var(--card)] p-3 min-h-[76px] rounded-2xl border border-[var(--border)] flex-wrap shadow-sm">
        {/* Status filter tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = counts[tab.key];
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-2",
                  isActive
                    ? "bg-[#047857] text-white shadow-sm"
                    : "bg-[var(--panel)] text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--border)]/40"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-black",
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-[var(--text-muted)] bg-[var(--card)]"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-7 bg-[var(--border)]" />

        {/* Tipo filter buttons */}
        <div className="flex items-center gap-1 bg-[var(--panel)] p-1.5 rounded-xl border border-[var(--border)]/60">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase px-2 flex items-center gap-1">
            <Filter size={12} />
            Tipo:
          </span>
          {(["TODAS", "REPOSICION", "RESTA"] as const).map((t) => {
            const label = t === "TODAS" ? "Todos" : t === "REPOSICION" ? "Reposición" : "Resta";
            const isActive = tipoFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipoFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                  isActive
                    ? "bg-[#047857] text-white font-bold shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                )}
              >
                {t === "REPOSICION" && <TrendingUp size={13} />}
                {t === "RESTA" && <TrendingDown size={13} />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm border-collapse min-w-[850px] table-auto">
          <thead>
            <tr className="bg-[#17191f]">
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[5%]">ID</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[12%]">TIPO</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[22%]">PRODUCTO</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-center w-[6%]">CANT.</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[18%]">DETALLE</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[13%]">SOLICITANTE</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-left w-[8%]">FECHA</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-center w-[10%]">ESTADO</th>
              <th className="sticky top-0 z-10 bg-[#17191f] py-3.5 px-4 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] font-extrabold text-[#9DB2D6] text-center w-[16%]">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center text-[var(--text-muted)] text-sm">
                  No hay solicitudes para mostrar en este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((sol) => {
                const isResta = sol.tipo === "RESTA";
                const isPendiente = sol.estado === "PENDIENTE";

                return (
                  <tr
                    key={sol.id}
                    onClick={() => setSelectedSolicitud(sol)}
                    className="border-b border-[var(--border)]/40 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-muted)] font-bold">
                      #{sol.id}
                    </td>
                    <td className="px-4 py-3.5">
                      {isResta ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30 uppercase tracking-wider">
                          <TrendingDown size={12} strokeWidth={2.5} />
                          RESTA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/30 uppercase tracking-wider">
                          <TrendingUp size={12} strokeWidth={2.5} />
                          REPOSICIÓN
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-[var(--text)] text-xs block truncate max-w-[240px]" title={sol.producto.nombre}>
                        {sol.producto.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-xs text-[var(--text)]">
                      {sol.cantidad}
                    </td>
                    <td className="px-4 py-3.5">
                      {isResta ? (
                        <span className="text-xs text-[var(--text-secondary)] block truncate max-w-[220px]" title={sol.motivo}>
                          <span className="text-[var(--text-muted)] font-medium">Motivo: </span>
                          <strong className="text-[var(--text)] font-semibold">{sol.motivo}</strong>
                        </span>
                      ) : (
                        <span
                          className="text-xs text-[var(--text-secondary)] block truncate max-w-[220px]"
                          title={sol.producto.proveedor?.nombre || sol.motivo || "—"}
                        >
                          <span className="text-[var(--text-muted)] font-medium">Proveedor: </span>
                          <strong className="text-[var(--text)] font-semibold">{sol.producto.proveedor?.nombre || sol.motivo || "—"}</strong>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)] truncate max-w-[140px]">
                      {sol.solicitante.nombreCompleto}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap leading-tight">
                        <span className="text-[var(--text)] block font-medium">{formatDateOnly(sol.createdAt)}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">{formatTimeOnly(sol.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {estadoBadge(sol.estado)}
                    </td>
                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        isPendiente ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => handleAprobarInline(sol)}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#047857] hover:bg-[#065F46] text-white shadow-sm transition-colors disabled:opacity-50"
                              disabled={isTransitionPending}
                            >
                              <Check size={14} strokeWidth={2.5} />
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRechazarModal({
                                  open: true,
                                  solicitudId: sol.id,
                                  solicitudNombre: sol.producto.nombre,
                                  motivo: "",
                                })
                              }
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors disabled:opacity-50"
                              disabled={isTransitionPending}
                            >
                              <X size={14} strokeWidth={2.5} />
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSolicitud(sol)}
                            className="inline-flex items-center justify-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] hover:bg-[var(--panel)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                          >
                            <Eye size={13} />
                            Ver
                          </button>
                        )
                      ) : (
                        /* Vista Empleado: Si está pendiente mostrar botón Cancelar solicitud */
                        isPendiente ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCancelarModal({
                                open: true,
                                solicitudId: sol.id,
                                solicitudNombre: sol.producto.nombre,
                              })
                            }
                            className="w-full max-w-[170px] inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
                            disabled={isTransitionPending}
                          >
                            <Ban size={13} />
                            Cancelar solicitud
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSolicitud(sol)}
                            className="inline-flex items-center justify-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] hover:bg-[var(--panel)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                          >
                            <Eye size={13} />
                            Ver
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal ("Ver" al tocar cualquier fila de la tabla o botón Ver) */}
      {selectedSolicitud && (
        <SolicitudStockDetail
          open={!!selectedSolicitud}
          onOpenChange={(open) => {
            if (!open) setSelectedSolicitud(null);
          }}
          solicitud={selectedSolicitud}
          currentUserId={currentUserId}
          userRole={userRole}
          onSuccess={() => {
            setSelectedSolicitud(null);
            onRefresh();
          }}
        />
      )}

      {/* Modal Rechazar Inline con Motivo Obligatorio (Admin) */}
      {rechazarModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111318] border border-[#232734] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <X size={20} className="text-[#EF4444]" />
                Rechazar solicitud #{rechazarModal.solicitudId}
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Producto: <strong className="text-white">{rechazarModal.solicitudNombre}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                Motivo del rechazo <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                value={rechazarModal.motivo}
                onChange={(e) =>
                  setRechazarModal((prev) => ({ ...prev, motivo: e.target.value }))
                }
                placeholder="Indicá el motivo por el cual se rechaza esta solicitud..."
                rows={3}
                className="w-full px-3 py-2 bg-[#161922] border border-[#232734] rounded-xl text-sm text-white focus:outline-none focus:border-[#7C3AED] resize-none transition-colors"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setRechazarModal({ open: false, solicitudId: 0, solicitudNombre: "", motivo: "" })
                }
                disabled={isTransitionPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleRechazarInline}
                disabled={isTransitionPending || !rechazarModal.motivo.trim()}
                loading={isTransitionPending}
                leftIcon={<X size={14} />}
              >
                Rechazar solicitud
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar Solicitud (Empleado) */}
      {cancelarModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111318] border border-[#232734] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Ban size={20} className="text-[#EF4444]" />
                ¿Cancelar solicitud #{cancelarModal.solicitudId}?
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Producto: <strong className="text-white">{cancelarModal.solicitudNombre}</strong>
              </p>
            </div>

            <p className="text-sm text-[#94A3B8]">
              Esta acción anulará tu solicitud de stock pendiente y pasará a estado <strong className="text-white">Cancelada</strong>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setCancelarModal({ open: false, solicitudId: 0, solicitudNombre: "" })
                }
                disabled={isTransitionPending}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleCancelarInline}
                disabled={isTransitionPending}
                loading={isTransitionPending}
                leftIcon={<Ban size={14} />}
              >
                Confirmar cancelación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

