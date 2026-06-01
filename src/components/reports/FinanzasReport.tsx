"use client";

import React, { useState, useTransition, useCallback, useMemo } from "react";
import {
  getFinanzasReport, getGananciasPeriodo, getRentabilidadProductos,
} from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search, Calendar, RefreshCw, Printer, DollarSign,
  TrendingUp, Percent, BarChart3, PieChart,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import DataTable from "@/components/ui/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart as RePie, Pie, Cell,
  AreaChart, Area, LineChart, Line,
} from "recharts";

interface Props {
  initialData?: any;
  userRole?: string;
}

function DataSection({ title, loading, onLoad, loaded, children }: {
  title: string; loading: boolean; onLoad: () => void; loaded: boolean; children: React.ReactNode;
}) {
  if (!loaded) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          <button onClick={onLoad} disabled={loading}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition">
            {loading ? "Cargando..." : "Cargar"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

export default function FinanzasReport({ initialData, userRole }: Props) {
  const [finanzas, setFinanzas] = useState<any>({
    totalVendido: 0, costos: 0, gananciaBruta: 0, margen: 0,
    ventasPorDia: [], metodosPago: [],
  });
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [periodo, setPeriodo] = useState("dia");
  const [isPending, startTransition] = useTransition();

  const [gananciasPeriodo, setGananciasPeriodo] = useState<any[] | null>(null);
  const [rentabilidad, setRentabilidad] = useState<any[] | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await getFinanzasReport({ fechaDesde, fechaHasta });
      setFinanzas(result);
      setGananciasPeriodo(null);
      setRentabilidad(null);
    });
  }, [fechaDesde, fechaHasta]);

  const loadSection = useCallback(async (section: string, fetcher: () => Promise<any>) => {
    setLoadingSection(section);
    try { await fetcher(); }
    finally { setLoadingSection(null); }
  }, []);

  const handlePrint = () => window.print();

  const kpiData = useMemo(() => {
    const g = finanzas;
    const hoy = new Date().toLocaleDateString("es-AR");
    const ventaHoy = (g.ventasPorDia || []).find((d: any) => d.fecha === hoy);
    const gananciaHoy = ventaHoy ? ventaHoy.venta - ventaHoy.costo : null;
    const gananciaMes = g.gananciaBruta;
    const crecimiento = g.costos > 0
      ? Math.round(((g.gananciaBruta - g.costos * 0.1) / g.costos) * 100)
      : 0;

    return [
      { label: "Ventas Totales", value: formatCurrency(g.totalVendido), icon: <DollarSign size={18} />, color: "indigo" as const },
      { label: "Costos Totales", value: formatCurrency(g.costos), icon: <BarChart3 size={18} />, color: "rose" as const },
      { label: "Ganancia Bruta", value: formatCurrency(g.gananciaBruta), icon: <TrendingUp size={18} />, color: "emerald" as const },
      { label: "Margen Promedio", value: `${g.margen}%`, icon: <Percent size={18} />, color: "sky" as const },
      { label: "Ganancia Hoy", value: gananciaHoy !== null ? formatCurrency(gananciaHoy) : "—", icon: <PieChart size={18} />, color: "amber" as const },
      { label: "Crecimiento", value: `${crecimiento}%`, icon: <TrendingUp size={18} />, color: crecimiento >= 0 ? "emerald" as const : "rose" as const },
    ];
  }, [finanzas]);

  const gananciaDiariaChart = useMemo(() => {
    const g = finanzas;
    return (g.ventasPorDia || []).map((d: any) => ({
      ...d,
      ganancia: d.venta - d.costo,
    }));
  }, [finanzas]);

  const margenPeriodoData = useMemo(() => {
    if (!gananciasPeriodo) return [];
    return gananciasPeriodo.map((d: any) => ({
      ...d,
      margen: d.venta > 0 ? Math.round(((d.venta - d.costo) / d.venta) * 100) : 0,
    }));
  }, [gananciasPeriodo]);

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
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="dia">Diario</option>
              <option value="semana">Semanal</option>
              <option value="mes">Mensual</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch} disabled={isPending}
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
          <p className="text-sm">Informe de Finanzas</p>
          <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiData.map((kpi, i) => <StatCard key={i} {...kpi} />)}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="Ganancias Diarias" height={250}>
            <BarChart data={gananciaDiariaChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Bar dataKey="ganancia" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrapper>

          <ChartWrapper title="Evolución Ganancias" height={250}>
            <AreaChart data={gananciaDiariaChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <defs>
                <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="ganancia" stroke={CHART_COLORS[0]} fill="url(#colorGanancia)" strokeWidth={2} />
            </AreaChart>
          </ChartWrapper>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="Margen por Período" height={250}>
            <LineChart data={margenPeriodoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="periodo" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
              <Line type="monotone" dataKey="margen" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartWrapper>

          <ChartWrapper title="Métodos de Pago" height={250}>
            <RePie>
              <Pie data={(finanzas.metodosPago || []).map((m: any) => ({ name: m.metodo, value: m.total }))}
                dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                {(finanzas.metodosPago || []).map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </RePie>
          </ChartWrapper>
        </div>

        {/* Métodos de Pago Table (always available from main data) */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Métodos de Pago</h3>
          <DataTable
            columns={[
              { header: "Método", accessor: "metodo" },
              { header: "Total", accessor: (r: any) => formatCurrency(r.total), className: "text-right" },
              { header: "Cantidad", accessor: "cantidad", className: "text-right" },
            ]}
            data={finanzas.metodosPago || []}
            keyExtractor={(r: any) => r.metodo}
            emptyMessage="Sin datos de métodos de pago."
          />
        </div>

        {/* Lazy Data Sections */}
        <div className="grid grid-cols-1 gap-4">
          <DataSection title={`Ganancias por ${periodo === "dia" ? "Día" : periodo === "semana" ? "Semana" : "Mes"}`}
            loading={loadingSection === "periodo"}
            onLoad={() => loadSection("periodo", () =>
              getGananciasPeriodo({ fechaDesde, fechaHasta, search: periodo }).then(r => setGananciasPeriodo(r.data))
            )}
            loaded={gananciasPeriodo !== null}>
            {gananciasPeriodo && (
              <DataTable columns={[
                { header: "Período", accessor: "periodo" },
                { header: "Venta", accessor: (r: any) => formatCurrency(r.venta), className: "text-right" },
                { header: "Costo", accessor: (r: any) => formatCurrency(r.costo), className: "text-right" },
                { header: "Ganancia", accessor: (r: any) => formatCurrency(r.ganancia), className: "text-right" },
              ]} data={gananciasPeriodo} keyExtractor={(r: any) => r.periodo} />
            )}
          </DataSection>

          <DataSection title="Rentabilidad por Producto" loading={loadingSection === "rent"}
            onLoad={() => loadSection("rent", () =>
              getRentabilidadProductos({ page: 1 }).then(r => setRentabilidad(r.data))
            )}
            loaded={rentabilidad !== null}>
            {rentabilidad && (
              <DataTable columns={[
                { header: "Producto", accessor: "producto" },
                { header: "Categoría", accessor: "categoria" },
                { header: "P. Compra", accessor: (r: any) => formatCurrency(r.precioCompra), className: "text-right" },
                { header: "P. Venta", accessor: (r: any) => formatCurrency(r.precioVenta), className: "text-right" },
                { header: "Margen %", accessor: (r: any) => (
                  <span className={r.margenPorc >= 0 ? "text-emerald-400" : "text-rose-400"}>{r.margenPorc}%</span>
                ), className: "text-right" },
                { header: "Vendido", accessor: "vendido", className: "text-right" },
              ]} data={rentabilidad} keyExtractor={(r: any) => r.id} />
            )}
          </DataSection>
        </div>
      </div>
    </div>
  );
}
