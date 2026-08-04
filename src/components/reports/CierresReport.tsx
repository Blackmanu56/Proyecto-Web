"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import {
  getReporteCierres,
  getCierresMensuales,
  getCierresDelMes,
} from "@/actions/informes";
import type { ReporteCierre, CierreMensual } from "@/actions/informes";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCierresDateRange, toApiDate } from "@/lib/reportPeriods";
import type { PeriodoPreset } from "@/lib/reportPeriods";
import {
  Search, Calendar, User, RefreshCw, Eye, ChevronUp, Loader2,
  CheckCircle, XCircle, Printer,
  ChevronDown, History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ResultadoBadge from "./ResultadoBadge";
import CierreAccordionRow from "./CierreAccordionRow";
import CierreDetailPrintView from "./CierreDetailPrintView";

type CierreRow = ReporteCierre;
type VistaCierres = "diario" | "mensual";
type PeriodoSeleccion = PeriodoPreset | "personalizado";

// Períodos incompatibles con la vista mensual: la info ya viene agrupada por mes.
const PERIOD_INCOMPATIBLE_MENSUAL: PeriodoSeleccion[] = ["dia", "semana", "mes"];

const PERIOD_OPTIONS: { value: PeriodoSeleccion; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
  { value: "personalizado", label: "Personalizado" },
];

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

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
            <th className="text-right px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Total</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Estado</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider print:hidden">Resultado</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider print:hidden">Det.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border print:divide-gray-300">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-text-secondary">
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
                  <td colSpan={10} className="p-0">
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
  const [isPending, startTransition] = useTransition();

  const [expandedCierreId, setExpandedCierreId] = useState<number | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);
  const [printingCajaId, setPrintingCajaId] = useState<number | null>(null);

  // Filtros colapsables (mismo patrón que VentasReport)
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    // Punto 4: al pasar a mensual, si el período activo es incompatible
    // (Día/Semana/Mes), se adapta automáticamente a Año.
    if (v === "mensual" && PERIOD_INCOMPATIBLE_MENSUAL.includes(activePeriod)) {
      setActivePeriod("anio");
      const range = getCierresDateRange("anio");
      const desde = range.desde.slice(0, 10);
      const hasta = range.hasta.slice(0, 10);
      setFechaDesde(desde);
      setFechaHasta(hasta);
      runSearch(desde, hasta);
      loadMensual(desde, hasta);
      return;
    }
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
      // Expansión con la misma lógica que el resumen: cerradas por mes de cierre,
      // abiertas (fecha_cierre null) por mes de apertura.
      const rows = await getCierresDelMes(mes);
      setExpandedMesRows(rows);
    } catch {
      setMesError(true);
    } finally {
      setLoadingMes(false);
    }
  };

  const handlePrintDetalle = useCallback((cajaId: number) => {
    setPrintingCajaId(cajaId);
  }, []);

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
    const c = data;
    return c;
  }, [data]);

  const kpis = useMemo(() => {
    const c = cierresFiltrados;
    const total = c.length;
    const cerrados = c.filter((x: CierreRow) => x.estado === "CERRADA").length;
    return [
      { label: "Arqueos", value: total.toString() },
      { label: "Cerrados", value: cerrados.toString() },
    ];
  }, [cierresFiltrados]);

  return (
    <div>
      {/* ─── Barra de filtros colapsable (mismo patrón que VentasReport) ─── */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
        {/* Fila superior: toggle + período + vista */}
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 hover:text-[var(--text)] transition-colors shrink-0"
          >
            <Search size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-muted)]">
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
            </span>
            {filtersOpen ? (
              <ChevronUp size={14} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            )}
          </button>

          <div className="h-4 w-px bg-[var(--border)] shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <Calendar size={14} className="text-[var(--text-muted)]" />
            <span className="text-xs font-semibold text-[var(--text-muted)]">Período:</span>
            <Select
              value={activePeriod}
              onValueChange={(v) => handlePeriodChange(v as PeriodoSeleccion)}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={vista === "mensual" && PERIOD_INCOMPATIBLE_MENSUAL.includes(opt.value)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 shrink-0">
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

        {/* Contenido colapsable */}
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setActivePeriod("personalizado");
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setActivePeriod("personalizado");
                  }}
                  className={inputClass}
                />
              </div>

              {vista === "diario" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <User size={12} /> Usuario
                    </label>
                    <select
                      value={usuarioId ? String(usuarioId) : ""}
                      onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)}
                      className={inputClass}
                    >
                      <option value="">Todas las cajas</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>{u.nombreCompleto || u.username}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <CheckCircle size={12} /> Estado
                    </label>
                    <select
                      value={estadoFiltro}
                      onChange={(e) => setEstadoFiltro(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Todos</option>
                      <option value="ABIERTA">Abiertos</option>
                      <option value="CERRADA">Cerrados</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSearch}
                disabled={isPending}
                className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                {isPending ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${printingCajaId ? 'print:hidden' : ''} print:bg-white print:text-black space-y-2`}>
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
            <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Resumen</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Arqueos</div>
                  <div className="text-sm font-bold text-[var(--text)]">{kpis[0].value}</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Cerrados</div>
                  <div className="text-sm font-bold text-[var(--text)]">{kpis[1].value}</div>
                </div>
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
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[var(--panel)] rounded-xl border border-[var(--border)] animate-pulse">
                    <div className="h-12 bg-[var(--card)] rounded-xl m-1" />
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
              <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Mes</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Arqueos</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Inicial</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Ventas</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider print:hidden">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                      {mensualData.map((m) => (
                        <React.Fragment key={m.mes}>
                          <tr className={`transition-colors ${expandedMes === m.mes ? "bg-[var(--panel)]/60" : "hover:bg-[var(--border)]/40"}`}>
                            <td className="px-4 py-3 font-bold text-[var(--text)] whitespace-nowrap">
                              {m.mesLabel} {m.anio}
                              {m.conDiferencia > 0 && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/15 text-[var(--warning)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                  Con dif.
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-[var(--text-muted)]">{m.totalCierres}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-muted)]">{formatCurrency(m.montoInicial)}</td>
                            <td className="px-4 py-3 text-right font-bold text-[var(--success)]">{formatCurrency(m.totalVentas)}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-muted)]">{formatCurrency(m.totalEsperado)}</td>
                            <td className="px-4 py-3 text-center print:hidden">
                              <button
                                onClick={() => toggleMes(m.mes)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--border)]/50 transition-colors"
                              >
                                {expandedMes === m.mes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {expandedMes === m.mes ? "Ocultar" : "Ver arqueos"}
                              </button>
                            </td>
                          </tr>
                          {expandedMes === m.mes && (
                            <tr>
                              <td colSpan={6} className="p-0 bg-[var(--panel)]/40 print:bg-white">
                                <div className="px-4 py-4">
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
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {printingCajaId && (
        <CierreDetailPrintView
          cajaId={printingCajaId}
        />
      )}
    </div>
  );
}
