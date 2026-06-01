"use client";

import React, { useState, useTransition, useMemo } from "react";
import { getReporteCierres, getDetalleCierre, getCierresMovimientos, getCierresDiferencias } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search, Calendar, User, RefreshCw, Wallet, Eye, X, Loader2,
  CheckCircle, XCircle, Printer, TrendingUp, TrendingDown,
  DollarSign, BadgePercent,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart as RePie, Pie, Cell } from "recharts";

interface Props {
  initialData: any[];
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

export default function CierresReport({ initialData, usuarios, userRole }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoDiff, setTipoDiff] = useState("");
  const [isPending, startTransition] = useTransition();

  const [movimientos, setMovimientos] = useState<any[] | null>(null);
  const [diferencias, setDiferencias] = useState<any[] | null>(null);
  const [detalleCajaId, setDetalleCajaId] = useState<number | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getReporteCierres(fechaDesde || undefined, fechaHasta || undefined, usuarioId, estadoFiltro || undefined);
      setData(result);
      setMovimientos(null); setDiferencias(null);
    });
  };

  const loadSection = async (section: string, fetcher: () => Promise<any>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  };

  const handlePrint = () => window.print();

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

      <div className="print:bg-white print:text-black space-y-4">
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Cierres de Caja</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi, i) => <StatCard key={i} {...kpi} />)}
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="Diferencias Diarias" height={250}>
            <BarChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Bar dataKey="diferencia" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrapper>
          <ChartWrapper title="Métodos de Pago" height={250}>
            <RePie>
              <Pie data={[]} dataKey="value" cx="50%" cy="50%" outerRadius={80} label>
                <Cell fill={CHART_COLORS[0]} />
              </Pie>
            </RePie>
          </ChartWrapper>
        </div>

        {/* Data Sections */}
        <div className="grid grid-cols-1 gap-4">
          {!movimientos ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Movimientos de Caja</h3>
                <button onClick={() => loadSection("mov", () => getCierresMovimientos({ fechaDesde, fechaHasta, page: 1 }).then(r => setMovimientos(r.data)))} disabled={loadingSection === "mov"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                  {loadingSection === "mov" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Movimientos de Caja</h3>
              <DataTable columns={[{ header: "Fecha", accessor: "fecha" }, { header: "Tipo", accessor: (r: any) => <span className={r.tipo === "INGRESO" ? "text-emerald-400" : "text-rose-400"}>{r.tipo}</span> }, { header: "Monto", accessor: (r: any) => formatCurrency(r.monto), className: "text-right" }, { header: "Descripción", accessor: "descripcion" }, { header: "Usuario", accessor: "usuario" }]} data={movimientos} keyExtractor={(r: any) => r.id} />
            </div>
          )}

          {!diferencias ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Cierres con Diferencias</h3>
                <button onClick={() => loadSection("diff", () => getCierresDiferencias({ fechaDesde, fechaHasta, page: 1 }).then(r => setDiferencias(r.data)))} disabled={loadingSection === "diff"}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
                  {loadingSection === "diff" ? "Cargando..." : "Cargar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Cierres con Diferencias</h3>
              <DataTable columns={[{ header: "#", accessor: (r: any) => "#" + r.id }, { header: "Usuario", accessor: "usuario" }, { header: "Esperado", accessor: (r: any) => formatCurrency(r.totalEsperado), className: "text-right" }, { header: "Contado", accessor: (r: any) => r.totalContado !== null ? formatCurrency(r.totalContado) : "\u2014", className: "text-right" }, { header: "Dif.", accessor: (r: any) => <span className={r.diferencia && r.diferencia >= 0 ? "text-emerald-400" : "text-rose-400"}>{r.diferencia !== null ? formatCurrency(r.diferencia) : "\u2014"}</span>, className: "text-right" }]} data={diferencias} keyExtractor={(r: any) => r.id} />
            </div>
          )}
        </div>
      </div>

      {detalleCajaId && <DetalleCierreModal cajaId={detalleCajaId} onClose={() => setDetalleCajaId(null)} />}
    </div>
  );
}

function DetalleCierreModal({ cajaId, onClose }: { cajaId: number; onClose: () => void }) {
  const [detalleData, setDetalleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    getDetalleCierre(cajaId).then((res: any) => { setDetalleData(res); setLoading(false); });
  }, [cajaId]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Wallet size={18} className="text-sky-400" /> Cierre #{cajaId}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"><X size={16} /></button>
        </div>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
          ) : detalleData ? (
            <>
              <div className="grid grid-cols-2 gap-3 bg-slate-800/50 rounded-xl p-4 text-sm">
                <div><p className="text-xs text-slate-400">Apertura</p><p className="text-white font-bold">{detalleData.fechaApertura}</p></div>
                <div><p className="text-xs text-slate-400">Cierre</p><p className="text-white font-bold">{detalleData.fechaCierre || "\u2014"}</p></div>
                <div><p className="text-xs text-slate-400">Usuario</p><p className="text-white font-bold">{detalleData.usuario}</p></div>
                <div><p className="text-xs text-slate-400">Estado</p><span className={detalleData.estado === "ABIERTA" ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>{detalleData.estado}</span></div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-slate-800/30 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-400">Inicial</p><p className="text-sm font-bold text-white">{formatCurrency(detalleData.montoInicial)}</p></div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-400">Ventas</p><p className="text-sm font-bold text-emerald-400">{formatCurrency(detalleData.totalVentas)}</p></div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-400">Esperado</p><p className="text-sm font-bold text-sky-400">{formatCurrency(detalleData.totalEsperado)}</p></div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-400">Contado</p><p className="text-sm font-bold text-white">{detalleData.totalContado !== null ? formatCurrency(detalleData.totalContado) : "\u2014"}</p></div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-400">Dif.</p>{detalleData.diferencia !== null ? <p className={"text-sm font-bold " + (detalleData.diferencia >= 0 ? "text-emerald-400" : "text-red-400")}>{detalleData.diferencia >= 0 ? "+" : ""}{formatCurrency(detalleData.diferencia)}</p> : <p className="text-sm font-bold text-slate-500 italic">\u2014</p>}</div>
              </div>
              {detalleData.movimientos?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Movimientos</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detalleData.movimientos.map((m: any) => (
                      <div key={m.id} className="flex justify-between items-center bg-slate-800/20 rounded-lg px-3 py-2 text-sm">
                        <div><p className="text-xs text-slate-400">{m.fecha}</p><p className="text-white font-medium truncate">{m.descripcion || m.tipo}</p></div>
                        <p className={"font-bold ml-2 " + (m.tipo === "EGRESO" ? "text-red-400" : "text-emerald-400")}>{m.tipo === "EGRESO" ? "-" : "+"}{formatCurrency(m.monto)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : <p className="text-center text-red-400 py-8">Error al cargar detalle.</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
