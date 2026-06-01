"use client";

import React, { useState, useTransition, useCallback, useMemo } from "react";
import { getAuditoriaReport } from "@/actions/informes";
import {
  Search, Calendar, RefreshCw, Printer, Activity,
  Clock, List, ChevronDown, ChevronRight, FileText,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";

interface Props {
  initialData?: any;
  userRole?: string;
}

const TIPO_EVENTOS = [
  "LOGIN", "LOGOUT", "CREACION", "ACTUALIZACION",
  "ELIMINACION", "EXPORTACION", "OTRO",
];

export default function AuditoriaReport({ initialData, userRole }: Props) {
  const [eventos, setEventos] = useState<any[]>([]);
  const [eventosTotal, setEventosTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [searchText, setSearchText] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  const fechaActual = new Date().toLocaleDateString("es-AR");

  const handleSearch = useCallback((pageNum?: number) => {
    startTransition(async () => {
      const result = await getAuditoriaReport({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        search: searchText || undefined,
        tipo: tipoEvento || undefined,
        page: pageNum || 1,
      });
      setEventos(result.data);
      setEventosTotal(result.total);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setExpandedRows(new Set());
    });
  }, [fechaDesde, fechaHasta, searchText, tipoEvento]);

  const handlePrint = () => window.print();

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const kpiData = useMemo(() => {
    const hoy = eventos.filter((e: any) => e.fecha.startsWith(fechaActual));
    const semana = eventos.filter((e: any) => {
      try {
        const eventDate = new Date(e.fecha.split(" ")[0].split("/").reverse().join("-"));
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return eventDate >= weekAgo;
      } catch { return false; }
    });
    const tiposUnicos = new Set(eventos.map((e: any) => e.tipo));

    return [
      { label: "Total Eventos", value: eventosTotal.toString(), icon: <Activity size={18} />, color: "indigo" as const },
      { label: "Eventos Hoy", value: hoy.length.toString(), icon: <Clock size={18} />, color: "emerald" as const },
      { label: "Última Semana", value: semana.length.toString(), icon: <List size={18} />, color: "sky" as const },
      { label: "Tipos Únicos", value: tiposUnicos.size.toString(), icon: <FileText size={18} />, color: "amber" as const },
    ];
  }, [eventos, eventosTotal, fechaActual]);

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Tipo Evento</label>
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos</option>
              {TIPO_EVENTOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Search size={12} /> Búsqueda</label>
            <input type="text" placeholder="Descripción..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSearch()} disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
          </button>
          <button onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Auditoría de Eventos</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiData.map((kpi, i) => <StatCard key={i} {...kpi} />)}
        </div>

        {/* Events Table with expandable rows */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {eventos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Sin eventos de auditoría en el período.
                    </td>
                  </tr>
                ) : eventos.map((ev: any) => (
                  <React.Fragment key={ev.id}>
                    <tr className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => toggleRow(ev.id)}>
                      <td className="px-4 py-3 text-slate-500">
                        {expandedRows.has(ev.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{ev.fecha}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                          {ev.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[300px] truncate">{ev.descripcion}</td>
                      <td className="px-4 py-3 text-slate-400">{ev.usuario || "—"}</td>
                    </tr>
                    {expandedRows.has(ev.id) && (
                      <tr className="bg-slate-800/30">
                        <td colSpan={5} className="px-8 py-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div><span className="text-slate-500">Entidad:</span> <span className="text-slate-300">{ev.entidad || "—"}</span></div>
                              <div><span className="text-slate-500">ID Entidad:</span> <span className="text-slate-300">{ev.entidadId ?? "—"}</span></div>
                            </div>
                            {ev.metadata && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 mb-1">Detalle JSON:</p>
                                <pre className="bg-slate-900/80 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                                  {JSON.stringify(ev.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/30">
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages} ({eventosTotal} eventos)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSearch(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => handleSearch(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
