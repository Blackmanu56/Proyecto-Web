"use client";

import React, { useState, useTransition, useCallback, useRef } from "react";
import { getReporteVentas } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  Calendar,
  User,
  RefreshCw,
  TrendingUp,
  List,
  Eye,
  Printer,
} from "lucide-react";
import DetalleVentaModal from "./DetalleVentaModal";
import TicketModal from "./TicketModal";

interface Props {
  initialData: any;
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

export default function VentasReport({ initialData, usuarios, userRole }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [clienteFilter, setClienteFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [ticketVentaId, setTicketVentaId] = useState<number | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await getReporteVentas(
        fechaDesde || undefined,
        fechaHasta || undefined,
        usuarioId
      );
      setData(result);
    });
  }, [fechaDesde, fechaHasta, usuarioId]);

  const handlePrint = () => {
    window.print();
  };

  const ventasFiltradas = clienteFilter
    ? data.ventas.filter((v: any) =>
        v.cliente.toLowerCase().includes(clienteFilter.toLowerCase())
      )
    : data.ventas;

  return (
    <div className="space-y-4">
      {/* Filtros — hidden on print */}
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Search size={14} />
          Filtros
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Calendar size={12} /> Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Calendar size={12} /> Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} /> Usuario
            </label>
            <select
              value={usuarioId || ""}
              onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombreCompleto || u.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Search size={12} /> Cliente
            </label>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
            {isPending ? "Buscando..." : "Buscar"}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
          >
            <Printer size={14} />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Contenido del reporte (imprimible) */}
      <div ref={printRef} className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Ventas</p>
          <p className="text-xs text-gray-500">
            {fechaDesde} al {fechaHasta}
          </p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
              <List size={12} /> Cantidad de Ventas
            </p>
            <p className="text-2xl font-black text-white print:text-black mt-1">{data.totales.cantidad}</p>
          </div>
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
              <TrendingUp size={12} /> Total Vendido
            </p>
            <p className="text-2xl font-black text-emerald-400 print:text-green-700 mt-1">{formatCurrency(data.totales.total)}</p>
          </div>
          <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
              <TrendingUp size={12} /> Promedio por Venta
            </p>
            <p className="text-2xl font-black text-sky-400 print:text-sky-700 mt-1">{formatCurrency(data.totales.promedio)}</p>
          </div>
        </div>

        {/* Tabla de Ventas */}
        <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">Vendedor</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">Productos</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase tracking-wider print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                {ventasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 print:text-gray-400">
                      No se encontraron ventas en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  ventasFiltradas.map((venta: any) => (
                    <tr
                      key={venta.id}
                      className="hover:bg-slate-800/30 print:hover:bg-white transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-white print:text-black">
                        #{venta.id.toString().padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3 text-slate-300 print:text-gray-700 text-xs">{venta.fecha}</td>
                      <td className="px-4 py-3 text-slate-200 print:text-gray-800 font-medium truncate max-w-[150px]">
                        {venta.cliente}
                      </td>
                      <td className="px-4 py-3 text-slate-400 print:text-gray-600">{venta.usuario}</td>
                      <td className="px-4 py-3 text-slate-300 print:text-gray-700 text-right">
                        {venta.cantidadProductos}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">
                        {formatCurrency(venta.total)}
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDetalleVentaId(venta.id)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition"
                            title="Ver detalle completo"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => setTicketVentaId(venta.id)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition"
                            title="Reimprimir ticket / factura"
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
      {ticketVentaId && (
        <TicketModal
          ventaId={ticketVentaId}
          onClose={() => setTicketVentaId(null)}
        />
      )}
    </div>
  );
}
