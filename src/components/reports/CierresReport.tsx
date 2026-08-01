"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import { getReporteCierres, getCierresDiferencias } from "@/actions/informes";
import type { ReporteCierre } from "@/actions/informes";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search, Calendar, User, RefreshCw, Wallet, Eye, ChevronUp, Loader2,
  CheckCircle, XCircle, Printer, TrendingUp,
  DollarSign, BadgePercent, ChevronDown, ChevronRight,
  FileText, AlertTriangle,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";
import ResultadoBadge from "./ResultadoBadge";
import CierreAccordionRow from "./CierreAccordionRow";
import CierreDetailPrintView from "./CierreDetailPrintView";

type CierreRow = ReporteCierre & { totalContado?: number | null };
type CierreDiferenciaRow = Awaited<ReturnType<typeof getCierresDiferencias>>["data"][number];

interface Props {
  initialData: CierreRow[];
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

// --- Main component --------------------------------------------
export default function CierresReport({ initialData, usuarios }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoDiff, setTipoDiff] = useState("");
  const [isPending, startTransition] = useTransition();

  const [diferencias, setDiferencias] = useState<any[] | null>(null);
  const [expandedCierreId, setExpandedCierreId] = useState<number | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [printingCajaId, setPrintingCajaId] = useState<number | null>(null);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getReporteCierres(fechaDesde || undefined, fechaHasta || undefined, usuarioId, estadoFiltro || undefined);
      setData(result);
      setDiferencias(null);
    });
  };

  const loadSection = async (section: string, fetcher: () => Promise<unknown>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  };

  const handlePrintDetalle = useCallback((cajaId: number) => {
    setPrintingCajaId(cajaId);
  }, []);

  const handlePrint = () => {
    if (expandedCierreId) {
      handlePrintDetalle(expandedCierreId);
    } else {
      window.print();
    }
  };

  // Clean up after print dialog closes
  useEffect(() => {
    if (!printingCajaId) return;
    const handler = () => setPrintingCajaId(null);
    window.addEventListener("afterprint", handler);
    const fallback = setTimeout(handler, 30000);
    return () => {
      window.removeEventListener("afterprint", handler);
      clearTimeout(fallback);
    };
  }, [printingCajaId]);

  useEffect(() => {
    if (printSection) {
      setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
    }
  }, [printSection]);

  const cierresFiltrados = useMemo(() => {
    let c = data;
    if (tipoDiff === "positiva") c = c.filter((x: CierreRow) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d > 0; });
    if (tipoDiff === "negativa") c = c.filter((x: CierreRow) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d < 0; });
    return c;
  }, [data, tipoDiff]);

  const kpis = useMemo(() => {
    const c = cierresFiltrados;
    const total = c.length;
    const cerrados = c.filter((x: CierreRow) => x.estado === "CERRADA").length;
    const conDiff = c.filter((x: CierreRow) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d !== 0; }).length;
    const sumaDiff = c.reduce((s, x) => s + ((x.totalContado ?? x.totalEsperado) - x.totalEsperado), 0);
    return [
      { label: "Cierres", value: total.toString(), icon: <Wallet size={18} />, color: "indigo" as const },
      { label: "Cerrados", value: cerrados.toString(), icon: <CheckCircle size={18} />, color: "emerald" as const },
      { label: "Con Dif.", value: conDiff.toString(), icon: <TrendingUp size={18} />, color: "amber" as const },
      { label: "Dif. Neta", value: formatCurrency(sumaDiff), icon: <BadgePercent size={18} />, color: sumaDiff >= 0 ? "emerald" as const : "rose" as const },
    ];
  }, [cierresFiltrados]);

  const hasDiferencias = diferencias && diferencias.length > 0;
  const totalDiffAmount = diferencias
    ? diferencias.reduce((s, d) => s + Math.abs(d.diferencia ?? 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Search size={14} />Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div><label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Desde</label><input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" /></div>
          <div><label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><Calendar size={12} /> Hasta</label><input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" /></div>
          <div><label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1"><User size={12} /> Usuario</label>
            <select value={usuarioId || ""} onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos</option>
              {usuarios.map((u) => (<option key={u.id} value={u.id}>{u.nombreCompleto || u.username}</option>))}
            </select>
          </div>
          <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Estado</label>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos</option><option value="ABIERTA">Abiertos</option><option value="CERRADA">Cerrados</option>
            </select>
          </div>
          <div><label className="text-xs font-semibold text-slate-400 mb-1 block">Diferencia</label>
            <select value={tipoDiff} onChange={(e) => setTipoDiff(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todas</option><option value="positiva">Positivas</option><option value="negativa">Negativas</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch} disabled={isPending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />{isPending ? "Buscando..." : "Buscar"}
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div className={`${printingCajaId ? 'print:hidden' : ''} print:bg-white print:text-black space-y-4`}>
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-wide">CHOPPER REPUESTOS</h1>
          <p className="text-sm text-gray-600 mt-1">Informe de Cierres de Caja</p>
          <div className="flex justify-center gap-6 text-xs text-gray-500 mt-2">
            <span>Período: {fechaDesde} al {fechaHasta}</span>
            <span>Generado: {formatDate(new Date())}</span>
            <span>Usuario: {usuarios.find(u => u.id === usuarioId)?.nombreCompleto || "Todos"}</span>
          </div>
          <hr className="my-3 border-gray-300" />
        </div>

        <div className="report-section" data-section-id="kpis" data-print-active={printSection === "kpis" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("kpis")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => <StatCard key={i} {...kpi} />)}
          </div>
        </div>

        <div className="report-section" data-section-id="table" data-print-active={printSection === "table" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("table")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Apertura</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Cierre</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase">Usuario</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Inicial</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Ventas</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase">Esperado</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase print:hidden">Resultado</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase print:hidden">Det.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                {cierresFiltrados.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Sin cierres en el período.</td></tr>
                ) : cierresFiltrados.map((c: any) => (
                  <React.Fragment key={c.id}>
                    <tr className={`transition-colors ${expandedCierreId === c.id ? "bg-slate-800/20" : "hover:bg-slate-800/30"}`}>
                      <td className="px-4 py-3 font-bold text-white">#{c.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{c.fechaApertura}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{c.fechaCierre || "\u2014"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.usuario}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(c.montoInicial)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(c.totalVentas)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(c.montoInicial + c.totalVentas)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.estado === "ABIERTA" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-bold"><XCircle size={10} />ABIERTA</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold"><CheckCircle size={10} />CERRADA</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <ResultadoBadge totalContado={c.totalContado} totalEsperado={c.totalEsperado} />
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <button
                          onClick={() => setExpandedCierreId(prev => prev === c.id ? null : c.id)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition"
                          title={expandedCierreId === c.id ? "Ocultar detalle" : "Ver detalle"}
                        >
                          {expandedCierreId === c.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                    </tr>
                    {expandedCierreId === c.id && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <CierreAccordionRow cajaId={c.id} onPrint={handlePrintDetalle} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Secondary Sections (collapsible) */}
        <div className="report-section" data-section-id="secondary" data-print-active={printSection === "secondary" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("secondary")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>

          {/* Cierres con Diferencia */}
          <div className="mb-3">
            {diferencias === null ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Cierres con Diferencia
                  </h3>
                  <button onClick={() => loadSection("diff", () => getCierresDiferencias({ fechaDesde, fechaHasta, page: 1 }).then(r => setDiferencias(r.data)))} disabled={loadingSection === "diff"}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                    {loadingSection === "diff" ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                    {loadingSection === "diff" ? "Cargando..." : "Cargar"}
                  </button>
                </div>
              </div>
            ) : !hasDiferencias ? null : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Cierres con Diferencia
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">
                      <span className="font-bold text-white">{diferencias.length}</span> cierre{diferencias.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-slate-400">
                      Total dif.: <span className="font-bold text-amber-400">{formatCurrency(totalDiffAmount)}</span>
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <DataTable
                    columns={[
                      { header: "#", accessor: (r: CierreDiferenciaRow) => "#" + r.id },
                      { header: "Usuario", accessor: "usuario" },
                      { header: "Apertura", accessor: "fechaApertura" },
                      { header: "Esperado", accessor: (r: CierreDiferenciaRow) => formatCurrency(r.totalEsperado), className: "text-right font-mono" },
                      { header: "Contado", accessor: (r: CierreDiferenciaRow) => r.totalContado !== null ? formatCurrency(r.totalContado) : "\u2014", className: "text-right font-mono" },
                      { header: "Dif.", accessor: (r: CierreDiferenciaRow) => <span className={r.diferencia && r.diferencia >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{r.diferencia !== null ? formatCurrency(r.diferencia) : "\u2014"}</span>, className: "text-right" },
                    ]}
                    data={diferencias}
                    keyExtractor={(r: CierreDiferenciaRow) => r.id}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Diferencias Diarias & Métodos de Pago (collapsible) */}
          <button
            onClick={() => setShowSecondary(!showSecondary)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-300 hover:bg-slate-700/50 transition print:hidden"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              Información secundaria
            </span>
            {showSecondary ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          </button>

          {showSecondary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-400" />
                  Diferencias Diarias
                </h3>
                {cierresFiltrados.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No hay datos en el período seleccionado.</p>
                ) : (
                  <div className="space-y-2">
                    {cierresFiltrados.slice(0, 10).map((c) => {
                      const diff = (c.totalContado ?? c.totalEsperado) - c.totalEsperado;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-700/30">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">#{c.id}</span>
                            <span className="text-slate-400">{c.fechaApertura?.split(" ")[0]}</span>
                          </div>
                          <span className={diff === 0 ? "text-slate-500" : diff > 0 ? "text-emerald-400" : "text-rose-400"}>
                            {diff === 0 ? "Sin diff." : formatCurrency(diff)}
                          </span>
                        </div>
                      );
                    })}
                    {cierresFiltrados.length > 10 && (
                      <p className="text-xs text-slate-500 text-center pt-1">...y {cierresFiltrados.length - 10} más</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <DollarSign size={14} className="text-amber-400" />
                  Métodos de Pago
                </h3>
                <p className="text-xs text-slate-500 text-center py-6">Los métodos de pago se muestran en el informe de Finanzas.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {printingCajaId && (
        <CierreDetailPrintView
          cajaId={printingCajaId}
        />
      )}
    </div>
  );
}

