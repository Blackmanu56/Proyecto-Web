"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ProveedoresDashboard, ProveedoresDashboardFilters, ProveedorProductoRow } from "@/actions/informes";
import { getProveedoresDashboard } from "@/actions/informes";
import ChartWrapper, { CHART_COLORS } from "@/components/ui/ChartWrapper";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils";
import {
  Building2, ChevronDown, ChevronRight, ChevronUp, Package, Printer, RefreshCw,
  Search, ShoppingCart, TrendingUp, Users,
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

const PAGE_SIZE = 10;

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
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center flex flex-col items-center justify-center">
      <div className="flex items-center gap-1.5 text-[var(--brand)] mb-1">{icon}</div>
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

// ── Vista: sección de reposición por proveedor ─────────────────────────
function ReposicionSection({
  data,
  expandidaId,
  onToggle,
}: {
  data: ProveedoresDashboard;
  expandidaId: number | null;
  onToggle: (id: number) => void;
}) {
  if (data.reposicionResumen.length === 0) {
    return (
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
        <h3 className={sectionHeaderClass + " mb-3"}>Reposición por Proveedor</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          No hay productos por debajo del stock mínimo. La reposición está al día.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className={sectionHeaderClass}>Reposición por Proveedor</h3>
        <span className="text-xs text-[var(--text-secondary)]">
          {data.reposicionResumen.length} proveedor(es) con pendientes
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className={tableCellHeader + " text-left"}>Proveedor</th>
              <th className={tableCellHeader + " text-right"}>Productos a reponer</th>
              <th className={tableCellHeader + " text-right"}>Sin stock</th>
              <th className={tableCellHeader + " text-right"}>Stock bajo</th>
              <th className={tableCellHeader + " text-left"}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {data.reposicionResumen.map((r) => {
              const abierta = expandidaId === r.proveedorId;
              const detalle = data.reposicionDetalle.filter((d) => d.proveedorId === r.proveedorId);
              return (
                <React.Fragment key={r.proveedorId}>
                  <tr
                    className="border-b border-[var(--border)] hover:bg-[var(--card)] cursor-pointer"
                    onClick={() => onToggle(r.proveedorId)}
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--text)]">{r.proveedor}</td>
                    <td className="px-4 py-3 text-right text-[var(--text)]">{r.aReponer}</td>
                    <td className="px-4 py-3 text-right text-[var(--text)]">{r.sinStock}</td>
                    <td className="px-4 py-3 text-right text-[var(--text)]">{r.stockBajo}</td>
                    <td className="px-4 py-3 text-[var(--brand)]">
                      {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                  </tr>
                  {abierta && (
                    <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                      <td colSpan={5} className="px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Producto</th>
                              <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Código</th>
                              <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Categoría</th>
                              <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Marca</th>
                              <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock actual</th>
                              <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Mínimo</th>
                              <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Déficit</th>
                              <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalle.map((d) => (
                              <tr key={d.proveedorId + d.codigo + d.producto} className="border-b border-[var(--border)] last:border-0">
                                <td className="px-3 py-2 font-medium text-[var(--text)]">{d.producto}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{d.codigo}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{d.categoria}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{d.marca}</td>
                                <td className="px-3 py-2 text-right text-[var(--text)]">{d.stockActual}</td>
                                <td className="px-3 py-2 text-right text-[var(--text-muted)]">{d.stockMinimo}</td>
                                <td className="px-3 py-2 text-right font-bold text-amber-400">{d.deficit}</td>
                                <td className="px-3 py-2">
                                  <Badge variant={d.estado === "Sin stock" ? "danger" : "warning"}>{d.estado}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Vista: tabla de proveedores con detalle expandible ─────────────────
function TablaProveedoresSection({
  data,
  search,
  onSearch,
}: {
  data: ProveedoresDashboard;
  search: string;
  onSearch: (v: string) => void;
}) {
  const [expandidaId, setExpandidaId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const filas = filtered.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const toggle = (id: number) => setExpandidaId((cur) => (cur === id ? null : id));

  if (data.proveedores.length === 0) {
    return (
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
        <h3 className={sectionHeaderClass + " mb-3"}>Proveedores</h3>
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className={tableCellHeader + " text-left"}>Proveedor</th>
              <th className={tableCellHeader + " text-left"}>Contacto</th>
              <th className={tableCellHeader + " text-right"}>Productos</th>
              <th className={tableCellHeader + " text-right"}>A reponer</th>
              <th className={tableCellHeader + " text-right"}>Sin stock</th>
              <th className={tableCellHeader + " text-right"}>Total Gastado</th>
              <th className={tableCellHeader + " text-left"}>Última Compra</th>
              <th className={tableCellHeader + " text-left"}>Estado</th>
              <th className={tableCellHeader + " text-left"}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const abierta = expandidaId === r.proveedorId;
              const repo = repoMap.get(r.proveedorId);
              const valorCosto = valorCostoMap.get(r.proveedorId) ?? 0;
              const sinStockP = r.productos.filter((p) => p.cantidad === 0).length;
              const stockBajoP = r.productos.filter((p) => p.cantidad > 0 && p.cantidad <= p.stockMinimo).length;
              const normalesP = r.productos.filter((p) => p.cantidad > p.stockMinimo).length;
              return (
                <React.Fragment key={r.proveedorId}>
                  <tr
                    className="border-b border-[var(--border)] hover:bg-[var(--card)] cursor-pointer"
                    onClick={() => toggle(r.proveedorId)}
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
                    <td className="px-4 py-3">
                      <Badge variant={r.activo ? "success" : "danger"}>{r.activo ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--brand)]">
                      {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                  </tr>
                  {abierta && (
                    <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                      <td colSpan={9} className="px-4 py-3">
                        {/* (a) Información general */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="space-y-1">
                            <p className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Información general</p>
                            <p className="text-[var(--text)]">CUIT: {r.cuit}</p>
                            <p className="text-[var(--text)]">Tel: {r.telefono}</p>
                            <p className="text-[var(--text)]">Email: {r.email}</p>
                            <p className="text-[var(--text)]">Dirección: {r.direccion}</p>
                            <p className="text-[var(--text)]">Contacto responsable: {r.contactoResponsable}</p>
                            {r.acciones.length > 0 && (
                              <div className="pt-1">
                                <p className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Acciones sugeridas</p>
                                {r.acciones.map((a) => (
                                  <p key={a} className="text-amber-400">• {a}</p>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* (b) Resumen de productos */}
                          <div className="space-y-1">
                            <p className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Resumen</p>
                            <p className="text-[var(--text)]">Productos suministrados: {r.productos.length}</p>
                            <p className="text-[var(--text)]">Con stock normal: {normalesP}</p>
                            <p className="text-[var(--text)]">Con stock bajo: {stockBajoP}</p>
                            <p className="text-[var(--text)]">Sin stock: {sinStockP}</p>
                            <p className="text-[var(--text)]">Requieren reposición: {repo?.aReponer ?? 0}</p>
                            <p className="text-[var(--text)]">Valor inventario a costo: <strong>{formatCurrency(valorCosto)}</strong></p>
                          </div>
                          {/* (d) Historial de compras */}
                          <div className="space-y-1">
                            <p className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Historial de compras</p>
                            <p className="text-[var(--text)]">Reposiciones: {r.totalCompras}</p>
                            <p className="text-[var(--text)]">Última compra: {r.ultimaCompra ? formatDateShort(new Date(r.ultimaCompra)) : "—"}</p>
                            <p className="text-[var(--text)]">Monto total: <strong>{formatCurrency(r.totalGastado)}</strong></p>
                          </div>
                        </div>
                        {/* (c) Tabla compacta de productos suministrados */}
                        <div className="mt-4">
                          <p className="font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Productos suministrados</p>
                          {r.productos.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-[var(--border)]">
                                    <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Producto</th>
                                    <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Categoría</th>
                                    <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Marca</th>
                                    <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock actual</th>
                                    <th className="px-3 py-2 text-right font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock mínimo</th>
                                    <th className="px-3 py-2 text-left font-bold text-[var(--text-muted)] uppercase tracking-wider">Estado del stock</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.productos.map((p: ProveedorProductoRow) => {
                                    const es = estadoStock(p.cantidad, p.stockMinimo);
                                    return (
                                      <tr key={p.nombre + p.codigo} className="border-b border-[var(--border)] last:border-0">
                                        <td className="px-3 py-2 font-medium text-[var(--text)]">{p.nombre}</td>
                                        <td className="px-3 py-2 text-[var(--text-secondary)]">{p.categoria}</td>
                                        <td className="px-3 py-2 text-[var(--text-secondary)]">{p.marca}</td>
                                        <td className="px-3 py-2 text-right text-[var(--text)]">{p.cantidad}</td>
                                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">{p.stockMinimo}</td>
                                        <td className="px-3 py-2">
                                          <Badge variant={es.variant}>{es.label}</Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-[var(--text-secondary)]">Sin productos asociados.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Paginación client-side */}
      {totalPages > 1 && (
        <div className="print:hidden flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">
            Página {paginaActual} de {totalPages} — {filtered.length} proveedor(es)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaActual <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-[var(--border)] text-xs font-semibold text-[var(--text)] disabled:opacity-40 hover:bg-[var(--brand)]/20 transition"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={paginaActual >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-[var(--border)] text-xs font-semibold text-[var(--text)] disabled:opacity-40 hover:bg-[var(--brand)]/20 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────
export default function ProveedoresReport({ initialData, userRole }: Props) {
  // Datos servidos por la página (getProveedoresDashboard); los filtros
  // de búsqueda/estado/categoría/marca re-disparan la action server-side.
  const [data, setData] = useState<ProveedoresDashboard>(initialData);
  const [filtros, setFiltros] = useState<ProveedoresDashboardFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [reposicionExpandidaId, setReposicionExpandidaId] = useState<number | null>(null);
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

  const handleLimpiar = () => {
    setFiltros(DEFAULT_FILTERS);
    aplicarFiltros(DEFAULT_FILTERS);
  };

  const printActive = (id: string) => (printSection === id) || null;
  const { resumen } = data;

  return (
    <div className="space-y-4">
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
            <div className="sm:col-span-2 lg:col-span-4 flex items-end gap-2">
              <button
                type="button"
                onClick={handleAplicar}
                disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--brand)] text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 transition"
              >
                {isPending ? "Calculando..." : "Aplicar"}
              </button>
              <button
                type="button"
                onClick={handleLimpiar}
                disabled={isPending}
                className="px-3 py-2 rounded-lg bg-[var(--border)] text-xs font-bold text-[var(--text)] disabled:opacity-50 hover:opacity-80 transition"
              >
                <RefreshCw size={14} />
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
          <p className="text-sm">Informe de Proveedores</p>
          <p className="text-xs text-gray-500">Generado: {formatDate(new Date())}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        {/* 2. Resumen KPI */}
        <div className="print:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <h3 className={sectionHeaderClass + " mb-3"}>Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="Total de Proveedores"
              value={resumen.totalProveedores}
              icon={<Building2 size={16} />}
            />
            <KpiCard
              label="Activos"
              value={resumen.activos}
              icon={<Users size={16} />}
            />
            <KpiCard
              label="Inactivos"
              value={resumen.inactivos}
              icon={<Users size={16} />}
            />
            <KpiCard
              label="Productos con Proveedor"
              value={resumen.productosConProveedor}
              icon={<Package size={16} />}
            />
            <KpiCard
              label="Proveedores sin Compras"
              value={resumen.proveedoresSinCompras}
              sub={resumen.proveedoresSinCompras > 0 ? "requieren atención" : "al día"}
              icon={<ShoppingCart size={16} />}
            />
            <KpiCard
              label="Proveedor Principal"
              value={resumen.proveedorPrincipal ? resumen.proveedorPrincipal.nombre : "—"}
              sub={resumen.proveedorPrincipal ? `${resumen.proveedorPrincipal.productos} producto(s)` : undefined}
              icon={<TrendingUp size={16} />}
            />
          </div>
        </div>

        {/* 3. Fila de gráficos */}
        <div className="report-section" data-section-id="charts" data-print-active={printActive("charts")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Análisis</h3>
            <button
              type="button"
              className={printButtonClass}
              onClick={() => setPrintSection("charts")}
              title="Imprimir esta sección"
            >
              <Printer size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartWrapper title="Productos por Proveedor" height={260}>
              {data.productosPorProveedor.length > 0 ? (
                <BarChart data={data.productosPorProveedor} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={110} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} />
                  <Tooltip {...tooltipStyle} />
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
                  <Tooltip {...tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
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

        {/* 4. Reposición por proveedor */}
        <div className="report-section" data-section-id="reposicion" data-print-active={printActive("reposicion")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Reposición</h3>
            <button
              type="button"
              className={printButtonClass}
              onClick={() => setPrintSection("reposicion")}
              title="Imprimir esta sección"
            >
              <Printer size={14} />
            </button>
          </div>
          <ReposicionSection
            data={data}
            expandidaId={reposicionExpandidaId}
            onToggle={(id) => setReposicionExpandidaId((cur) => (cur === id ? null : id))}
          />
        </div>

        {/* 5. Tabla de proveedores */}
        <div className="report-section" data-section-id="tabla" data-print-active={printActive("tabla")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={sectionHeaderClass}>Proveedores</h3>
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
          />
        </div>
      </div>
    </div>
  );
}
