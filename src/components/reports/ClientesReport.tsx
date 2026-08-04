"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ClientesDashboard } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle, Printer, Search, XCircle } from "lucide-react";
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
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "0.5rem",
    color: "#f1f5f9",
    fontSize: "0.875rem",
  },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#94a3b8" },
};

type ChartTooltipPayload = {
  value?: number;
  name?: string;
  dataKey?: string | number;
};

// Tooltip custom: no muestra nada si el valor es 0
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length || payload[0].value === 0) return null;
  return (
    <div style={tooltipStyle.contentStyle}>
      {label && <p style={{ ...tooltipStyle.labelStyle, marginBottom: 2 }}>{label}</p>}
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

export default function ClientesReport({ initialData }: Props) {
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

  // Filtro clientes (solo tabla completa) por nombre o DNI — client-side
  const filteredClientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.clientesCompleto;
    return data.clientesCompleto.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.dni.toLowerCase().includes(q)
    );
  }, [search, data]);

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
      {/* 1. Barra de búsqueda (único filtro) */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-4 py-3">
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
      </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total de Clientes</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.total}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Activos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.activos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Inactivos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.inactivos}</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Clientes Nuevos</div>
              <div className="text-sm font-bold text-[var(--text)]">{data.resumen.nuevos30d}</div>
              <div className="text-[10px] text-[var(--text-secondary)]">últimos 30 días</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
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
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total Facturado</div>
              <div className="text-sm font-bold text-[var(--text)]">{formatCurrency(data.resumen.totalFacturado)}</div>
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

            <ChartWrapper title="Clientes Nuevos por Mes" height={260}>
              <BarChart data={data.nuevosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Bar dataKey="cantidad" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Tooltip content={ChartTooltip} cursor={false} />
              </BarChart>
            </ChartWrapper>

            <ChartWrapper title="Distribución por Nivel de Gasto" height={260}>
              <BarChart data={data.distribucionGasto}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
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

        {/* 5. Clientes por Gasto */}
        <div className="report-section" data-section-id="gasto" data-print-active={printActive("gasto")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Clientes por Gasto</h3>
            <button onClick={() => setPrintSection("gasto")} className={printButtonClass} title="Imprimir esta sección">
              <Printer size={12} />
            </button>
          </div>
          <div className="bg-[var(--card)] print:bg-white border border-[var(--border)] print:border-gray-300 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                    <th className={"text-left " + tableCellHeader}>Cliente</th>
                    <th className={"text-right " + tableCellHeader}>Cantidad de compras</th>
                    <th className={"text-right " + tableCellHeader}>Total gastado</th>
                    <th className={"text-left " + tableCellHeader}>Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                  {data.clientesPorGasto.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-secondary)]">Sin datos</td>
                    </tr>
                  ) : data.clientesPorGasto.map((c) => (
                    <tr key={c.clienteId} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">{c.cantidad}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)]">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.ultimaCompra || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <th className={"text-left " + tableCellHeader}>Cliente</th>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] print:border-gray-300 bg-[var(--panel)] print:bg-gray-100">
                    <th className={"text-left " + tableCellHeader}>Nombre</th>
                    <th className={"text-left " + tableCellHeader}>DNI</th>
                    <th className={"text-center " + tableCellHeader}>Estado</th>
                    <th className={"text-right " + tableCellHeader}>Compras</th>
                    <th className={"text-right " + tableCellHeader}>Total gastado</th>
                    <th className={"text-left " + tableCellHeader}>Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] print:divide-gray-300">
                  {filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">Sin clientes</td>
                    </tr>
                  ) : filteredClientes.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--border)]/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[var(--text)]">{c.nombre}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{c.dni}</td>
                      <td className="px-4 py-3 text-center">
                        {c.activo ? (
                          <Badge variant="success" size="sm"><CheckCircle size={10} /> Activo</Badge>
                        ) : (
                          <Badge variant="danger" size="sm"><XCircle size={10} /> Inactivo</Badge>
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
