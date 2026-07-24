"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import { getReporteCierres, getDetalleCierre, getCierresDiferencias } from "@/actions/informes";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search, Calendar, User, RefreshCw, Wallet, Eye, X, Loader2,
  CheckCircle, XCircle, Printer, TrendingUp, TrendingDown,
  DollarSign, BadgePercent, ChevronDown, ChevronRight,
  Coins, ArrowUpRight, ArrowDownLeft, Lock, FileText,
  Clock, Hash, Info, AlertTriangle, Receipt,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";

interface Props {
  initialData: any[];
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

// ─── Shared detail content (used by modal AND print) ───────────
function CierreDetailView({ detalleData }: { detalleData: any }) {
  const ingresos = detalleData?.movimientos?.filter((m: any) => m.tipo === "INGRESO") || [];
  const egresos = detalleData?.movimientos?.filter((m: any) => m.tipo === "EGRESO") || [];
  const totalIngresos = ingresos.reduce((s: number, m: any) => s + m.monto, 0);
  const totalEgresos = egresos.reduce((s: number, m: any) => s + m.monto, 0);
  const resultadoNeto = totalIngresos - totalEgresos;

  return (
    <div className="space-y-6">
      {/* Metadata row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Calendar size={11} /> Apertura</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.fechaApertura}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Clock size={11} /> Cierre</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.fechaCierre || "\u2014"}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><User size={11} /> Usuario</p>
          <p className="text-sm font-bold text-white print:text-gray-900 mt-1">{detalleData.usuario}</p>
        </div>
        <div className="bg-slate-800/50 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300">
          <p className="text-[10px] font-bold text-slate-500 print:text-gray-600 uppercase tracking-wider flex items-center gap-1"><Info size={11} /> Estado</p>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-1 ${
            detalleData.estado === "ABIERTA"
              ? "bg-amber-500/10 text-amber-400 print:text-amber-700 print:bg-amber-100 border border-amber-500/20 print:border-amber-300"
              : "bg-emerald-500/10 text-emerald-400 print:text-emerald-700 print:bg-emerald-100 border border-emerald-500/20 print:border-emerald-300"
          }`}>
            {detalleData.estado === "ABIERTA" ? <XCircle size={12} /> : <CheckCircle size={12} />}
            {detalleData.estado}
          </span>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <Coins size={16} className="mx-auto mb-1 text-slate-400 print:text-gray-500" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Inicial</p>
          <p className="text-base font-bold text-white print:text-gray-900 font-mono">{formatCurrency(detalleData.montoInicial)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <ArrowUpRight size={16} className="mx-auto mb-1 text-emerald-400 print:text-emerald-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Ingresos</p>
          <p className="text-base font-bold text-emerald-400 print:text-emerald-600 font-mono">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <ArrowDownLeft size={16} className="mx-auto mb-1 text-rose-400 print:text-red-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Egresos</p>
          <p className="text-base font-bold text-rose-400 print:text-red-600 font-mono">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="bg-slate-800/40 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <Wallet size={16} className="mx-auto mb-1 text-sky-400 print:text-sky-600" />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Esperado</p>
          <p className="text-base font-bold text-sky-400 print:text-sky-600 font-mono">{formatCurrency(detalleData.totalEsperado)}</p>
        </div>
        <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/20 print:bg-gray-100 rounded-xl p-3.5 border border-slate-700/50 print:border-gray-300 text-center">
          <BadgePercent size={16} className={"mx-auto mb-1 " + (detalleData.diferencia !== null && detalleData.diferencia !== 0 ? "text-amber-400 print:text-amber-600" : "text-slate-400 print:text-gray-500")} />
          <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Diferencia</p>
          {detalleData.diferencia !== null ? (
            <p className={"text-base font-bold font-mono " + (detalleData.diferencia >= 0 ? "text-emerald-400 print:text-emerald-600" : "text-rose-400 print:text-red-600")}>
              {detalleData.diferencia > 0 ? "+" : ""}{formatCurrency(detalleData.diferencia)}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-500 print:text-gray-500 font-mono">\u2014</p>
          )}
        </div>
      </div>

      {/* Ingresos */}
      {ingresos.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-emerald-400 print:text-emerald-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <ArrowUpRight size={14} />
            Ingresos ({ingresos.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-emerald-500/10 print:border-emerald-300">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-emerald-500/5 print:bg-emerald-50 border-b border-emerald-500/10 print:border-emerald-300">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Hora</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Concepto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-emerald-300 print:text-emerald-700 uppercase tracking-wider">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/5 print:divide-emerald-200">
                {ingresos.map((m: any) => (
                  <tr key={m.id} className="hover:bg-emerald-500/5 print:hover:bg-transparent transition-colors">
                    <td className="px-3 py-2 text-slate-400 print:text-gray-600 font-mono">
                      {m.fecha?.split(" ")[1] || m.fecha}
                    </td>
                    <td className="px-3 py-2 text-white print:text-gray-900 font-medium truncate max-w-[200px]">{m.descripcion}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 print:text-emerald-700 font-bold font-mono">+{formatCurrency(m.monto)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 print:text-gray-500">@{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Egresos */}
      {egresos.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-rose-400 print:text-red-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <ArrowDownLeft size={14} />
            Egresos ({egresos.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-rose-500/10 print:border-red-300">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-rose-500/5 print:bg-red-50 border-b border-rose-500/10 print:border-red-300">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Hora</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Concepto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-rose-300 print:text-red-700 uppercase tracking-wider">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-500/5 print:divide-red-200">
                {egresos.map((m: any) => (
                  <tr key={m.id} className="hover:bg-rose-500/5 print:hover:bg-transparent transition-colors">
                    <td className="px-3 py-2 text-slate-400 print:text-gray-600 font-mono">
                      {m.fecha?.split(" ")[1] || m.fecha}
                    </td>
                    <td className="px-3 py-2 text-white print:text-gray-900 font-medium truncate max-w-[200px]">{m.descripcion}</td>
                    <td className="px-3 py-2 text-right text-rose-400 print:text-red-700 font-bold font-mono">-{formatCurrency(m.monto)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 print:text-gray-500">@{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ingresos.length === 0 && egresos.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Receipt size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Sin movimientos registrados</p>
          <p className="text-xs mt-1">Este cierre no tiene movimientos de ingresos ni egresos.</p>
        </div>
      )}

      {(ingresos.length > 0 || egresos.length > 0) && (
        <div className="bg-slate-800/30 print:bg-gray-100 border border-slate-700/50 print:border-gray-300 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-400 print:text-gray-700 uppercase tracking-wider mb-3">Resumen Final</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Cant. Ingresos</p>
              <p className="text-base font-bold text-emerald-400 print:text-emerald-700">{ingresos.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Cant. Egresos</p>
              <p className="text-base font-bold text-rose-400 print:text-red-700">{egresos.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Total Ingresos</p>
              <p className="text-base font-bold text-emerald-400 print:text-emerald-700 font-mono">{formatCurrency(totalIngresos)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 print:text-gray-600 font-semibold">Total Egresos</p>
              <p className="text-base font-bold text-rose-400 print:text-red-700 font-mono">{formatCurrency(totalEgresos)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50 print:border-gray-300 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 print:text-gray-700 uppercase tracking-wider">Resultado Neto</span>
            <span className={"text-lg font-black font-mono " + (resultadoNeto >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-rose-400 print:text-red-700")}>
              {resultadoNeto >= 0 ? "+" : ""}{formatCurrency(resultadoNeto)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Print-only view for a single cierre ───────────────────────
function CierreDetailPrintView({ cajaId }: {
  cajaId: number;
}) {
  const [detalleData, setDetalleData] = useState<any>(null);

  useEffect(() => {
    getDetalleCierre(cajaId).then((res: any) => setDetalleData(res));
  }, [cajaId]);

  useEffect(() => {
    if (detalleData) {
      const timer = setTimeout(() => window.print(), 150);
      return () => clearTimeout(timer);
    }
  }, [detalleData]);

  if (!detalleData) return null;

  return (
    <div className="hidden print:block print:bg-white print:text-black">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black uppercase tracking-wide">CHOPPER REPUESTOS</h1>
        <p className="text-sm text-gray-600 mt-1">Detalle de Cierre #{cajaId}</p>
        <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
          <span>Apertura: {detalleData.fechaApertura}</span>
          <span>Cierre: {detalleData.fechaCierre || "\u2014"}</span>
          <span>Usuario: {detalleData.usuario}</span>
          <span>Impreso: {formatDate(new Date())}</span>
        </div>
        <hr className="my-3 border-gray-300" />
      </div>
      <CierreDetailView detalleData={detalleData} />
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────
function DetalleCierreModal({ cajaId, onClose, onPrint }: {
  cajaId: number;
  onClose: () => void;
  onPrint: (id: number) => void;
}) {
  const [detalleData, setDetalleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDetalleCierre(cajaId).then((res: any) => { setDetalleData(res); setLoading(false); });
  }, [cajaId]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet size={18} className="text-sky-400" />
            Cierre #{cajaId}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-slate-400" /></div>
          ) : detalleData ? (
            <CierreDetailView detalleData={detalleData} />
          ) : (
            <p className="text-center text-red-400 py-8">Error al cargar detalle.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => onPrint(cajaId)}
            disabled={loading || !detalleData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
          >
            <Printer size={14} />
            Imprimir cierre
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────
export default function CierresReport({ initialData, usuarios, userRole }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoDiff, setTipoDiff] = useState("");
  const [isPending, startTransition] = useTransition();

  const [diferencias, setDiferencias] = useState<any[] | null>(null);
  const [detalleCajaId, setDetalleCajaId] = useState<number | null>(null);
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

  const loadSection = async (section: string, fetcher: () => Promise<any>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  };

  const handlePrintDetalle = useCallback((cajaId: number) => {
    setPrintingCajaId(cajaId);
    setDetalleCajaId(null);
  }, []);

  const handlePrint = () => {
    if (detalleCajaId) {
      handlePrintDetalle(detalleCajaId);
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
    let c = data as any[];
    if (tipoDiff === "positiva") c = c.filter((x: any) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d > 0; });
    if (tipoDiff === "negativa") c = c.filter((x: any) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d < 0; });
    return c;
  }, [data, tipoDiff]);

  const kpis = useMemo(() => {
    const c = cierresFiltrados;
    const total = c.length;
    const cerrados = c.filter((x: any) => x.estado === "CERRADA").length;
    const conDiff = c.filter((x: any) => { const d = ((x.totalContado ?? x.totalEsperado) - x.totalEsperado); return d !== 0; }).length;
    const sumaDiff = c.reduce((s: number, x: any) => s + ((x.totalContado ?? x.totalEsperado) - x.totalEsperado), 0);
    return [
      { label: "Cierres", value: total.toString(), icon: <Wallet size={18} />, color: "indigo" as const },
      { label: "Cerrados", value: cerrados.toString(), icon: <CheckCircle size={18} />, color: "emerald" as const },
      { label: "Con Dif.", value: conDiff.toString(), icon: <TrendingUp size={18} />, color: "amber" as const },
      { label: "Dif. Neta", value: formatCurrency(sumaDiff), icon: <BadgePercent size={18} />, color: sumaDiff >= 0 ? "emerald" as const : "rose" as const },
    ];
  }, [cierresFiltrados]);

  const hasDiferencias = diferencias && diferencias.length > 0;
  const totalDiffAmount = diferencias
    ? diferencias.reduce((s: number, d: any) => s + Math.abs(d.diferencia ?? 0), 0)
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
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase print:hidden">Det.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                {cierresFiltrados.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Sin cierres en el período.</td></tr>
                ) : cierresFiltrados.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
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
                      <button onClick={() => setDetalleCajaId(c.id)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition" title="Ver detalle"><Eye size={14} /></button>
                    </td>
                  </tr>
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
                      { header: "#", accessor: (r: any) => "#" + r.id },
                      { header: "Usuario", accessor: "usuario" },
                      { header: "Apertura", accessor: "fechaApertura" },
                      { header: "Esperado", accessor: (r: any) => formatCurrency(r.totalEsperado), className: "text-right font-mono" },
                      { header: "Contado", accessor: (r: any) => r.totalContado !== null ? formatCurrency(r.totalContado) : "\u2014", className: "text-right font-mono" },
                      { header: "Dif.", accessor: (r: any) => <span className={r.diferencia && r.diferencia >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{r.diferencia !== null ? formatCurrency(r.diferencia) : "\u2014"}</span>, className: "text-right" },
                    ]}
                    data={diferencias}
                    keyExtractor={(r: any) => r.id}
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
                    {cierresFiltrados.slice(0, 10).map((c: any) => {
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

      {detalleCajaId && (
        <DetalleCierreModal
          cajaId={detalleCajaId}
          onClose={() => setDetalleCajaId(null)}
          onPrint={handlePrintDetalle}
        />
      )}

      {printingCajaId && (
        <CierreDetailPrintView
          cajaId={printingCajaId}
        />
      )}
    </div>
  );
}
