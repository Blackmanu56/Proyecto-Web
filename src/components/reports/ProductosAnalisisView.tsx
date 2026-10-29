"use client";

import React, { useState, useMemo } from "react";
import type { ReporteProducto } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RePie,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface Props {
  productos: ReporteProducto[];
  categorias: { id: number; nombre: string }[];
}

const sectionHeaderClass =
  "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider";

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
  labelStyle: { color: "var(--text-muted)", fontWeight: "bold", marginBottom: "4px" },
};

const DONUT_COLORS = {
  normal: "#10b981", // emerald-500
  bajo: "#f59e0b",   // amber-500
  sinStock: "#f43f5e", // rose-500
};

type CategoriaLimit = "5" | "10" | "todas";

export default function ProductosAnalisisView({ productos }: Props) {
  // Estado para el selector del Top de categorías por stock
  const [categoriaLimit, setCategoriaLimit] = useState<CategoriaLimit>("10");

  // 1. Tarjetas de resumen (6 indicadores exactos del sistema)
  const kpis = useMemo(() => {
    const total = productos.length;
    const activos = productos.filter((p) => p.activo).length;
    const valorCosto = productos.reduce((sum, p) => sum + p.cantidad * p.precioCompra, 0);
    const valorVenta = productos.reduce((sum, p) => sum + p.cantidad * p.precioVenta, 0);
    const sinStock = productos.filter((p) => p.activo && p.cantidad === 0).length;
    const stockBajo = productos.filter((p) => p.activo && p.cantidad > 0 && p.cantidad <= p.stockMinimo).length;

    return {
      total,
      activos,
      valorCosto,
      valorVenta,
      sinStock,
      stockBajo,
    };
  }, [productos]);

  // A. Stock por Categoría (ordenado de mayor a menor)
  const stockPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of productos) {
      const cat = p.categoria || "Sin categoría";
      mapa.set(cat, (mapa.get(cat) || 0) + p.cantidad);
    }
    return Array.from(mapa.entries())
      .map(([categoria, stock]) => ({ categoria, stock }))
      .sort((a, b) => b.stock - a.stock);
  }, [productos]);

  // Categorías a mostrar según el selector Top 5 / Top 10 / Todas
  const displayedCategorias = useMemo(() => {
    if (categoriaLimit === "5") return stockPorCategoria.slice(0, 5);
    if (categoriaLimit === "10") return stockPorCategoria.slice(0, 10);
    return stockPorCategoria;
  }, [stockPorCategoria, categoriaLimit]);

  // Altura del gráfico de categorías para garantizar visibilidad de todas las barras
  const categoriasChartHeight = useMemo(() => {
    if (categoriaLimit === "5") return 240;
    if (categoriaLimit === "10") return 280;
    // Para "Todas", reservamos ~32px por categoría para que ninguna se achique o se oculte
    return Math.max(280, displayedCategorias.length * 32 + 30);
  }, [categoriaLimit, displayedCategorias.length]);

  // B. Rentabilidad por Producto (Top 10 margen %)
  const rentabilidadTop = useMemo(() => {
    return productos
      .filter((p) => p.precioVenta > 0 && p.precioCompra >= 0)
      .map((p) => {
        const margenUnitario = p.precioVenta - p.precioCompra;
        const margenPorc = Number(((margenUnitario / p.precioVenta) * 100).toFixed(1));
        return {
          id: p.id,
          nombre: p.nombre,
          margenPorc: isFinite(margenPorc) ? margenPorc : 0,
        };
      })
      .sort((a, b) => b.margenPorc - a.margenPorc)
      .slice(0, 10);
  }, [productos]);

  // C. Precios vs. Costo (Top 10 productos)
  const preciosVsCosto = useMemo(() => {
    return productos
      .filter((p) => p.precioVenta > 0)
      .sort((a, b) => b.precioVenta - a.precioVenta)
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        Costo: p.precioCompra,
        Venta: p.precioVenta,
      }));
  }, [productos]);

  // D. Distribución del Estado del Stock (Dona con categorías excluyentes sobre productos activos)
  const distribucionStock = useMemo(() => {
    let normal = 0;
    let bajo = 0;
    let sinStock = 0;

    const productosActivos = productos.filter((p) => p.activo);
    for (const p of productosActivos) {
      if (p.cantidad === 0) {
        sinStock++;
      } else if (p.cantidad <= p.stockMinimo) {
        bajo++;
      } else {
        normal++;
      }
    }

    const total = productosActivos.length;
    return [
      {
        name: "Stock normal",
        value: normal,
        color: DONUT_COLORS.normal,
        pct: total > 0 ? ((normal / total) * 100).toFixed(1) : "0",
      },
      {
        name: "Stock bajo",
        value: bajo,
        color: DONUT_COLORS.bajo,
        pct: total > 0 ? ((bajo / total) * 100).toFixed(1) : "0",
      },
      {
        name: "Sin stock",
        value: sinStock,
        color: DONUT_COLORS.sinStock,
        pct: total > 0 ? ((sinStock / total) * 100).toFixed(1) : "0",
      },
    ].filter((item) => item.value > 0);
  }, [productos]);

  // Selector compacto para Top categorías
  const categoriaLimitSelector = (
    <div className="flex items-center gap-1">
      {(["5", "10", "todas"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setCategoriaLimit(opt)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            categoriaLimit === opt
              ? "bg-[var(--brand)] text-white font-semibold"
              : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
          }`}
        >
          {opt === "todas" ? "Todas" : `Top ${opt}`}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1. Tarjetas de Resumen */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
        <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Total productos</div>
            <div className="text-sm font-bold text-[var(--text)]">{kpis.total}</div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Productos activos</div>
            <div className="text-sm font-bold text-emerald-400">{kpis.activos}</div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Valor a costo</div>
            <div className="text-sm font-bold text-[var(--text)] truncate" title={formatCurrency(kpis.valorCosto)}>
              {formatCurrency(kpis.valorCosto)}
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Valor a venta</div>
            <div className="text-sm font-bold text-emerald-400 truncate" title={formatCurrency(kpis.valorVenta)}>
              {formatCurrency(kpis.valorVenta)}
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Sin stock</div>
            <div className="text-sm font-bold text-rose-400">{kpis.sinStock}</div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Stock bajo</div>
            <div className="text-sm font-bold text-amber-400">{kpis.stockBajo}</div>
          </div>
        </div>
      </div>

      {/* 2. Sección Gráfica en grilla 2x2 equilibrada */}
      <div>
        <div className="mb-2">
          <h3 className={sectionHeaderClass}>Análisis Gráfico</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A. Top categorías por stock */}
          <ChartWrapper
            title="Top categorías por stock"
            height={320}
            action={categoriaLimitSelector}
          >
            {displayedCategorias.length > 0 ? (
              <div className="w-full h-full overflow-y-auto scrollbar-thin pr-1">
                <div style={{ height: categoriasChartHeight, minWidth: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={displayedCategorias}
                      layout="vertical"
                      margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        width={140}
                        interval={0}
                        stroke="#64748b"
                        tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      />
                      <Tooltip
                        cursor={false}
                        contentStyle={tooltipStyle.contentStyle}
                        itemStyle={tooltipStyle.itemStyle}
                        labelStyle={tooltipStyle.labelStyle}
                        labelFormatter={(label: string) => label}
                        formatter={(val: number) => [`${val} unidades`, "Stock disponible"]}
                      />
                      <Bar
                        dataKey="stock"
                        name="Stock"
                        fill={CHART_COLORS[0]}
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                Sin datos de stock por categoría.
              </div>
            )}
          </ChartWrapper>

          {/* D. Distribución del Estado del Stock */}
          <ChartWrapper title="Distribución del Estado del Stock" height={320}>
            <div className="flex items-center gap-4 h-full">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePie>
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      itemStyle={tooltipStyle.itemStyle}
                      labelStyle={tooltipStyle.labelStyle}
                      formatter={(val: number, name: string) => [`${val} productos`, name]}
                    />
                    <Pie
                      data={distribucionStock}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                    >
                      {distribucionStock.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </RePie>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2.5">
                {distribucionStock.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-[var(--text-muted)] truncate">{entry.name}</span>
                    <span className="text-xs font-semibold text-[var(--text)] ml-auto shrink-0">
                      {entry.value} <span className="text-[var(--text-muted)] font-normal">({entry.pct}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ChartWrapper>

          {/* B. Rentabilidad por Producto (Top 10 margen %) */}
          <ChartWrapper title="Rentabilidad por Producto (Top 10 margen %)" height={320}>
            {rentabilidadTop.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={rentabilidadTop}
                  margin={{ left: 10, right: 10, top: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="nombre"
                    stroke="#64748b"
                    fontSize={10}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={55}
                    tickFormatter={(v: string) => (v.length > 13 ? v.slice(0, 12) + "…" : v)}
                  />
                  <YAxis stroke="#64748b" fontSize={11} unit="%" />
                  <Tooltip
                    cursor={false}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    labelFormatter={(_label: string, payload) => {
                      return payload?.[0]?.payload?.nombre || _label;
                    }}
                    formatter={(val: number) => [`${val}%`, "Margen de ganancia"]}
                  />
                  <Bar
                    dataKey="margenPorc"
                    name="Margen %"
                    fill={CHART_COLORS[2]}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                Sin datos de rentabilidad calculables.
              </div>
            )}
          </ChartWrapper>

          {/* C. Precios vs. Costo (Top 10 productos) */}
          <ChartWrapper title="Precios vs. Costo (Top 10 productos)" height={320}>
            {preciosVsCosto.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={preciosVsCosto}
                  margin={{ left: 10, right: 10, top: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="nombre"
                    stroke="#64748b"
                    fontSize={10}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={55}
                    tickFormatter={(v: string) => (v.length > 13 ? v.slice(0, 12) + "…" : v)}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val: number) => (val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`)}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    labelFormatter={(_label: string, payload) => {
                      return payload?.[0]?.payload?.nombre || _label;
                    }}
                    formatter={(val: number, name: string) => [
                      formatCurrency(val),
                      name === "Costo" ? "Costo unitario" : "Precio de venta",
                    ]}
                  />
                  <Bar dataKey="Costo" name="Costo" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} barSize={12} />
                  <Bar dataKey="Venta" name="Venta" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                Sin datos comparativos de precio y costo.
              </div>
            )}
          </ChartWrapper>
        </div>
      </div>
    </div>
  );
}
