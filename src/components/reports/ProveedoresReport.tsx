"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ProveedoresDashboard, ProveedoresDashboardFilters, ProveedorTablaRow } from "@/actions/informes";
import { getProveedoresDashboard } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Eye, Printer, RefreshCw, Search,
} from "lucide-react";
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
import DetalleProveedorModal from "./DetalleProveedorModal";

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

const DEFAULT_FILTERS: ProveedoresDashboardFilters = {
  estado: "todos",
  categoriaId: "TODAS",
  marcaId: "TODAS",
  search: "",
};

type SubViewId = "analisis" | "detalle";

interface Props {
  initialData: ProveedoresDashboard;
  userRole?: string;
}

// Estado de stock de un producto: Sin stock / Stock bajo / Normal
function estadoStock(cantidad: number, stockMinimo: number): { label: string; variant: "success" | "warning" | "danger" } {
  if (cantidad === 0) return { label: "Sin stock", variant: "danger" };
  if (cantidad <= stockMinimo) return { label: "Stock bajo", variant: "warning" };
  return { label: "Normal", variant: "success" };
}

// ── Fragmento: tarjeta KPI ─────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
      <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-sm font-bold text-[var(--text)] break-words">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Tooltip del pie: "{nombre}: {porcentaje}% del catálogo" ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={tooltipStyle.contentStyle}>
      <p style={{ ...tooltipStyle.labelStyle, marginBottom: 2 }}>{p.nombre}</p>
      <p style={tooltipStyle.itemStyle}>
        <strong>{p.porcentaje}%</strong> del catálogo
      </p>
    </div>
  );
}


// ── Vista: tabla de proveedores con detalle en modal ───────────────────
function TablaProveedoresSection({
  data,
  search,
  onSearch,
  onViewDetail,
}: {
  data: ProveedoresDashboard;
  search: string;
  onSearch: (v: string) => void;
  onViewDetail: (r: ProveedorTablaRow) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Búsqueda client-side adicional (nombre, CUIT o email); el estado y la
  // búsqueda principal ya vienen filtrados server-side.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.proveedores;
    return data.proveedores.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.cuit.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [search, data]);

  // Lookups para columnas "A reponer"/"Sin stock" y valor de inventario a costo
  const repoMap = useMemo(
    () => new Map(data.reposicionResumen.map((r) => [r.proveedorId, r])),
    [data]
  );
  const valorCostoMap = useMemo(
    () => new Map(data.valorCostoPorProveedor.map((v) => [v.proveedorId, v.valor])),
    [data]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const filas = filtered.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);

  if (data.proveedores.length === 0) {
    return (
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
        <h3 className={sectionHeaderClass + " mb-3"}>Detalle de Proveedores</h3>
        <p className="text-sm text-[var(--text-secondary)]">No hay proveedores cargados.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="print:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <Search size={16} className="text-[var(--text-muted)] shrink-0" />
        <label className="text-xs font-semibold text-[var(--text-muted)] shrink-0">Buscar proveedor</label>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            onSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre, CUIT o email..."
          className={inputClass}
        />
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[780px]">
          <thead>
            <tr className="border-b border-[var(--border)] whitespace-nowrap bg-[var(--card)]">
              <th className={tableCellHeader + " text-left"}>Proveedor</th>
              <th className={tableCellHeader + " text-left"}>Contacto</th>
              <th className={tableCellHeader + " text-right"}>Productos</th>
              <th className={tableCellHeader + " text-right"}>A reponer</th>
              <th className={tableCellHeader + " text-right"}>Sin stock</th>
              <th className={tableCellHeader + " text-right"}>Total Gastado</th>
              <th className={tableCellHeader + " text-left"}>Última Compra</th>
              <th className={tableCellHeader + " text-center"}>Estado</th>
              <th className={tableCellHeader + " text-center print:hidden"}>Det.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filas.map((r) => {
              const repo = repoMap.get(r.proveedorId);
              return (
                <tr
                  key={r.proveedorId}
                  className="hover:bg-[var(--card)] cursor-pointer transition-colors"
                  onClick={() => onViewDetail(r)}
                >
                  <td className="px-4 py-3 font-semibold text-[var(--text)]">{r.nombre}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.email === "—" ? r.telefono : r.email}</td>
                  <td className="px-4 py-3 text-right text-[var(--text)]">{r.totalProductos}</td>
                  <td className="px-4 py-3 text-right text-[var(--text)]">{repo?.aReponer ?? 0}</td>
                  <td className="px-4 py-3 text-right text-[var(--text)]">{repo?.sinStock ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">{formatCurrency(r.totalGastado)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {r.ultimaCompra ? formatDateShort(new Date(r.ultimaCompra)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.activo ? "success" : "danger"}>{r.activo ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center print:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetail(r);
                      }}
                      className="h-8 w-8 p-0 hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      title="Ver detalle del proveedor"
                    >
                      <Eye size={14} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Barra de Paginación */}
      {filtered.length > 0 && (
        <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]/50 gap-4 flex-wrap text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>
              Mostrando{" "}
              <strong className="text-[var(--text)]">
                {Math.min((paginaActual - 1) * pageSize + 1, filtered.length)}
              </strong>{" "}
              a{" "}
              <strong className="text-[var(--text)]">
                {Math.min(paginaActual * pageSize, filtered.length)}
              </strong>{" "}
              de <strong className="text-[var(--text)]">{filtered.length}</strong> proveedores
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={paginaActual <= 1}
                className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Primera página"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={paginaActual <= 1}
                className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2">
                Página <strong>{paginaActual}</strong> de <strong>{totalPages}</strong>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={paginaActual >= totalPages}
                className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Página siguiente"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={paginaActual >= totalPages}
                className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Última página"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────
export default function ProveedoresReport({ initialData, userRole }: Props) {
  // Sub-módulos: Análisis | Detalle de proveedores | Reposición
  const [activeSubView, setActiveSubView] = useState<SubViewId>("analisis");

  // Datos servidos por la página (getProveedoresDashboard); los filtros
  // de búsqueda/estado/categoría/marca re-disparan la action server-side.
  const [data, setData] = useState<ProveedoresDashboard>(initialData);
  const [filtros, setFiltros] = useState<ProveedoresDashboardFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<ProveedorTablaRow | null>(null);
    const [printSection, setPrintSection] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (printSection) {
      const t = setTimeout(() => {
        window.print();
        setPrintSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [printSection]);

  const aplicarFiltros = useCallback((f: ProveedoresDashboardFilters) => {
    startTransition(async () => {
      const result = await getProveedoresDashboard(f);
      setData(result);
    });
  }, []);

  const handleAplicar = () => aplicarFiltros(filtros);

  const printActive = (id: string) => (printSection === id) || null;
  const { resumen } = data;

  return (
    <div className="space-y-4">
      {/* Selector de sub-vista */}
      <div className="print:hidden flex flex-wrap gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-1">
        {(["analisis", "detalle"] as SubViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => setActiveSubView(v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubView === v
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
            }`}
          >
            {v === "analisis"
              ? "Análisis"
              : "Detalle de proveedores"}
          </button>
        ))}
      </div>

      {/* 1. Filtros colapsables (incluye búsqueda por proveedor) */}
      <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            className="flex items-center gap-2 hover:text-[var(--text)] transition-colors shrink-0"
            onClick={() => setShowFilters((s) => !s)}
          >
            <Search size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-muted)]">
              {showFilters ? "Ocultar filtros" : "Filtros"}
            </span>
            {showFilters ? (
              <ChevronUp size={14} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            )}
          </button>
        </div>
        {showFilters && (
          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Buscar proveedor</label>
                <input
                  type="text"
                  value={filtros.search ?? ""}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Buscar por nombre..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Estado</label>
                <Select
                  value={filtros.estado}
                  onValueChange={(v) => setFiltros((f) => ({ ...f, estado: v as ProveedoresDashboardFilters["estado"] }))}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activos">Activos</SelectItem>
                    <SelectItem value="inactivos">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Categoría</label>
                <Select
                  value={filtros.categoriaId}
                  onValueChange={(v) => setFiltros((f) => ({ ...f, categoriaId: v }))}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las categorías</SelectItem>
                    {data.filtros.categorias.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Marca</label>
                <Select
                  value={filtros.marcaId}
                  onValueChange={(v) => setFiltros((f) => ({ ...f, marcaId: v }))}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las marcas</SelectItem>
                    {data.filtros.marcas.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex items-end">
                <button
                  type="button"
                  onClick={handleAplicar}
                  disabled={isPending}
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
                >
                  <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                  {isPending ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="print:bg-white print:text-black space-y-4">
        {/* Encabezado de impresión */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
          <p className="text-sm">
            Informe de Proveedores —{" "}
            {activeSubView === "analisis"
              ? "Análisis"
              : "Detalle de Proveedores"}
          </p>
          <p className="text-xs text-gray-500">Generado: {formatDate(new Date())}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* ── 1. SUBMÓDULO ANÁLISIS ── */}
        {activeSubView === "analisis" && (
          <>
            {/* Resumen KPI */}
            <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                  label="Total de Proveedores"
                  value={resumen.totalProveedores}
                />
                <KpiCard
                  label="Activos"
                  value={resumen.activos}
                />
                <KpiCard
                  label="Inactivos"
                  value={resumen.inactivos}
                />
                <KpiCard
                  label="Productos con Proveedor"
                  value={resumen.productosConProveedor}
                />
                <KpiCard
                  label="Proveedores sin Compras"
                  value={resumen.proveedoresSinCompras}
                  sub={resumen.proveedoresSinCompras > 0 ? "requieren atención" : "al día"}
                />
                <KpiCard
                  label="Proveedor Principal"
                  value={resumen.proveedorPrincipal ? resumen.proveedorPrincipal.nombre : "—"}
                  sub={resumen.proveedorPrincipal ? `${resumen.proveedorPrincipal.productos} producto(s)` : undefined}
                />
              </div>
            </div>

            {/* Fila de gráficos */}
            <div>
              <div className="mb-2">
                <h3 className={sectionHeaderClass}>Análisis Gráfico</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
                <ChartWrapper title="Productos por Proveedor" height={260}>
                  {data.productosPorProveedor.length > 0 ? (
                    <BarChart data={data.productosPorProveedor} layout="vertical" margin={{ left: 24, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" width={110} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} />
                      <Tooltip {...tooltipStyle} cursor={false} />
                      <Bar dataKey="cantidad" name="Productos" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
                      Sin productos para los filtros seleccionados.
                    </div>
                  )}
                </ChartWrapper>

                <ChartWrapper title="Participación del Catálogo" height={260}>
                  {data.participacion.length > 0 ? (
                    <RePie>
                      <Pie
                        data={data.participacion}
                        dataKey="totalProductos"
                        nameKey="nombre"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {data.participacion.map((entry, i) => (
                          <Cell key={entry.proveedorId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </RePie>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
                      Sin datos para los filtros seleccionados.
                    </div>
                  )}
                </ChartWrapper>

                <ChartWrapper title="Valor en Costo por Proveedor" height={260}>
                  {data.valorCostoPorProveedor.length > 0 ? (
                    <BarChart data={data.valorCostoPorProveedor} layout="vertical" margin={{ left: 24, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v: number) => `$${v}`} />
                      <YAxis type="category" dataKey="nombre" width={110} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} />
                      <Tooltip {...tooltipStyle} cursor={false} formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="valor" name="Valor a costo" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
                      Sin inventario a costo para los filtros seleccionados.
                    </div>
                  )}
                </ChartWrapper>
              </div>
            </div>
          </>
        )}

        {/* ── 2. SUBMÓDULO DETALLE DE PROVEEDORES ── */}
        {activeSubView === "detalle" && (
          <div className="report-section" data-section-id="tabla" data-print-active={printActive("tabla")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={sectionHeaderClass}>Detalle de Proveedores</h3>
              <button
                type="button"
                className={printButtonClass}
                onClick={() => setPrintSection("tabla")}
                title="Imprimir esta sección"
              >
                <Printer size={14} />
              </button>
            </div>
            <TablaProveedoresSection
              data={data}
              search={filtros.search ?? ""}
              onSearch={(v) => setFiltros((f) => ({ ...f, search: v }))}
              onViewDetail={(r) => setSelectedProveedor(r)}
            />
          </div>
        )}

        
      </div>

      {/* Modal de Detalle de Proveedor */}
      {selectedProveedor && (
        <DetalleProveedorModal
          proveedor={selectedProveedor}
          repoInfo={data.reposicionResumen.find((r) => r.proveedorId === selectedProveedor.proveedorId)}
          valorCosto={data.valorCostoPorProveedor.find((v) => v.proveedorId === selectedProveedor.proveedorId)?.valor ?? 0}
          onClose={() => setSelectedProveedor(null)}
        />
      )}

      
    </div>
  );
}
