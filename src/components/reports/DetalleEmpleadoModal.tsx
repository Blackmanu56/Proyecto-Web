"use client";

import React from "react";
import type { EmpleadoDashboardRow } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  X,
  User,
  Activity,
  Layers,
  Clock,
  ShoppingCart,
  DollarSign,
  Package,
  Boxes,
  KeyRound,
  FileSpreadsheet,
  Coins,
} from "lucide-react";

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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[var(--panel)] border border-[var(--border)] w-full max-w-2xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center font-bold text-base uppercase shrink-0">
              {emp.nombreCompleto.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                {emp.nombreCompleto}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">@{emp.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-hover)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Ficha de Información General */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Rol</span>
              <span className="text-xs font-bold text-[var(--text)]">
                {ROL_LABEL[emp.rol] || emp.rol}
              </span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
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

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Acciones en el período</span>
              <span className="text-sm font-bold text-[var(--brand)]">{emp.acciones}</span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Última actividad</span>
              <span className="text-xs font-semibold text-[var(--text)]">
                {emp.ultimaActividadLabel || "—"}
              </span>
            </div>
          </div>

          {/* Métricas específicas según el Rol */}
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity size={14} className="text-[var(--brand)]" />
              Métricas de Desempeño
            </h3>
            {emp.rol === "ENCARGADO_VENTAS" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium">Ventas Realizadas</p>
                    <p className="text-base font-bold text-[var(--text)]">{emp.ventasCount}</p>
                  </div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium">Monto Facturado</p>
                    <p className="text-base font-bold text-[var(--success)]">{formatCurrency(emp.totalVendido)}</p>
                  </div>
                </div>
              </div>
            )}

            {emp.rol === "ENCARGADO_STOCK" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Reposiciones</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.comprasCount}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Total Compras</p>
                  <p className="text-sm font-bold text-[var(--text)]">{formatCurrency(emp.totalCompras)}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Ajustes de Stock</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.ajustesStockCount}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Cambios Estado</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.cambiosEstadoProductoCount}</p>
                </div>
              </div>
            )}

            {emp.rol === "ADMINISTRADOR" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Cajas Abiertas</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.cajasAbiertasCount}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Cierres de Caja</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.cierresCount}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Movimientos Caja</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.movimientosCajaCount}</p>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Ajustes Precios</p>
                  <p className="text-sm font-bold text-[var(--text)]">{emp.ajustesPrecioCount}</p>
                </div>
              </div>
            )}
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
                          <span className="text-[var(--text-muted)] shrink-0 text-xs">{a.fechaLabel}</span>
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--card)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--border)] hover:bg-[var(--border-hover)] text-[var(--text)] text-xs font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
