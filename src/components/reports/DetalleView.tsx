"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import DetalleVentaModal from "./DetalleVentaModal";
import TicketModal from "./TicketModal";
import { ArrowDown, ArrowUp, ArrowUpDown, Printer, Search, Eye } from "lucide-react";
import {
  ReportPrintHeader,
  type ReporteVentaRow,
  type SortKey,
  type SortDir,
  type VentasReportData,
} from "./ventasShared";

interface DetalleViewProps {
  data: VentasReportData;
  ventasFiltradas: ReporteVentaRow[]; // filtradas por búsqueda de cliente, más antiguas primero
  sortedVentas: ReporteVentaRow[]; // ordenadas según sortKey/sortDir
  totales: { cantidad: number; total: number; promedio: number; productosVendidos: number };
  clientesUnicos: number;
  fechaDesde: string;
  fechaHasta: string;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  clienteSearch: string;
  onClienteSearch: (v: string) => void;
  printSection: string | null;
  setPrintSection: (s: string | null) => void;
}

export default function DetalleView({
  ventasFiltradas,
  sortedVentas,
  totales,
  fechaDesde,
  fechaHasta,
  sortKey,
  sortDir,
  onSort,
  clienteSearch,
  onClienteSearch,
  printSection,
  setPrintSection,
}: DetalleViewProps) {
  // Modales locales a esta vista: se cierran solos al cambiar de sub-vista (unmount)
  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [ticketVentaId, setTicketVentaId] = useState<number | null>(null);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="text-[var(--text-muted)] opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[var(--brand)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--brand)]" />
    );
  };

  const inputClass =
    "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

  const thClass =
    "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
    "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

  const thRightClass =
    "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
    "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

  return (
    <section
      className="report-section"
      data-section-id="detalle"
      data-print-active={printSection === "detalle" || null}
    >
      <ReportPrintHeader desde={fechaDesde} hasta={fechaHasta} />

      {/* Barra resumen compacta (refleja la búsqueda de cliente activa) */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Ventas Totales</div>
          <div className="text-sm font-bold text-[var(--success)]">{formatCurrency(totales.total)}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Cantidad de Ventas</div>
          <div className="text-sm font-bold text-[var(--text)]">{totales.cantidad}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Productos Vendidos</div>
          <div className="text-sm font-bold text-[var(--text)]">{totales.productosVendidos}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Ticket Promedio</div>
          <div className="text-sm font-bold text-[var(--text)]">{formatCurrency(totales.promedio)}</div>
        </div>
      </div>

      {/* Tabla completa */}
      <div className="flex items-center justify-between mb-2 print:hidden">
        <h3 className="text-sm font-semibold text-[var(--text-muted)]">
          Tabla de Ventas ({ventasFiltradas.length} registros)
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={clienteSearch}
              onChange={(e) => onClienteSearch(e.target.value)}
              className={inputClass + " pl-7 w-44 sm:w-56"}
            />
          </div>
          <button
            onClick={() => setPrintSection("detalle")}
            className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--border)] transition print:hidden"
            title="Imprimir tabla"
          >
            <Printer size={12} />
          </button>
        </div>
      </div>

      <div className="bg-[var(--panel)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--card)] print:bg-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">#</th>
                <th onClick={() => onSort("fecha")} aria-label="Ordenar por Fecha" title="Ordenar por Fecha" className={thClass}>
                  <span className="inline-flex items-center gap-1">
                    Fecha
                    {renderSortIndicator("fecha")}
                  </span>
                </th>
                <th onClick={() => onSort("cliente")} aria-label="Ordenar por Cliente" title="Ordenar por Cliente" className={thClass}>
                  <span className="inline-flex items-center gap-1">
                    Cliente
                    {renderSortIndicator("cliente")}
                  </span>
                </th>
                <th onClick={() => onSort("vendedor")} aria-label="Ordenar por Vendedor" title="Ordenar por Vendedor" className={thClass}>
                  <span className="inline-flex items-center gap-1">
                    Vendedor
                    {renderSortIndicator("vendedor")}
                  </span>
                </th>
                <th onClick={() => onSort("cantidad")} aria-label="Ordenar por Cantidad de productos" title="Ordenar por Cantidad de productos" className={thRightClass}>
                  <span className="inline-flex items-center justify-end gap-1">
                    CANTIDAD
                    {renderSortIndicator("cantidad")}
                  </span>
                </th>
                <th onClick={() => onSort("total")} aria-label="Ordenar por Total" title="Ordenar por Total" className={thRightClass}>
                  <span className="inline-flex items-center justify-end gap-1">
                    Total
                    {renderSortIndicator("total")}
                  </span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider print:hidden">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50 print:divide-gray-300">
              {sortedVentas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    Sin ventas en el período.
                  </td>
                </tr>
              ) : (
                sortedVentas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-[var(--card)] transition-colors">
                    <td className="px-4 py-3 font-bold text-[var(--text)] print:text-black">
                      #{String(venta.id).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] print:text-gray-700 text-xs">{venta.fecha}</td>
                    <td className="px-4 py-3 text-[var(--text)] print:text-gray-800 font-medium truncate max-w-[180px]">
                      {venta.cliente}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] print:text-gray-600">{venta.usuario}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] print:text-gray-700 text-right">
                      {venta.cantidadProductos}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--success)] print:text-green-700">
                      {formatCurrency(venta.total)}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetalleVentaId(venta.id)}
                          className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--info)] hover:bg-[var(--border)] transition"
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => setTicketVentaId(venta.id)}
                          className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--border)] transition"
                          title="Ticket"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {detalleVentaId && (
        <DetalleVentaModal
          ventaId={detalleVentaId}
          onClose={() => setDetalleVentaId(null)}
          onPrintTicket={() => {
            const id = detalleVentaId;
            setDetalleVentaId(null);
            setTicketVentaId(id);
          }}
        />
      )}
      {ticketVentaId && <TicketModal ventaId={ticketVentaId} onClose={() => setTicketVentaId(null)} />}
    </section>
  );
}
