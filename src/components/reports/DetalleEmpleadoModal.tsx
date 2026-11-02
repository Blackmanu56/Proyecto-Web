"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EmpleadoDashboardRow } from "@/actions/informes";
import { Layers, Clock } from "lucide-react";

interface Props {
  emp: EmpleadoDashboardRow;
  onClose: () => void;
}

const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  ENCARGADO_VENTAS: "Encargado de Ventas",
  ENCARGADO_STOCK: "Encargado de Stock",
};

const TIPO_COLOR: Record<string, string> = {
  Venta: "#818cf8",
  Reposición: "#34d399",
  "Movimiento de Caja": "#fbbf24",
  "Apertura de Caja": "#fbbf24",
  "Cierre de Caja": "#fbbf24",
  "Cambio de Estado": "#fb7185",
  "Edición de datos": "#38bdf8",
  "Ajuste de Precio": "#8b5cf6",
  "Ajuste de Precios": "#8b5cf6",
  "Ajuste de Stock": "#f59e0b",
};

function TipoDot({ tipo }: { tipo: string }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
      style={{ backgroundColor: TIPO_COLOR[tipo] || "#94a3b8" }}
    />
  );
}

export default function DetalleEmpleadoModal({ emp, onClose }: Props) {
  const modulos = [
    { label: "Ventas", value: emp.ventasCount },
    { label: "Stock y Reposición", value: emp.comprasCount + emp.ajustesStockCount },
    { label: "Caja", value: emp.movimientosCajaCount + emp.cierresCount },
    { label: "Catálogo y Productos", value: emp.cambiosEstadoProductoCount + emp.ajustesPrecioCount },
  ];
  const maxModulo = Math.max(...modulos.map((m) => m.value), 1);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0 pr-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center font-bold text-base uppercase shrink-0 ring-1 ring-[var(--brand)]/20">
              {emp.nombreCompleto.charAt(0)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-[var(--text)] truncate">
                {emp.nombreCompleto}
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-muted)] font-mono truncate">
                @{emp.username}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body scrollable con barra de desplazamiento */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* Ficha de Información General */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Rol</span>
              <span className="text-xs font-bold text-[var(--text)] truncate block">
                {ROL_LABEL[emp.rol] || emp.rol}
              </span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Estado</span>
              {emp.activo ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--success)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)]" /> Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--danger)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--danger)]" /> Inactivo
                </span>
              )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Acciones en el período</span>
              <span className="text-sm font-bold text-[var(--brand)]">{emp.acciones}</span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 min-w-0">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Última actividad</span>
              <span className="text-xs font-semibold text-[var(--text)] truncate block">
                {emp.ultimaActividadLabel || "—"}
              </span>
            </div>
          </div>

          {/* Distribución por Módulo */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers size={14} className="text-[var(--brand)]" />
              Distribución de Trabajo
            </h3>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
              {modulos.map((m) => {
                const pct = emp.acciones > 0 ? ((m.value / emp.acciones) * 100).toFixed(0) : "0";
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--text-muted)] font-medium">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text)]">{m.value} acciones</span>
                        <span className="text-xs text-[var(--text-muted)]">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand)] rounded-full transition-all duration-300"
                        style={{ width: `${(m.value / maxModulo) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actividad Reciente en el Período */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock size={14} className="text-[var(--brand)]" />
              Últimas Actividades Registradas
            </h3>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              {emp.actividadReciente.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] text-center py-4">
                  Sin actividad registrada en el período seleccionado.
                </p>
              ) : (
                <div className="space-y-3 divide-y divide-[var(--border)]/50">
                  {emp.actividadReciente.map((a, idx) => (
                    <div key={a.id || idx} className={`flex items-start gap-3 text-xs ${idx > 0 ? "pt-3" : ""}`}>
                      <TipoDot tipo={a.tipo} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--text)] truncate">
                            {a.tipo}
                          </p>
                          <span className="text-[var(--text-muted)] shrink-0 text-xs font-mono">{a.fechaLabel}</span>
                        </div>
                        <p className="text-[var(--text-muted)] mt-0.5">{a.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer fijo abajo */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] shrink-0 flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
