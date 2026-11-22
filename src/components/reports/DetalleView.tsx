"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import DetalleVentaModal from "./DetalleVentaModal";
import TicketModal from "./TicketModal";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Printer, Eye } from "lucide-react";
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
  fechaDesde: string;
  fechaHasta: string;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  printSection: string | null;
  setPrintSection: (s: string | null) => void;
}

export default function DetalleView({
  ventasFiltradas,
  sortedVentas,
  fechaDesde,
  fechaHasta,
  sortKey,
  sortDir,
  onSort,
  printSection,
  setPrintSection,
}: DetalleViewProps) {
  // Modales locales a esta vista: se cierran solos al cambiar de sub-vista (unmount)
  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [ticketVentaId, setTicketVentaId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const totalPages = Math.max(1, Math.ceil(sortedVentas.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedVentas =
    printSection === "detalle"
      ? sortedVentas
      : sortedVentas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  const thClass =
    "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
    "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

  const thRightClass =
    "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
    "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

  return (
    <section
      className="report-section space-y-4"
      data-section-id="detalle"
      data-print-active={printSection === "detalle" || null}
    >
      <ReportPrintHeader desde={fechaDesde} hasta={fechaHasta} />

      {/* Tabla completa */}
      <div className="flex items-center justify-between mb-2 print:hidden">
        <h3 className="text-sm font-semibold text-[var(--text-muted)]">
          Tabla de Ventas ({ventasFiltradas.length} registros)
        </h3>
        <button
          onClick={() => setPrintSection("detalle")}
          className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--border)] transition print:hidden"
          title="Imprimir tabla"
        >
          <Printer size={12} />
        </button>
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
                paginatedVentas.map((venta) => (
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

        {/* Barra de Paginación */}
        {sortedVentas.length > 0 && (
          <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{" "}
                <strong className="text-[var(--text)]">
                  {Math.min((currentPage - 1) * pageSize + 1, sortedVentas.length)}
                </strong>{" "}
                a{" "}
                <strong className="text-[var(--text)]">
                  {Math.min(currentPage * pageSize, sortedVentas.length)}
                </strong>{" "}
                de <strong className="text-[var(--text)]">{sortedVentas.length}</strong> ventas
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Filas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Primera página"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Página anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Página siguiente"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Última página"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
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
