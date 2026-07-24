"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getReporteVentas,
  getVentasPorCategoria,
  getVentasPorCliente,
  getVentasPorVendedorComision,
  getTopProductos,
  getEvolucionVentas,
} from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search, Calendar, User, RefreshCw, TrendingUp, Eye, Printer,
  DollarSign, ShoppingCart, Package, Users, BarChart3, ChevronDown, ChevronUp,
  FileSpreadsheet, FileText, Download,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import DetalleVentaModal from "./DetalleVentaModal";
import TicketModal from "./TicketModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RePie, Pie, Cell, AreaChart, Area,
  ResponsiveContainer,
} from "recharts";

/* ─── Types ─────────────────────────────────────────────────── */

type VentasReportData = Awaited<ReturnType<typeof getReporteVentas>>;

interface Props {
  initialData: VentasReportData;
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

type PeriodKey = "hoy" | "ayer" | "7d" | "mes" | "mes_anterior" | "anio" | "personalizado";

interface PeriodOption {
  key: PeriodKey;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "Ãšltimos 7 dÃ­as" },
  { key: "mes", label: "Este mes" },
  { key: "mes_anterior", label: "Mes anterior" },
  { key: "anio", label: "Este aÃ±o" },
  { key: "personalizado", label: "Personalizado" },
];

type ChartGranularity = "dia" | "semana" | "mes" | "anio";

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function getDateRange(period: PeriodKey): { desde: string; hasta: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "hoy":
      return { desde: fmt(today), hasta: fmt(today) };
    case "ayer": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { desde: fmt(y), hasta: fmt(y) };
    }
    case "7d": {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { desde: fmt(d), hasta: fmt(today) };
    }
    case "mes": {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { desde: fmt(d), hasta: fmt(today) };
    }
    case "mes_anterior": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { desde: fmt(first), hasta: fmt(last) };
    }
    case "anio": {
      const d = new Date(today.getFullYear(), 0, 1);
      return { desde: fmt(d), hasta: fmt(today) };
    }
    default:
      return { desde: fmt(today), hasta: fmt(today) };
  }
}

/* â”€â”€â”€ Ranking Card Subcomponents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ProductRankingCard({
  item,
  index,
  maxCantidad,
}: {
  item: { producto: string; cantidad: number; ingreso: number };
  index: number;
  maxCantidad: number;
}) {
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const medal = medals[index] || `\u{1F51F}`;
  const pct = maxCantidad > 0 ? (item.cantidad / maxCantidad) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
      <span className="text-xl shrink-0 w-8 text-center">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)] truncate">{item.producto}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[var(--text-muted)]">{item.cantidad} uds</span>
          <span className="text-xs text-[var(--text-muted)]">Â·</span>
          <span className="text-xs text-[var(--text-muted)]">{formatCurrency(item.ingreso)}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--brand)]"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ClientRankingCard({
  item,
  index,
}: {
  item: { cliente: string; total: number; cantidad: number };
  index: number;
}) {
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const medal = medals[index] || `\u{1F51F}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
      <span className="text-xl shrink-0 w-8 text-center">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)] truncate">{item.cliente}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[var(--text-muted)]">{item.cantidad} compras</span>
          <span className="text-xs text-[var(--text-muted)]">Â·</span>
          <span className="text-xs font-semibold text-[var(--success)]">{formatCurrency(item.total)}</span>
        </div>
      </div>
    </div>
  );
}

function SellerRankingCard({
  item,
  index,
  maxTotal,
}: {
  item: { vendedor: string; cantidadVentas: number; totalVendido: number; comision: number };
  index: number;
  maxTotal: number;
}) {
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const medal = medals[index] || `\u{1F51F}`;
  const avg = item.cantidadVentas > 0 ? item.totalVendido / item.cantidadVentas : 0;
  const pct = maxTotal > 0 ? (item.totalVendido / maxTotal) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors">
      <span className="text-xl shrink-0 w-8 text-center">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)] truncate">{item.vendedor}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">{item.cantidadVentas} ventas</span>
          <span className="text-xs text-[var(--text-muted)]">Â·</span>
          <span className="text-xs font-semibold text-[var(--success)]">{formatCurrency(item.totalVendido)}</span>
          <span className="text-xs text-[var(--text-muted)]">Â·</span>
          <span className="text-xs text-[var(--text-muted)]">Prom: {formatCurrency(avg)}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--info)]"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function VentasReport({ initialData, usuarios, userRole }: Props) {
  // â”€â”€ Core state â”€â”€
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [clienteId, setClienteId] = useState<number | undefined>(undefined);
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [productoId, setProductoId] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState("");
  const [isPending, setIsPending] = useState(false);

  // â”€â”€ Period selector â”€â”€
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("7d");

  // â”€â”€ Filter toggle â”€â”€
  const [filtersOpen, setFiltersOpen] = useState(false);

  // â”€â”€ Chart data â”€â”€
  const [evolucionData, setEvolucionData] = useState<{ periodo: string; ventas: number; ganancia: number; fechaInicio: string; fechaFin: string }[]>([]);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("dia");

  // â”€â”€ Secondary chart data (auto-loaded) â”€â”€
  const [ventasPorCat, setVentasPorCat] = useState<any[] | null>(null);
  const [topProds, setTopProds] = useState<any[] | null>(null);
  const [ventasPorVend, setVentasPorVend] = useState<any[] | null>(null);
  const [ventasPorCli, setVentasPorCli] = useState<any[] | null>(null);
  const [loadingCharts, setLoadingCharts] = useState(true);



  // â”€â”€ Modals â”€â”€
  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [ticketVentaId, setTicketVentaId] = useState<number | null>(null);

  // â”€â”€ Filtered ventas for text search (oldest first) â”€â”€
  const ventasFiltradas = useMemo(() => {
    const v = data.ventas || [];
    const filtered = !searchText
      ? v
      : v.filter((x: any) =>
          (x.cliente || "").toLowerCase().includes(searchText.toLowerCase()) ||
          (x.usuario || "").toLowerCase().includes(searchText.toLowerCase())
        );
    return [...filtered].reverse();
  }, [data, searchText]);

  // â”€â”€ KPI calculations â”€â”€
  const totales = useMemo(() => {
    const v = ventasFiltradas;
    const cantidad = v.length;
    const total = v.reduce((s, x) => s + (x.total || 0), 0);
    const promedio = cantidad > 0 ? total / cantidad : 0;
    const productosVendidos = v.reduce((s: number, x: any) => s + (x.cantidadProductos || 0), 0);
    return { cantidad, total, promedio, productosVendidos };
  }, [ventasFiltradas]);

  const clientesUnicos = useMemo(() => {
    return new Set((data.ventas || []).map((v) => v.cliente)).size;
  }, [data]);

  // â”€â”€ Estimated ganancia (from evolucion data) â”€â”€
  const gananciaEstimada = useMemo(() => {
    return evolucionData.reduce((sum, d) => sum + d.ganancia, 0);
  }, [evolucionData]);

  const kpiData = useMemo(() => [
    {
      label: "Ventas Totales",
      value: formatCurrency(totales.total),
      icon: <DollarSign size={18} />,
      color: "emerald" as const,
      trend: { direction: "up" as const, value: "vs perÃ­odo anterior" },
    },
    {
      label: "Cantidad de Ventas",
      value: totales.cantidad.toString(),
      icon: <ShoppingCart size={18} />,
      color: "indigo" as const,
      trend: { direction: "up" as const, value: "vs perÃ­odo anterior" },
    },
    {
      label: "Productos Vendidos",
      value: totales.productosVendidos.toString(),
      icon: <Package size={18} />,
      color: "sky" as const,
      trend: { direction: "up" as const, value: "vs perÃ­odo anterior" },
    },
    {
      label: "Clientes Atendidos",
      value: clientesUnicos.toString(),
      icon: <Users size={18} />,
      color: "rose" as const,
      trend: { direction: "up" as const, value: "vs perÃ­odo anterior" },
    },
  ], [totales, clientesUnicos]);

  // â”€â”€ Period change handler â”€â”€
  const handlePeriodChange = useCallback(async (period: PeriodKey) => {
    setActivePeriod(period);
    if (period === "personalizado") return;

    const range = getDateRange(period);
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
    setIsPending(true);
    setLoadingCharts(true);

    try {
      const filters = { fechaDesde: range.desde, fechaHasta: range.hasta };
      const [reportResult, catResult, topResult, vendResult, cliResult, evoResult] = await Promise.allSettled([
        getReporteVentas(range.desde, range.hasta, usuarioId, clienteId),
        getVentasPorCategoria(filters),
        getTopProductos(filters, 10),
        getVentasPorVendedorComision({ ...filters, page: 1 }),
        getVentasPorCliente({ ...filters, page: 1 }),
        getEvolucionVentas(range.desde, range.hasta, chartGranularity),
      ]);
      if (reportResult.status === "fulfilled") setData(reportResult.value);
      if (catResult.status === "fulfilled") setVentasPorCat(catResult.value.data);
      if (topResult.status === "fulfilled") setTopProds(topResult.value.data);
      if (vendResult.status === "fulfilled") setVentasPorVend(vendResult.value.data);
      if (cliResult.status === "fulfilled") setVentasPorCli(cliResult.value.data);
      if (evoResult.status === "fulfilled") setEvolucionData(evoResult.value.data);
    } finally {
      setIsPending(false);
      setLoadingCharts(false);
    }
  }, [usuarioId, clienteId, chartGranularity]);

  // â”€â”€ Search handler â”€â”€
  const handleSearch = useCallback(async () => {
    setIsPending(true);
    setFiltersOpen(false);
    setLoadingCharts(true);

    try {
      const result = await getReporteVentas(fechaDesde || undefined, fechaHasta || undefined, usuarioId, clienteId);
      setData(result);
      const filters = { fechaDesde, fechaHasta };
      const [catResult, topResult, vendResult, cliResult, evoResult] = await Promise.allSettled([
        getVentasPorCategoria(filters),
        getTopProductos(filters, 10),
        getVentasPorVendedorComision({ ...filters, page: 1 }),
        getVentasPorCliente({ ...filters, page: 1 }),
        getEvolucionVentas(fechaDesde, fechaHasta, chartGranularity),
      ]);
      if (catResult.status === "fulfilled") setVentasPorCat(catResult.value.data);
      if (topResult.status === "fulfilled") setTopProds(topResult.value.data);
      if (vendResult.status === "fulfilled") setVentasPorVend(vendResult.value.data);
      if (cliResult.status === "fulfilled") setVentasPorCli(cliResult.value.data);
      if (evoResult.status === "fulfilled") setEvolucionData(evoResult.value.data);
    } finally {
      setIsPending(false);
      setLoadingCharts(false);
    }
  }, [fechaDesde, fechaHasta, usuarioId, clienteId, chartGranularity]);

  // â”€â”€ Load evolution chart â”€â”€
  const loadEvolutionChart = useCallback(async () => {
    try {
      const result = await getEvolucionVentas(fechaDesde || undefined, fechaHasta || undefined, chartGranularity);
      setEvolucionData(result.data);
    } catch {
      setEvolucionData([]);
    }
  }, [fechaDesde, fechaHasta, chartGranularity]);

  // â”€â”€ Load all secondary charts â”€â”€
  const loadAllSecondaryCharts = useCallback(async () => {
    setLoadingCharts(true);
    try {
      const filters = { fechaDesde, fechaHasta };
      const [catResult, topResult, vendResult, cliResult] = await Promise.allSettled([
        getVentasPorCategoria(filters),
        getTopProductos(filters, 10),
        getVentasPorVendedorComision({ ...filters, page: 1 }),
        getVentasPorCliente({ ...filters, page: 1 }),
      ]);
      if (catResult.status === "fulfilled") setVentasPorCat(catResult.value.data);
      if (topResult.status === "fulfilled") setTopProds(topResult.value.data);
      if (vendResult.status === "fulfilled") setVentasPorVend(vendResult.value.data);
      if (cliResult.status === "fulfilled") setVentasPorCli(cliResult.value.data);
    } catch {
      // silently handle
    } finally {
      setLoadingCharts(false);
    }
  }, [fechaDesde, fechaHasta]);

  // â”€â”€ Initial load: set default period and load all data â”€â”€
  useEffect(() => {
    const range = getDateRange("7d");
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);

    let cancelled = false;

    async function loadAll() {
      setLoadingCharts(true);
      try {
        const filters = { fechaDesde: range.desde, fechaHasta: range.hasta };
        const [reportResult, catResult, topResult, vendResult, cliResult, evoResult] = await Promise.allSettled([
          getReporteVentas(range.desde, range.hasta),
          getVentasPorCategoria(filters),
          getTopProductos(filters, 10),
          getVentasPorVendedorComision({ ...filters, page: 1 }),
          getVentasPorCliente({ ...filters, page: 1 }),
          getEvolucionVentas(range.desde, range.hasta, "dia"),
        ]);
        if (cancelled) return;
        if (reportResult.status === "fulfilled") setData(reportResult.value);
        if (catResult.status === "fulfilled") setVentasPorCat(catResult.value.data);
        if (topResult.status === "fulfilled") setTopProds(topResult.value.data);
        if (vendResult.status === "fulfilled") setVentasPorVend(vendResult.value.data);
        if (cliResult.status === "fulfilled") setVentasPorCli(cliResult.value.data);
        if (evoResult.status === "fulfilled") setEvolucionData(evoResult.value.data);
      } finally {
        if (!cancelled) setLoadingCharts(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // â”€â”€ Reload evolution chart when granularity changes (skip initial mount) â”€â”€
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (fechaDesde && fechaHasta) {
      loadEvolutionChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartGranularity]);

  // â”€â”€ Print handler â”€â”€
  const handlePrint = () => window.print();



  // â”€â”€ Chart data for secondary charts â”€â”€
  const categoryPieData = useMemo(() => {
    if (!ventasPorCat) return [];
    return ventasPorCat.map((c: any) => ({
      name: c.categoria,
      value: c.subtotal,
    }));
  }, [ventasPorCat]);

  const topProdsBarData = useMemo(() => {
    if (!topProds) return [];
    return topProds.slice(0, 8).map((p: any) => ({
      name: p.producto.length > 22 ? p.producto.slice(0, 20) + "â€¦" : p.producto,
      cantidad: p.cantidad,
      ingreso: p.ingreso,
    }));
  }, [topProds]);

  const vendBarData = useMemo(() => {
    if (!ventasPorVend) return [];
    return ventasPorVend.slice(0, 8).map((v: any) => ({
      name: v.vendedor,
      ventas: v.cantidadVentas,
      total: v.totalVendido,
    }));
  }, [ventasPorVend]);

  const cliBarData = useMemo(() => {
    if (!ventasPorCli) return [];
    return ventasPorCli.slice(0, 8).map((c: any) => ({
      name: c.cliente,
      compras: c.cantidad,
      total: c.total,
    }));
  }, [ventasPorCli]);

  // â”€â”€ Top 5 for ranking cards â”€â”€
  const top5Products = useMemo(() => (topProds || []).slice(0, 5), [topProds]);
  const top5Clients = useMemo(() => (ventasPorCli || []).slice(0, 5), [ventasPorCli]);
  const topSellers = useMemo(() => (ventasPorVend || []).slice(0, 5), [ventasPorVend]);
  const maxProductQty = useMemo(
    () => Math.max(...top5Products.map((p: any) => p.cantidad), 1),
    [top5Products]
  );
  const maxSellerTotal = useMemo(
    () => Math.max(...topSellers.map((s: any) => s.totalVendido), 1),
    [topSellers]
  );

  const inputClass =
    "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

  // â”€â”€ Custom tooltip for evolution chart â”€â”€
  const EvolutionTooltip = ({ active, payload, granularity }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    const ventas = payload.find((p: any) => p.dataKey === "ventas")?.value || 0;
    const ganancia = payload.find((p: any) => p.dataKey === "ganancia")?.value || 0;
    const margen = ventas > 0 ? ((ganancia / ventas) * 100).toFixed(1) : "0";

    // Format date based on granularity
    let fechaCompleta = "";
    if (data?.fechaInicio) {
      const inicio = new Date(data.fechaInicio);
      const fin = data.fechaFin ? new Date(data.fechaFin) : null;
      if (granularity === "anio") {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { year: "numeric" });
      } else if (granularity === "mes") {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      } else if (granularity === "semana" && fin && inicio.getTime() !== fin.getTime()) {
        const optsShort: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
        const optsFull: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
        fechaCompleta = `${inicio.toLocaleDateString("es-AR", optsShort)} al ${fin.toLocaleDateString("es-AR", optsFull)}`;
      } else {
        fechaCompleta = inicio.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
      }
    }

    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs" style={{ minWidth: 200 }}>
        <div className="font-bold text-[var(--text)] mb-2 pb-1 border-b border-[var(--border)]">
          ðŸ“… {fechaCompleta}
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#d62828]" /> Ventas
          </span>
          <span className="font-semibold text-[var(--text)]">{formatCurrency(ventas)}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Ganancia
          </span>
          <span className="font-semibold" style={{ color: ganancia >= 0 ? "#22c55e" : "#dc2626" }}>
            {formatCurrency(ganancia)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] mt-1">
          <span className="text-[var(--text-muted)]">Margen</span>
          <span className="font-semibold text-[var(--text)]">{margen}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SECTION 1: FILTERS + PERIOD (single bar)
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Toggle + Period row */}
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
            <span className="text-xs font-semibold text-[var(--text-muted)]">PerÃ­odo:</span>
            <select
              value={activePeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodKey)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition cursor-pointer"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter content */}
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* Desde */}
              {(activePeriod === "personalizado" || filtersOpen) && (
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
              )}
              {/* Hasta */}
              {(activePeriod === "personalizado" || filtersOpen) && (
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
              )}
              {/* Vendedor */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <User size={12} /> Vendedor
                </label>
                <select
                  value={usuarioId || ""}
                  onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombreCompleto || u.username}</option>
                  ))}
                </select>
              </div>
              {/* Cliente */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Users size={12} /> Cliente
                </label>
                <input
                  type="text"
                  placeholder="Nombre del cliente..."
                  value={clienteId || ""}
                  onChange={() => {}}
                  className={inputClass}
                />
              </div>
              {/* CategorÃ­a */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Package size={12} /> CategorÃ­a
                </label>
                <select
                  value={categoriaId || ""}
                  onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : undefined)}
                  className={inputClass}
                >
                  <option value="">Todas</option>
                </select>
              </div>
              {/* Producto */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Package size={12} /> Producto
                </label>
                <input
                  type="text"
                  placeholder="Nombre del producto..."
                  value={productoId || ""}
                  onChange={() => {}}
                  className={inputClass}
                />
              </div>
              {/* BÃºsqueda */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <Search size={12} /> BÃºsqueda
                </label>
                <input
                  type="text"
                  placeholder="Cliente / Vendedor..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSearch}
                disabled={isPending}
                className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
              >
                <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                {isPending ? "Buscando..." : "Buscar"}
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--border)] text-[var(--text-muted)] text-sm font-bold rounded-lg flex items-center gap-2 transition border border-[var(--border)]"
              >
                <Printer size={14} /> Imprimir
              </button>
              <button className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--border)] text-[var(--text-muted)] text-sm font-bold rounded-lg flex items-center gap-2 transition border border-[var(--border)]">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--border)] text-[var(--text-muted)] text-sm font-bold rounded-lg flex items-center gap-2 transition border border-[var(--border)]">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PRINTABLE CONTENT
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="print:bg-white print:text-black space-y-4">
        {/* Print header */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Ventas</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* â”€â”€â”€ Summary Row (same metrics as KPI cards) â”€â”€â”€ */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Ventas Totales</div>
              <div className="text-sm font-bold text-[var(--success)]">{formatCurrency(totales.total)}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Cantidad de Ventas</div>
              <div className="text-sm font-bold text-[var(--text)]">{totales.cantidad}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Productos Vendidos</div>
              <div className="text-sm font-bold text-[var(--text)]">{totales.productosVendidos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Atendidos</div>
              <div className="text-sm font-bold text-[var(--text)]">{clientesUnicos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Ganancia Estimada</div>
              <div className="text-sm font-bold" style={{ color: gananciaEstimada >= 0 ? "var(--success)" : "#dc2626" }}>{formatCurrency(gananciaEstimada)}</div>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€ Evolution Chart (full-width) â”€â”€â”€ */}
        <div className="report-section" data-section-id="evolution">
          <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-muted)]">EvoluciÃ³n de Ventas</h3>
              <div className="flex items-center gap-1 print:hidden">
                {(["dia", "semana", "mes", "anio"] as ChartGranularity[]).map((g) => {
                  const labels: Record<ChartGranularity, string> = {
                    dia: "Diario", semana: "Semanal", mes: "Mensual", anio: "Anual",
                  };
                  return (
                    <button
                      key={g}
                      onClick={() => setChartGranularity(g)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        chartGranularity === g
                          ? "bg-[var(--brand)] text-white"
                          : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                      }`}
                    >
                      {labels[g]}
                    </button>
                  );
                })}

              </div>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              {evolucionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d62828" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#d62828" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gananciaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="periodo" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={<EvolutionTooltip granularity={chartGranularity} />}
                      cursor={{ stroke: "var(--text-muted)", strokeDasharray: "4 4" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#d62828"
                      strokeWidth={2}
                      fill="url(#brandGradient)"
                      name="Ventas"
                    />
                    <Area
                      type="monotone"
                      dataKey="ganancia"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      fill="url(#gananciaGradient)"
                      name="Ganancia"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
                  Sin datos para el perÃ­odo seleccionado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* â”€â”€â”€ Secondary Charts (3-column grid) â”€â”€â”€ */}
        <div className="report-section" data-section-id="charts">


          {loadingCharts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
                  <div className="h-4 bg-[var(--card)] rounded w-1/3 mb-4" />
                  <div className="h-48 bg-[var(--card)] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Ventas por CategorÃ­a â€” PieChart */}
              <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Ventas por CategorÃ­a</h3>
                {categoryPieData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    {/* Pie */}
                    <div className="w-1/2" style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RePie>
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => {
                              const total = categoryPieData.reduce((s, d) => s + d.value, 0);
                              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                              return [`${formatCurrency(value)} (${pct}%)`, name];
                            }}
                            contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                            itemStyle={{ color: "var(--text)" }}
                          />
                          <Pie
                            data={categoryPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                          >
                            {categoryPieData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                        </RePie>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="w-1/2 space-y-2">
                      {categoryPieData.map((entry: any, i: number) => {
                        const total = categoryPieData.reduce((s, d) => s + d.value, 0);
                        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                        return (
                          <div key={entry.name} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-xs text-[var(--text-muted)] truncate">{entry.name}</span>
                            <span className="text-xs font-semibold text-[var(--text)] ml-auto">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-[var(--text-secondary)] text-sm">
                    Sin datos de categorÃ­as
                  </div>
                )}
              </div>

              {/* Top Productos â€” horizontal BarChart */}
              <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Top Productos</h3>
                <div style={{ width: "100%", height: 300 }}>
                  {topProdsBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProdsBarData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} width={130} />
                        <Tooltip
                          formatter={(value: number) => [`${value} unidades`, "Cantidad"]}
                          cursor={{ fill: "var(--border)", fillOpacity: 0.3 }}
                          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                          itemStyle={{ color: "var(--text)" }}
                        />
                        <Bar dataKey="cantidad" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Cantidad" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                      Sin datos de productos
                    </div>
                  )}
                </div>
              </div>

              {/* Top Clientes â€” horizontal BarChart */}
              <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Top Clientes</h3>
                <div style={{ width: "100%", height: 300 }}>
                  {cliBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cliBarData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} width={130} />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), "Total"]}
                          cursor={{ fill: "var(--border)", fillOpacity: 0.3 }}
                          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                          itemStyle={{ color: "var(--text)" }}
                        />
                        <Bar dataKey="total" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} name="Total" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                      Sin datos de clientes
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€â”€ Top 5 Rankings â”€â”€â”€ */}
        <div className="report-section" data-section-id="rankings">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top 5 Productos */}
            <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <Package size={14} className="text-[var(--brand)]" />
                Top 5 Productos
              </h3>
              <div className="space-y-2">
                {top5Products.length > 0 ? (
                  top5Products.map((p: any, i: number) => (
                    <ProductRankingCard key={p.productoId || i} item={p} index={i} maxCantidad={maxProductQty} />
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] text-center py-4">Sin datos</p>
                )}
              </div>
            </div>

            {/* Top 5 Clientes */}
            <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <Users size={14} className="text-[var(--info)]" />
                Top 5 Clientes
              </h3>
              <div className="space-y-2">
                {top5Clients.length > 0 ? (
                  top5Clients.map((c: any, i: number) => (
                    <ClientRankingCard key={c.clienteId || i} item={c} index={i} />
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] text-center py-4">Sin datos</p>
                )}
              </div>
            </div>

            {/* Top Vendedores */}
            <div className="bg-[var(--panel)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--success)]" />
                Top Vendedores
              </h3>
              <div className="space-y-2">
                {topSellers.length > 0 ? (
                  topSellers.map((s: any, i: number) => (
                    <SellerRankingCard key={s.usuarioId || i} item={s} index={i} maxTotal={maxSellerTotal} />
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] text-center py-4">Sin datos</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€ Sales Table â”€â”€â”€ */}
        <div className="report-section" data-section-id="table">
          <div className="flex items-center justify-between mb-2 print:hidden">
            <h3 className="text-sm font-semibold text-[var(--text-muted)]">
              Tabla de Ventas ({ventasFiltradas.length} registros)
            </h3>
            <button
              onClick={handlePrint}
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
                    <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Vendedor</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Prod.</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider print:hidden">Acc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50 print:divide-gray-300">
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        Sin ventas en el perÃ­odo.
                      </td>
                    </tr>
                  ) : (
                    (ventasFiltradas as any[]).map((venta: any) => (
                      <tr key={venta.id} className="hover:bg-[var(--card)] transition-colors">
                        <td className="px-4 py-3 font-bold text-[var(--text)] print:text-black">
                          #{String(venta.id).padStart(4, "0")}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] print:text-gray-700 text-xs">
                          {venta.fecha}
                        </td>
                        <td className="px-4 py-3 text-[var(--text)] print:text-gray-800 font-medium truncate max-w-[180px]">
                          {venta.cliente}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] print:text-gray-600">
                          {venta.usuario}
                        </td>
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
        </div>
      </div>

      {/* â”€â”€â”€ Modals â”€â”€â”€ */}
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
        <TicketModal ventaId={ticketVentaId} onClose={() => setTicketVentaId(null)} />
      )}
    </div>
  );
}

