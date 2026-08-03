"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import {
  getReporteCierres,
  getCierresDiferencias,
  getCierresMensuales,
} from "@/actions/informes";
import type { ReporteCierre, CierreMensual } from "@/actions/informes";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCierresDateRange, toApiDate } from "@/lib/reportPeriods";
import type { PeriodoPreset } from "@/lib/reportPeriods";
import {
  Search, Calendar, User, RefreshCw, Wallet, Eye, ChevronUp, Loader2,
  CheckCircle, XCircle, Printer, TrendingUp,
  DollarSign, BadgePercent, ChevronDown, ChevronRight,
  FileText, AlertTriangle, History,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ResultadoBadge from "./ResultadoBadge";
import CierreAccordionRow from "./CierreAccordionRow";
import CierreDetailPrintView from "./CierreDetailPrintView";

type CierreRow = ReporteCierre;
type CierreDiferenciaRow = Awaited<ReturnType<typeof getCierresDiferencias>>["data"][number];
type VistaCierres = "diario" | "mensual";
type PeriodoSeleccion = PeriodoPreset | "personalizado";

const PERIOD_OPTIONS: { value: PeriodoSeleccion; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
  { value: "personalizado", label: "Personalizado" },
];

interface Props {
  initialData: CierreRow[];
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

/* ─── Tabla de cierres (compartida: vista diaria y expansión mensual) ────── */
function CierresTable({
  rows,
  expandedCierreId,
  onToggle,
  onPrint,
  emptyMessage = "Sin cierres en el período.",
}: {
  rows: CierreRow[];
  expandedCierreId: number | null;
  onToggle: (id: number) => void;
  onPrint: (id: number) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border print:border-gray-300 bg-panel print:bg-gray-100">
            <th className="text-left px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">#</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Apertura</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Cierre</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Usuario</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Inicial</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Ventas</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Esperado</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Total contado</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Estado</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider print:hidden">Resultado</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider print:hidden">Det.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border print:divide-gray-300">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((c) => (
            <React.Fragment key={c.id}>
              <tr className={`transition-colors ${expandedCierreId === c.id ? "bg-panel/50" : "hover:bg-border/40"}`}>
                <td className="px-4 py-3 font-bold text-text">#{c.id}</td>
                <td className="px-4 py-3 text-xs text-text-muted">{c.fechaApertura}</td>
                <td className="px-4 py-3 text-xs text-text-muted">{c.fechaCierre || "\u2014"}</td>
                <td className="px-4 py-3 text-text-muted">{c.usuario}</td>
                <td className="px-4 py-3 text-right text-text-muted">{formatCurrency(c.montoInicial)}</td>
                <td className="px-4 py-3 text-right font-bold text-success">{formatCurrency(c.totalVentas)}</td>
                <td className="px-4 py-3 text-right text-text-muted">{formatCurrency(c.totalEsperado)}</td>
                <td className="px-4 py-3 text-right text-text-muted">{c.totalContado != null ? formatCurrency(c.totalContado) : "\u2014"}</td>
                <td className="px-4 py-3 text-center">
                  {c.estado === "ABIERTA" ? (
                    <Badge variant="warning" size="sm"><XCircle size={10} />ABIERTA</Badge>
                  ) : (
                    <Badge variant="success" size="sm"><CheckCircle size={10} />CERRADA</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-center print:hidden">
                  <ResultadoBadge totalContado={c.totalContado} totalEsperado={c.totalEsperado} />
                </td>
                <td className="px-4 py-3 text-center print:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(c.id)}
                    className="h-8 w-8 p-0"
                    title={expandedCierreId === c.id ? "Ocultar detalle" : "Ver detalle"}
                  >
                    {expandedCierreId === c.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                  </Button>
                </td>
              </tr>
              {expandedCierreId === c.id && (
                <tr>
                  <td colSpan={11} className="p-0">
                    <CierreAccordionRow cajaId={c.id} onPrint={onPrint} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────── */
export default function CierresReport({ initialData, usuarios }: Props) {
  const [data, setData] = useState(initialData);
  // Estado con fechas SOLO date-only ("yyyy-MM-dd") para binding de <Input type="date">.
  // Cada llamada al servidor normaliza con toApiDate → "yyyy-MM-ddT00:00:00" (F1: NUNCA
  // toISOString/UTC). Carga inicial = preset Día (hoy), preservando los datos precargados.
  const [fechaDesde, setFechaDesde] = useState(() => getCierresDateRange("dia").desde.slice(0, 10));
  const [fechaHasta, setFechaHasta] = useState(() => getCierresDateRange("dia").hasta.slice(0, 10));
  const [activePeriod, setActivePeriod] = useState<PeriodoSeleccion>("dia");
  const [vista, setVista] = useState<VistaCierres>("diario");
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoDiff, setTipoDiff] = useState("");
  const [isPending, startTransition] = useTransition();

  const [diferencias, setDiferencias] = useState<CierreDiferenciaRow[] | null>(null);
  const [expandedCierreId, setExpandedCierreId] = useState<number | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [printingCajaId, setPrintingCajaId] = useState<number | null>(null);

  // Vista mensual
  const [mensualData, setMensualData] = useState<CierreMensual[] | null>(null);
  const [loadingMensual, setLoadingMensual] = useState(false);
  const [mensualError, setMensualError] = useState(false);
  const [expandedMes, setExpandedMes] = useState<string | null>(null);
  const [expandedMesRows, setExpandedMesRows] = useState<CierreRow[] | null>(null);
  const [loadingMes, setLoadingMes] = useState(false);
  const [mesError, setMesError] = useState(false);

  // Búsqueda diaria. F1: las fechas cruzan el límite servidor como datetime local
  // completo sin Z (toApiDate). Preserva filtros Usuario/Estado en cada búsqueda.
  const runSearch = (desde?: string, hasta?: string) => {
    startTransition(async () => {
      const result = await getReporteCierres(toApiDate(desde), toApiDate(hasta), usuarioId, estadoFiltro || undefined);
      setData(result);
      setDiferencias(null);
    });
  };

  const loadMensual = async (desde?: string, hasta?: string) => {
    setLoadingMensual(true);
    setMensualError(false);
    try {
      const result = await getCierresMensuales(toApiDate(desde), toApiDate(hasta), usuarioId);
      setMensualData(result);
      setExpandedMes(null);
      setExpandedMesRows(null);
    } catch {
      setMensualError(true);
    } finally {
      setLoadingMensual(false);
    }
  };

  const handleSearch = () => {
    runSearch(fechaDesde, fechaHasta);
    if (vista === "mensual") loadMensual(fechaDesde, fechaHasta);
  };

  const handlePeriodChange = (period: PeriodoSeleccion) => {
    setActivePeriod(period);
    if (period === "personalizado") return; // el usuario elige Desde/Hasta y presiona Buscar
    const range = getCierresDateRange(period);
    const desde = range.desde.slice(0, 10);
    const hasta = range.hasta.slice(0, 10);
    setFechaDesde(desde);
    setFechaHasta(hasta);
    runSearch(desde, hasta);
    if (vista === "mensual") loadMensual(desde, hasta);
  };

  const handleVistaChange = (v: VistaCierres) => {
    setVista(v);
    if (v === "mensual" && mensualData === null && !loadingMensual) {
      loadMensual(fechaDesde, fechaHasta);
    }
  };

  const toggleMes = async (mes: string) => {
    if (expandedMes === mes) {
      setExpandedMes(null);
      setExpandedMesRows(null);
      return;
    }
    setExpandedMes(mes);
    setExpandedMesRows(null);
    setLoadingMes(true);
    setMesError(false);
    try {
      // NOTA — nuance fecha_cierre vs fechaApertura: getCierresMensuales agrupa por
      // fecha_cierre, pero la expansión reutiliza getReporteCierres, que filtra por
      // fechaApertura (queries existentes, no alterables por spec). Una caja abierta
      // el 31 a las 23:50 y cerrada el 1 a las 00:10 se resume bajo el mes de cierre
      // (ej. 2026-08) pero su arqueo aparece en la expansión del mes anterior (2026-07).
      // Fin de mes real: día 0 del mes siguiente = último día (nunca `${mes}-31` literal;
      // un literal 31 desbordaría a Mar 3 en febrero).
      const anio = Number(mes.slice(0, 4));
      const mesNum = Number(mes.slice(5, 7));
      const ultimoDia = new Date(anio, mesNum, 0).getDate();
      const rows = await getReporteCierres(
        `${mes}-01T00:00:00`,
        `${mes}-${ultimoDia}T00:00:00`,
        usuarioId
      );
      setExpandedMesRows(rows);
    } catch {
      setMesError(true);
    } finally {
      setLoadingMes(false);
    }
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
      {/* ─── Tarjeta de filtros + presets de período (print:hidden) ─── */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-bold text-[var(--text-muted)] flex items-center gap-2">
            <Search size={14} />Filtros
          </h3>
          <div className="flex items-center gap-1">
            {(["diario", "mensual"] as VistaCierres[]).map((v) => (
              <button
                key={v}
                onClick={() => handleVistaChange(v)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  vista === v
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                }`}
              >
                {v === "diario" ? "Diario" : "Mensual"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
            <Calendar size={12} /> Período:
          </label>
          <Select value={activePeriod} onValueChange={(v) => handlePeriodChange(v as PeriodoSeleccion)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {activePeriod === "personalizado" && (
            <>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Desde
                </label>
                <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Hasta
                </label>
                <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
              </div>
            </>
          )}

          {vista === "diario" && (
            <>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <User size={12} /> Usuario
                </label>
                <Select value={usuarioId ? String(usuarioId) : "all"} onValueChange={(v) => setUsuarioId(v === "all" ? undefined : Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las cajas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cajas</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.nombreCompleto || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <CheckCircle size={12} /> Estado
                </label>
                <Select value={estadoFiltro || "all"} onValueChange={(v) => setEstadoFiltro(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ABIERTA">Abiertos</SelectItem>
                    <SelectItem value="CERRADA">Cerrados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <BadgePercent size={12} /> Diferencia
                </label>
                <Select value={tipoDiff || "all"} onValueChange={(v) => setTipoDiff(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="positiva">Positivas</SelectItem>
                    <SelectItem value="negativa">Negativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSearch} disabled={isPending} loading={isPending} leftIcon={<RefreshCw size={14} />}>
            {isPending ? "Buscando..." : "Buscar"}
          </Button>
          <Button variant="secondary" onClick={handlePrint} leftIcon={<Printer size={14} />}>
            Imprimir
          </Button>
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

        {vista === "diario" ? (
          <>
            <div className="report-section" data-section-id="kpis" data-print-active={printSection === "kpis" || null}>
              <div className="flex items-center justify-end mb-2 print:hidden">
                <button onClick={() => setPrintSection("kpis")}
                  className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
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
                  className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
                  title="Imprimir esta sección">
                  <Printer size={12} />
                </button>
              </div>
              <div className="bg-card print:bg-white border border-border print:border-gray-300 rounded-xl overflow-hidden">
                <CierresTable
                  rows={cierresFiltrados}
                  expandedCierreId={expandedCierreId}
                  onToggle={(id) => setExpandedCierreId(prev => (prev === id ? null : id))}
                  onPrint={handlePrintDetalle}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="report-section" data-section-id="mensual" data-print-active={printSection === "mensual" || null}>
            <div className="flex items-center justify-between mb-2 print:hidden">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <History size={14} className="text-[var(--brand)]" /> Resumen Mensual
              </h3>
              <button onClick={() => setPrintSection("mensual")}
                className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
                title="Imprimir esta sección">
                <Printer size={12} />
              </button>
            </div>

            {loadingMensual ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
                    <div className="h-4 bg-[var(--card)] rounded w-1/3 mb-4" />
                    <div className="h-24 bg-[var(--card)] rounded" />
                  </div>
                ))}
              </div>
            ) : mensualError ? (
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--danger)]">
                Error al cargar los cierres mensuales.
              </div>
            ) : mensualData === null ? (
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--text-secondary)]">
                Sin cierres en este mes
              </div>
            ) : mensualData.length === 0 ? (
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--text-secondary)]">
                Sin cierres en este mes
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {mensualData.map((m) => (
                  <div key={m.mes} className="p-3 bg-[var(--panel)]/50 border border-[var(--border)] rounded-xl space-y-2 hover:border-[var(--border-hover)] transition-all print:bg-white print:border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-[var(--text)]">{m.mesLabel} {m.anio}</span>
                      <Badge variant={m.conDiferencia > 0 ? "warning" : "success"} size="sm">
                        {m.totalCierres} cierre{m.totalCierres !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-[var(--text-muted)] sm:grid-cols-4 xl:grid-cols-7">
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Cierres</span>
                        <span className="font-semibold text-[var(--text)]">{m.totalCierres}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Inicial</span>
                        <span className="font-semibold text-[var(--text)]">{formatCurrency(m.montoInicial)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Ventas</span>
                        <span className="font-semibold text-[var(--success)]">{formatCurrency(m.totalVentas)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Esperado</span>
                        <span className="font-semibold text-[var(--text)]">{formatCurrency(m.totalEsperado)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Contado</span>
                        <span className="font-semibold text-[var(--text)]">{formatCurrency(m.totalContado)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Dif. Neta</span>
                        <span className={`font-semibold ${m.diferenciaNeta >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{formatCurrency(m.diferenciaNeta)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-wider">Con Dif.</span>
                        <span className="font-semibold text-[var(--text)]">{m.conDiferencia}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs">
                      <button
                        onClick={() => toggleMes(m.mes)}
                        className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors font-semibold print:hidden"
                      >
                        {expandedMes === m.mes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expandedMes === m.mes ? "Ocultar arqueos" : "Ver arqueos"}
                      </button>
                      <span className="text-[var(--text-secondary)]">{m.totalCierres} arqueo{m.totalCierres !== 1 ? "s" : ""}</span>
                    </div>
                    {expandedMes === m.mes && (
                      <div className="pt-2 border-t border-[var(--border)]/60">
                        {loadingMes ? (
                          <div className="flex justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-[var(--text-secondary)]" />
                          </div>
                        ) : mesError ? (
                          <p className="text-center text-[var(--danger)] py-6 text-sm">Error al cargar los arqueos del mes.</p>
                        ) : expandedMesRows ? (
                          <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
                            <CierresTable
                              rows={expandedMesRows}
                              expandedCierreId={expandedCierreId}
                              onToggle={(id) => setExpandedCierreId(prev => (prev === id ? null : id))}
                              onPrint={handlePrintDetalle}
                              emptyMessage="Sin cierres en este mes"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Secondary Sections (collapsible) */}
        <div className="report-section" data-section-id="secondary" data-print-active={printSection === "secondary" || null}>
          <div className="flex items-center justify-end mb-2 print:hidden">
            <button onClick={() => setPrintSection("secondary")}
              className="p-1.5 rounded-lg bg-border text-text-muted hover:text-emerald-400 hover:bg-border-hover transition print:hidden"
              title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>

          {/* Cierres con Diferencia */}
          <div className="mb-3">
            {diferencias === null ? (
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-muted flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Cierres con Diferencia
                  </h3>
                  <button onClick={() => loadSection("diff", () => getCierresDiferencias({ fechaDesde, fechaHasta, page: 1 }).then(r => setDiferencias(r.data)))} disabled={loadingSection === "diff"}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-border text-text-muted hover:bg-border-hover disabled:opacity-40 transition">
                    {loadingSection === "diff" ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                    {loadingSection === "diff" ? "Cargando..." : "Cargar"}
                  </button>
                </div>
              </div>
            ) : !hasDiferencias ? null : (
              <div className="bg-panel border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-panel border-b border-border">
                  <h3 className="text-xs font-bold text-text-muted uppercase flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Cierres con Diferencia
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-text-muted">
                      <span className="font-bold text-text">{diferencias.length}</span> cierre{diferencias.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-text-muted">
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

          {/* Métodos de Pago (collapsible) — "Diferencias Diarias" removida (REQ-R1) */}
          <button
            onClick={() => setShowSecondary(!showSecondary)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card rounded-xl border border-border text-sm font-semibold text-text-muted hover:bg-border/50 transition print:hidden"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-text-muted" />
              Información secundaria
            </span>
            {showSecondary ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          </button>

          {showSecondary && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-xs font-bold text-text-muted uppercase mb-3 flex items-center gap-2">
                  <DollarSign size={14} className="text-amber-400" />
                  Métodos de Pago
                </h3>
                <p className="text-xs text-text-secondary text-center py-6">Los métodos de pago se muestran en el informe de Finanzas.</p>
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
