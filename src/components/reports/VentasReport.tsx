"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getReporteVentas,
  getEvolucionVentas,
  getVentasAnalisisBatch,
} from "@/actions/informes";
import { parse } from "date-fns";
import { Search, Calendar, User, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AnalisisView from "./AnalisisView";
import DetalleView from "./DetalleView";
import {
  DEFAULT_SORT_DIR,
  type AnalisisCache,
  type ChartGranularity,
  type SortDir,
  type SortKey,
  type VentasReportData,
} from "./ventasShared";
import {
  getPreviousWindow,
  getVentasDateRange,
  type ReporteVentasPeriodKey,
} from "@/lib/reportPeriods";

type SubViewId = "analisis" | "detalle";

const PERIOD_OPTIONS: { key: ReporteVentasPeriodKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "mes", label: "Este mes" },
  { key: "mes_anterior", label: "Mes anterior" },
  { key: "anio", label: "Este año" },
  { key: "personalizado", label: "Personalizado" },
];

interface Props {
  initialData: VentasReportData;
  usuarios: { id: number; username: string; nombreCompleto: string; puedeVender: boolean }[];
  userRole: string;
}

export default function VentasReport({ initialData, usuarios }: Props) {
  // -- Estado compartido --
  const [data, setData] = useState(initialData);
  // Fechas inicializadas con el preset 7d → rangeKey existe en el primer render
  // → el efecto de activación corre UNA sola vez en el montaje (sin doble fetch)
  const [fechaDesde, setFechaDesde] = useState<string>(() => getVentasDateRange("7d").desde);
  const [fechaHasta, setFechaHasta] = useState<string>(() => getVentasDateRange("7d").hasta);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [clienteSearch, setClienteSearch] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [activePeriod, setActivePeriod] = useState<ReporteVentasPeriodKey>("7d");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("dia");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeSubView, setActiveSubView] = useState<SubViewId>("analisis");
  const [printSection, setPrintSection] = useState<string | null>(null);

  // -- Cache de Análisis (sobrevive al switch de sub-vista) --
  const [analisisCache, setAnalisisCache] = useState<AnalisisCache | null>(null);
  const [analisisLoading, setAnalisisLoading] = useState(false);

  const granularityRef = useRef(chartGranularity);
  useEffect(() => {
    granularityRef.current = chartGranularity;
  }, [chartGranularity]);
  const isFirstRender = useRef(true);

  const rangeKey = `${fechaDesde}|${fechaHasta}|${usuarioId ?? ""}`;

  // Invalidación: cualquier cambio de filtro descarta la cache (spec: sin stale)
  useEffect(() => {
    setAnalisisCache(null);
  }, [rangeKey]);

  // -- Carga del batch de Análisis (lazy: solo al activar, caché sirve el retorno) --
  const loadAnalisisData = useCallback(async (): Promise<AnalisisCache> => {
    const filters = { fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined };
    const prev = getPreviousWindow(activePeriod, fechaDesde, fechaHasta);
    return getVentasAnalisisBatch({
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
      usuarioId,
      prevFechaDesde: prev?.desde,
      prevFechaHasta: prev?.hasta,
      agruparPor: granularityRef.current,
    });
  }, [fechaDesde, fechaHasta, usuarioId, activePeriod]);

  // Fetch-on-first-activation (spec: lazy mount). La invalidación por rangeKey pone la
  // cache en null → analisisCache en deps hace que este efecto corra de nuevo y refetchee
  // (fix gate: charts tras cambio de período/vendedor en Análisis). NO depende de
  // chartGranularity (se parchea aparte). Montaje: el primer run fetchea y el re-render
  // posterior con cache seteada hace early-return → exactamente UNA llamada.
  useEffect(() => {
    if (activeSubView !== "analisis" || analisisCache) return;
    let cancelled = false;
    setAnalisisLoading(true);
    (async () => {
      const next = await loadAnalisisData();
      if (!cancelled) {
        setAnalisisCache(next);
        setAnalisisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // loadAnalisisData es useCallback estable por [fechaDesde, fechaHasta, usuarioId,
    // activePeriod]; sus cambios de identidad siempre vienen con rangeKey/activeSubView,
    // ya cubiertos en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubView, rangeKey, analisisCache]);

  // Cambio de granularidad: patch SOLO de la evolución en la cache (patrón L496-505)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (activeSubView === "analisis" && analisisCache && fechaDesde && fechaHasta) {
      (async () => {
        try {
          const r = await getEvolucionVentas(fechaDesde, fechaHasta, chartGranularity);
          setAnalisisCache((prev) => (prev ? { ...prev, evolucion: r.data } : prev));
        } catch {
          // la cache queda como estaba
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartGranularity]);

  // -- Wiring explícito de fetch de la tabla (D12): sin efecto por rangeKey --
  // Los overrides (desde/hasta/uid) evitan el closure obsoleto: los setters de estado
  // aún no re-renderizaron cuando el handler llama fetchTabla() en el mismo tick.
  const fetchTabla = useCallback(
    async (opts?: { uid?: number | null; desde?: string; hasta?: string }) => {
      setIsPending(true);
      try {
        const d = opts?.desde !== undefined ? opts.desde : fechaDesde;
        const h = opts?.hasta !== undefined ? opts.hasta : fechaHasta;
        const u = opts?.uid !== undefined ? (opts.uid === null ? undefined : opts.uid) : usuarioId;
        const r = await getReporteVentas(d || undefined, h || undefined, u);
        setData(r);
      } finally {
        setIsPending(false);
      }
    },
    [fechaDesde, fechaHasta, usuarioId]
  );

  const handlePeriodChange = useCallback(
    (period: ReporteVentasPeriodKey) => {
      setActivePeriod(period);
      if (period === "personalizado") {
        setFiltersOpen(true); // el usuario elige Desde/Hasta y luego Buscar
        return;
      }
      const range = getVentasDateRange(period);
      setFechaDesde(range.desde);
      setFechaHasta(range.hasta);
      fetchTabla({ desde: range.desde, hasta: range.hasta }); // fechas explícitas
    },
    [fetchTabla]
  );

  const handleVendorChange = useCallback(
    (value: string) => {
      const newId = value ? Number(value) : undefined;
      setUsuarioId(newId);
      fetchTabla({ uid: newId === undefined ? null : newId }); // null = "Todos" explícito
    },
    [fetchTabla]
  );

  // Al cambiar de sub-módulo se resetea el filtro completo al estado predeterminado:
  // período 7d + fechas + vendedor "Todos", y se refetchea la tabla con valores explícitos.
  // El reset del período invalida la cache de Análisis vía rangeKey (refetch al activarse).
  const handleSubViewChange = useCallback(
    (v: SubViewId) => {
      const range = getVentasDateRange("7d");
      setActiveSubView(v);
      setActivePeriod("7d");
      setFechaDesde(range.desde);
      setFechaHasta(range.hasta);
      setUsuarioId(undefined);
      fetchTabla({ uid: null, desde: range.desde, hasta: range.hasta });
    },
    [fetchTabla]
  );

  const handleSearch = useCallback(() => fetchTabla(), [fetchTabla]);

  // -- Print section: imprime y resetea --
  useEffect(() => {
    if (printSection) {
      setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
    }
  }, [printSection]);

  // -- Fila y orden de la tabla (memos trasladados del monolito) --
  const ventasFiltradas = useMemo(() => {
    const v = data.ventas || [];
    const filtered = !clienteSearch
      ? v
      : v.filter((x) => (x.cliente || "").toLowerCase().includes(clienteSearch.toLowerCase()));
    return [...filtered].reverse();
  }, [data, clienteSearch]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  };

  const sortedVentas = useMemo(() => {
    if (!sortKey) return ventasFiltradas;
    return [...ventasFiltradas].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "fecha":
          // Formato fijo del servidor "dd/MM/yyyy HH:mm" → parse a timestamps locales
          cmp =
            parse(a.fecha, "dd/MM/yyyy HH:mm", new Date()).getTime() -
            parse(b.fecha, "dd/MM/yyyy HH:mm", new Date()).getTime();
          break;
        case "cliente":
          cmp = a.cliente.localeCompare(b.cliente);
          break;
        case "vendedor":
          cmp = a.usuario.localeCompare(b.usuario);
          break;
        case "cantidad":
          cmp = a.cantidadProductos - b.cantidadProductos;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [ventasFiltradas, sortKey, sortDir]);

  const totales = useMemo(() => {
    const v = ventasFiltradas;
    const cantidad = v.length;
    const total = v.reduce((s, x) => s + (x.total || 0), 0);
    const productosVendidos = v.reduce((s: number, x) => s + (x.cantidadProductos || 0), 0);
    return { cantidad, total, productosVendidos };
  }, [ventasFiltradas]);

  const clientesUnicos = useMemo(() => {
    return new Set((data.ventas || []).map((v) => v.cliente)).size;
  }, [data]);

  const inputClass =
    "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

  return (
    <div className="space-y-4">
      {/* Selector de sub-vista (patrón SubPestanasProductos) + imprimir */}
      <div className="print:hidden flex flex-wrap gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-1">
        {(["analisis", "detalle"] as SubViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => handleSubViewChange(v)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubView === v
                ? "bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/50"
            }`}
          >
            {v === "analisis" ? "Análisis" : "Detalle de ventas"}
          </button>
        ))}
        {isPending && (
          <div className="ml-auto flex items-center">
            <RefreshCw size={14} className="animate-spin text-[var(--text-muted)]" />
          </div>
        )}
      </div>

      {/* Filtros + Período */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
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
            <Select value={activePeriod} onValueChange={(v) => handlePeriodChange(v as ReporteVentasPeriodKey)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contenido de filtros: visible solo cuando el panel está abierto */}
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
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
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
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
              {activeSubView === "detalle" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                    <User size={12} /> Vendedor
                  </label>
                  <select
                    value={usuarioId || ""}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Todos</option>
                    {usuarios
                      .filter((u) => u.puedeVender)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombreCompleto || u.username}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {activeSubView === "detalle" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                    Cliente
                  </label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                      className={inputClass + " pl-7"}
                    />
                  </div>
                </div>
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

      {/* Vista activa (la otra queda desmontada; su estado vivo está en el contenedor) */}
      {activeSubView === "analisis" ? (
        <AnalisisView
          cache={analisisCache}
          loading={analisisLoading}
          activePeriod={activePeriod}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          chartGranularity={chartGranularity}
          onGranularityChange={setChartGranularity}
          printSection={printSection}
          setPrintSection={setPrintSection}
        />
      ) : (
        <DetalleView
          data={data}
          ventasFiltradas={ventasFiltradas}
          sortedVentas={sortedVentas}
          totales={totales}
          clientesUnicos={clientesUnicos}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          printSection={printSection}
          setPrintSection={setPrintSection}
        />
      )}
    </div>
  );
}
