"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import SolicitudStockDetail from "@/components/ui/SolicitudStockDetail";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, Minus, Plus } from "lucide-react";

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
  producto: { id: number; nombre: string; cantidad: number };
  solicitante: { id: number; nombreCompleto: string };
  resueltoPor?: { id: number; nombreCompleto: string } | null;
}

interface SolicitudesStockTableProps {
  solicitudes: SolicitudRow[];
  onRefresh: () => void;
}

type EstadoFilter = "TODAS" | "PENDIENTE" | "APROBADA" | "RECHAZADA";

const FILTER_TABS: { key: EstadoFilter; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "APROBADA", label: "Aprobadas" },
  { key: "RECHAZADA", label: "Rechazadas" },
];

function estadoBadge(estado: string) {
  switch (estado) {
    case "PENDIENTE":
      return <Badge variant="warning" size="sm">Pendiente</Badge>;
    case "APROBADA":
      return <Badge variant="success" size="sm">Aprobada</Badge>;
    case "RECHAZADA":
      return <Badge variant="danger" size="sm">Rechazada</Badge>;
    default:
      return <Badge variant="default" size="sm">{estado}</Badge>;
  }
}

/* ────────────────────── Component ────────────────────── */

export default function SolicitudesStockTable({
  solicitudes,
  onRefresh,
}: SolicitudesStockTableProps) {
  const [filter, setFilter] = useState<EstadoFilter>("TODAS");
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudRow | null>(null);

  const filtered =
    filter === "TODAS"
      ? solicitudes
      : solicitudes.filter((s) => s.estado === filter);

  const formatDate = (d: Date | string) => {
    try {
      return format(new Date(d), "dd/MM/yy HH:mm", { locale: es });
    } catch {
      return "—";
    }
  };

  return (
    <>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "TODAS"
              ? solicitudes.length
              : solicitudes.filter((s) => s.estado === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 ${
                filter === tab.key
                  ? "bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/60 border border-transparent"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--border)]/40 bg-[var(--panel)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]/40 text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Cant.</th>
              <th className="px-4 py-3 text-left">Solicitante</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
                  No hay solicitudes para mostrar.
                </td>
              </tr>
            ) : (
              filtered.map((sol) => (
                <tr
                  key={sol.id}
                  className="border-b border-[var(--border)]/20 hover:bg-[var(--card)]/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    #{sol.id}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        sol.tipo === "RESTA"
                          ? "text-[var(--danger)]"
                          : "text-[var(--success)]"
                      }`}
                    >
                      {sol.tipo === "RESTA" ? (
                        <Minus size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                      {sol.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text)] truncate max-w-[160px]">
                    {sol.producto.nombre}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right text-[var(--text)]">
                    {sol.cantidad}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] truncate max-w-[120px]">
                    {sol.solicitante.nombreCompleto}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {formatDate(sol.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {estadoBadge(sol.estado)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedSolicitud(sol)}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]/60 transition-colors"
                      title="Ver detalle"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selectedSolicitud && (
        <SolicitudStockDetail
          open={!!selectedSolicitud}
          onOpenChange={(open) => {
            if (!open) setSelectedSolicitud(null);
          }}
          solicitud={selectedSolicitud}
          onSuccess={() => {
            setSelectedSolicitud(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
