"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ClientesDashboard } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Printer, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePie,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const inputClass =
  "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)] transition";

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const tableCellHeader =
  "px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

const printButtonClass =
  "p-1.5 rounded-lg bg-[var(--border)] text-[var(--text-muted)] hover:text-emerald-400 hover:bg-[var(--border)] transition print:hidden";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    fontSize: 12,
    padding: "10px 14px",
  },
  itemStyle: { color: "var(--text)" },
  labelStyle: { color: "var(--text-muted)" },
};

type SortKey = "estado" | "compras" | "total" | "ultima";
type SortDir = "asc" | "desc";

// Short Spanish month labels for the "Clientes Nuevos por Mes" year selector
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Full Spanish month names, used in the chart tooltip (no abbreviations there)
const MESES_COMPLETOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Dirección por defecto al hacer clic por primera vez en cada columna
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  estado: "asc",
  compras: "desc",
  total: "desc",
  ultima: "desc",
};

// Tooltip custom: no muestra nada si el valor es 0
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length || payload[0].value === 0) return null;
  // Los datos del gráfico "Clientes Nuevos por Mes" incluyen el nombre completo
  // del mes (mesCompleto); si está presente, lo mostramos en vez de la abreviatura.
  const displayLabel = payload[0]?.payload?.mesCompleto || label;
  return (
    <div style={tooltipStyle.contentStyle}>
      {displayLabel && <p style={{ ...tooltipStyle.labelStyle, marginBottom: 2 }}>{displayLabel}</p>}
      <p style={tooltipStyle.itemStyle}>
        {payload[0].name || payload[0].dataKey}: <strong>{payload[0].value}</strong>
      </p>
    </div>
  );
}

interface Props {
  initialData: ClientesDashboard;
  userRole?: string;
}

export default function ClientesReport({ initialData, userRole }: Props) {
  // Datos servidos por la página (getClientesDashboard) — sin fetch al montar,
  // sin filtro de período, sin botones "Cargar".
  const [data] = useState<ClientesDashboard>(initialData);
  const [search, setSearch] = useState("");
  const [printSection, setPrintSection] = useState<string | null>(null);
  useEffect(() => {
    if (printSection) {
      const t = setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [printSection]);

  // Year selector for the "Clientes Nuevos por Mes" chart (defaults to current year)
  const [anioNuevos, setAnioNuevos] = useState<number>(() => new Date().getFullYear());

  // Available years (unique, desc) from the full nuevosPorMes dataset
  const aniosDisponibles = useMemo(() => {
    const years = new Set(data.nuevosPorMes.map((i) => i.mes.slice(0, 4)));
    return Array.from(years)
      .map(Number)
      .sort((a, b) => b - a);
  }, [data]);

  // 12 bars (Jan–Dec) for the selected year; months without data render as 0
  const nuevosPorMesAnio = useMemo(() => {
    const porMes = new Map(data.nuevosPorMes.map((i) => [i.mes, i.cantidad] as const));
    return MESES_CORTOS.map((label, i) => {
      const key = `${anioNuevos}-${String(i + 1).padStart(2, "0")}`;
      return { label, mesCompleto: MESES_COMPLETOS[i], cantidad: porMes.get(key) ?? 0 };
    });
  }, [data, anioNuevos]);

  // Filtro clientes (solo tabla completa) por nombre o DNI — client-side
  const filteredClientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.clientesCompleto;
    return data.clientesCompleto.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.dni.toLowerCase().includes(q)
    );
  }, [search, data]);

  // Ordenamiento client-side de la tabla completa — sin orden por defecto
  // hasta que el usuario haga clic en un encabezado.
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  };

  const sortedClientes = useMemo(() => {
    if (!sortKey) return filteredClientes;
    return [...filteredClientes].sort((a, b) => {
      if (sortKey === "ultima") {
        // Clientes sin compras (null) siempre al final, en ambas direcciones
        if (!a.ultimaCompraIso && !b.ultimaCompraIso) return 0;
        if (!a.ultimaCompraIso) return 1;
        if (!b.ultimaCompraIso) return -1;
        return sortDir === "desc"
          ? b.ultimaCompraIso.localeCompare(a.ultimaCompraIso)
          : a.ultimaCompraIso.localeCompare(b.ultimaCompraIso);
      }
      let cmp = 0;
      switch (sortKey) {
        case "estado":
          cmp = (a.activo ? 0 : 1) - (b.activo ? 0 : 1);
          break;
        case "compras":
          cmp = a.cantidadCompras - b.cantidadCompras;
          break;
        case "total":
          cmp = a.totalGastado - b.totalGastado;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredClientes, sortKey, sortDir]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="text-[var(--text-muted)] opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[var(--brand)]" />
    ) : (
      <ArrowDown size={12} className="text-[var(--brand)]" />
    );
  };

  const maxTop = useMemo(
    () => data.top10.reduce((m, c) => Math.max(m, c.total), 0),
    [data]
  );
  const maxFrec = useMemo(
    () => data.frecuencia.reduce((m, c) => Math.max(m, c.cantidad), 0),
    [data]
  );

  const printActive = (id: string) => (printSection === id) || null;

  return (
    <div className="space-y-4">
      <div className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">Informe de Clientes</p>
          <p className="text-xs text-gray-500">Generado: {formatDate(new Date())}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* 2. Resumen KPI */}
        <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total de Clientes</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.total}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Activos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.activos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Inactivos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.inactivos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Nuevos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.nuevos30d}</div>
              <div className="text-[10px] text-[var(--text-secondary)]">últimos 30 días</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Cliente Top</div>
              {data.resumen.topCliente ? (
                <>
                  <div className="text-sm font-bold text-[var(--text)] truncate">{data.resumen.topCliente.nombre}</div>
                  <div className="text-[11px] font-semibold text-[var(--brand)]">{formatCurrency(data.resumen.topCliente.total)}</div>
                </>
              ) : (
                <div className="text-sm font-bold text-[var(--text)]">—</div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Fila de gráficos */}
        <div className="report-section" data-section-id="charts" data-print-active={printActive("charts")}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartWrapper title="Clientes Activos vs Inactivos" height={260}>
              <RePie>
                <Pie data={data.activosInactivos} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} label>
                  {data.activosInactivos.map((e, i) => (
                    <Cell key={i} fill={e.name === "Activos" ? CHART_COLORS[0] : CHART_COLORS[5]} />
                  ))}
                </Pie>
                <Tooltip content={ChartTooltip} />
              </RePie>
            </ChartWrapper>

            <ChartWrapper
              title="Clientes Nuevos por Mes"
              height={260}
              action={
                <Select value={String(anioNuevos)} onValueChange={(v) => setAnioNuevos(Number(v))}>
                  <SelectTrigger className="h-7 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aniosDisponibles.map((a) => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <BarChart data={nuevosPorMesAnio}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="cantidad" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Tooltip content={ChartTooltip} cursor={false} />
              </BarChart>
            </ChartWrapper>

            <ChartWrapper title="Distribución por Nivel de Gasto" height={260}>
              <BarChart data={data.distribucionGasto}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rango" stroke="#64748b" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="clientes" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                <Tooltip content={ChartTooltip} cursor={false} />
              </BarChart>
            </ChartWrapper>
          </div>
        </div>

        {/* 4. Rankings */}
        <div className="report-section" data-section-id="rankings" data-print-active={printActive("rankings")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Top 10 Clientes</h3>
              {data.top10.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {data.top10.map((c, i) => (
                    <div key={c.clienteId}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-[var(--text)] truncate">{i + 1}. {c.nombre}</span>
                        <span className="font-bold text-[var(--text)] ml-2 shrink-0">{formatCurrency(c.total)}</span>
                      </div>
                      <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${maxTop ? (c.total / maxTop) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Frecuencia de Compra</h3>
              {data.frecuencia.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {data.frecuencia.map((c, i) => (
                    <div key={c.clienteId}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-[var(--text)] truncate">{i + 1}. {c.nombre}</span>
                        <span className="font-bold text-[var(--text)] ml-2 shrink-0">{c.cantidad} compras</span>
                      </div>
                      <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--info)] rounded-full"
                          style={{ width: `${maxFrec ? (c.cantidad / maxFrec) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. Sin comprar hace más de 90 días */}
        <div className="report-section" data-section-id="inactivos90" data-print-active={printActive("inactivos90")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Clientes sin comprar hace más de 90 días</h3>
            <button onClick={() => setPrintSection("inactivos90")} className={printButtonClass} title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                    <th className={"text-left " + tableCellHeader}>Nombre</th>
                    <th className={"text-left " + tableCellHeader}>Última compra</th>
                    <th className={"text-right " + tableCellHeader}>Días sin comprar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                  {data.sinComprar90d.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        Sin clientes en esta situación.
                      </td>
                    </tr>
                  ) : data.sinComprar90d.map((c) => (
                    <tr key={c.clienteId} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.ultimaCompra}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--danger)]">{c.dias} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 7. Clientes (tabla completa — al final) */}
        <div className="report-section" data-section-id="clientes" data-print-active={printActive("clientes")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Clientes</h3>
            <button onClick={() => setPrintSection("clientes")} className={printButtonClass} title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
            {/* Búsqueda de clientes: solo afecta a esta tabla — pegada a la tabla */}
            <div className="print:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] print:border-gray-300">
              <Search size={16} className="text-[var(--text-muted)] shrink-0" />
              <label className="text-xs font-semibold text-[var(--text-muted)] shrink-0">
                Buscar cliente
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o DNI..."
                className={inputClass}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                    <th className={"text-left " + tableCellHeader}>Nombre</th>
                    <th className={"text-left " + tableCellHeader}>DNI</th>
                    <th
                      onClick={() => handleSort("estado")}
                      aria-label="Ordenar por Estado"
                      title="Ordenar por Estado"
                      className={
                        "text-center cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                        tableCellHeader
                      }
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        Estado
                        {renderSortIndicator("estado")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("compras")}
                      aria-label="Ordenar por Compras"
                      title="Ordenar por Compras"
                      className={
                        "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                        tableCellHeader
                      }
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        Compras
                        {renderSortIndicator("compras")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("total")}
                      aria-label="Ordenar por Total gastado"
                      title="Ordenar por Total gastado"
                      className={
                        "text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                        tableCellHeader
                      }
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        Total gastado
                        {renderSortIndicator("total")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("ultima")}
                      aria-label="Ordenar por Última compra"
                      title="Ordenar por Última compra"
                      className={
                        "text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors " +
                        tableCellHeader
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        Última compra
                        {renderSortIndicator("ultima")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                  {sortedClientes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">Sin clientes</td>
                    </tr>
                  ) : sortedClientes.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.dni}</td>
                      <td className="px-4 py-3 text-center">
                        {c.activo ? (
                          <span className="text-xs font-semibold text-[var(--success)]">Activo</span>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--danger)]">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">{c.cantidadCompras}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{formatCurrency(c.totalGastado)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.ultimaCompra || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
