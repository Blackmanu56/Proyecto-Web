"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Calculator,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import {
  type TipoAjustePrecio,
  type CalculoPrecioItem,
} from "@/lib/ajuste-precios";
import { previewAjustePreciosMasivo, ajustarPreciosMasivo } from "@/actions/productos";

/* ────────────────────── Types ────────────────────── */

interface AjustePreciosMasivoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: number; nombre: string }[];
  marcas: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
  onSuccess: () => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20, 25, -5, -10];

const MOTIVO_SUGGESTIONS = [
  "Actualización por nueva lista del proveedor",
  "Ajuste general por inflación",
  "Actualización de precios de temporada",
  "Ajuste de margen comercial general",
  "Corrección masiva de costos",
];

export default function AjustePreciosMasivoModal({
  open,
  onOpenChange,
  categorias,
  marcas,
  proveedores,
  onSuccess,
}: AjustePreciosMasivoModalProps) {
  const [isPending, startTransition] = useTransition();

  // 1. Filtros
  const [categoriaId, setCategoriaId] = useState<number | "all">("all");
  const [marca, setMarca] = useState<string | "all">("all");
  const [proveedorId, setProveedorId] = useState<number | "all">("all");
  const [estado, setEstado] = useState<"activos" | "inactivos" | "todos">("activos");

  // 2. Configuración del Ajuste (Idéntica a Ajuste Individual)
  const [ajustarCompra, setAjustarCompra] = useState(false);
  const [metodoCompra, setMetodoCompra] = useState<TipoAjustePrecio>("PORCENTAJE");
  const [valorCompra, setValorCompra] = useState<number | "">("");

  const [ajustarVenta, setAjustarVenta] = useState(true);
  const [metodoVenta, setMetodoVenta] = useState<TipoAjustePrecio>("PORCENTAJE");
  const [valorVenta, setValorVenta] = useState<number | "">(10);

  // 3. Live Preview State
  const [previewItems, setPreviewItems] = useState<CalculoPrecioItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");

  // 4. Motivo y Confirmación
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ── Reset ── */
  const resetForm = () => {
    setCategoriaId("all");
    setMarca("all");
    setProveedorId("all");
    setEstado("activos");
    setAjustarCompra(false);
    setMetodoCompra("PORCENTAJE");
    setValorCompra("");
    setAjustarVenta(true);
    setMetodoVenta("PORCENTAJE");
    setValorVenta(10);
    setPreviewItems([]);
    setPreviewSearch("");
    setMotivo("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const numValorCompra = typeof valorCompra === "number" ? valorCompra : 0;
  const numValorVenta = typeof valorVenta === "number" ? valorVenta : 0;

  /* ── Fetch Live Preview ── */
  const fetchPreview = useCallback(async () => {
    if (!ajustarCompra && !ajustarVenta) {
      setPreviewItems([]);
      return;
    }
    if (ajustarCompra && (valorCompra === "" || numValorCompra === 0) && (!ajustarVenta || valorVenta === "" || numValorVenta === 0)) {
      setPreviewItems([]);
      return;
    }
    if (ajustarVenta && (valorVenta === "" || numValorVenta === 0) && (!ajustarCompra || valorCompra === "" || numValorCompra === 0)) {
      setPreviewItems([]);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const payload = {
        ajustarCompra,
        metodoCompra: ajustarCompra ? metodoCompra : undefined,
        valorCompra: ajustarCompra ? numValorCompra : undefined,
        ajustarVenta,
        metodoVenta: ajustarVenta ? metodoVenta : undefined,
        valorVenta: ajustarVenta ? numValorVenta : undefined,
        filtros: {
          categoriaId,
          marca,
          proveedorId,
          estado,
        },
        redondeo: "SIN_REDONDEO" as const,
        motivo: "Previsualización",
      };

      const res = await previewAjustePreciosMasivo(payload);

      if ("error" in res && res.error) {
        setPreviewError(res.error);
        setPreviewItems([]);
      } else if ("items" in res && res.items) {
        setPreviewItems(res.items);
        if (res.hayErroresCalculo && res.mensajeErrorCalculo) {
          setPreviewError(res.mensajeErrorCalculo);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al obtener vista previa";
      setPreviewError(msg);
      setPreviewItems([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [ajustarCompra, metodoCompra, valorCompra, numValorCompra, ajustarVenta, metodoVenta, valorVenta, numValorVenta, categoriaId, marca, proveedorId, estado]);

  /* ── Trigger Preview on change with debounce ── */
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetchPreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [open, fetchPreview]);

  /* ── Filtered Preview Items by Search ── */
  const filteredPreview = useMemo(() => {
    if (!previewSearch.trim()) return previewItems;
    const q = previewSearch.toLowerCase();
    return previewItems.filter(
      (item) =>
        item.nombre.toLowerCase().includes(q) ||
        (item.codigo && item.codigo.toLowerCase().includes(q)) ||
        (item.marca && item.marca.toLowerCase().includes(q)) ||
        (item.categoria && item.categoria.toLowerCase().includes(q))
    );
  }, [previewItems, previewSearch]);

  // Validation
  const isValid =
    (ajustarCompra || ajustarVenta) &&
    (!ajustarCompra || (valorCompra !== "" && numValorCompra !== 0)) &&
    (!ajustarVenta || (valorVenta !== "" && numValorVenta !== 0)) &&
    previewItems.length > 0 &&
    !previewError?.includes("precio menor o igual a $0") &&
    motivo.trim().length >= 3;

  /* ── Submit Handler ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isPending) return;

    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          ajustarCompra,
          metodoCompra: ajustarCompra ? metodoCompra : undefined,
          valorCompra: ajustarCompra ? numValorCompra : undefined,
          ajustarVenta,
          metodoVenta: ajustarVenta ? metodoVenta : undefined,
          valorVenta: ajustarVenta ? numValorVenta : undefined,
          filtros: {
            categoriaId,
            marca,
            proveedorId,
            estado,
          },
          redondeo: "SIN_REDONDEO" as const,
          motivo: motivo.trim(),
        };

        const result = await ajustarPreciosMasivo(payload);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
          return;
        }

        toast.success(
          `¡Ajuste masivo completado! Se actualizaron ${result.totalModificados} productos.`
        );
        onSuccess();
        handleClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error inesperado al aplicar ajuste masivo";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[94vh] flex flex-col p-0 overflow-hidden bg-[var(--card)] border-[var(--border)] rounded-2xl shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#047857]/15 text-[#34D399] ring-1 ring-[#047857]/25">
              <TrendingUp size={22} strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[var(--text)]">
                Ajuste Masivo de Precios
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-secondary)]">
                Aplicá aumentos o disminuciones a múltiples productos filtrados por categoría, marca o proveedor.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin]">
          {/* 1. SECCIÓN: Filtros de Selección */}
          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Filter size={14} className="text-blue-400" />
                1. Alcance / Filtros de Productos
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Categoría */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Categoría
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) =>
                    setCategoriaId(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="w-full h-9 px-2.5 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Todas las categorías</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marca */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Marca
                </label>
                <select
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Todas las marcas</option>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.nombre}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Proveedor
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) =>
                    setProveedorId(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="w-full h-9 px-2.5 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Todos los proveedores</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as typeof estado)}
                  className="w-full h-9 px-2.5 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                  <option value="todos">Todos los estados</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. SECCIÓN: Configuración del Ajuste (Idéntica a Ajuste Individual) */}
          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calculator size={14} className="text-[#34D399]" />
              2. Configuración del Ajuste
            </h3>

            {/* Configuración de Precios en 2 Columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* PRECIO DE COMPRA */}
              <div
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200",
                  ajustarCompra
                    ? "bg-blue-500/[0.04] border-blue-500/40 ring-1 ring-blue-500/20"
                    : "bg-[var(--panel)]/50 border-[var(--border)]/70 opacity-70"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ajustarCompra}
                      onChange={(e) => setAjustarCompra(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Precio de Compra
                    </span>
                  </label>
                </div>

                {ajustarCompra ? (
                  <div className="space-y-3 animate-in fade-in-0 duration-150">
                    {/* Selector Método */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--panel)] rounded-lg border border-[var(--border)] text-xs font-semibold">
                      {(
                        [
                          { key: "PORCENTAJE", label: "% Porcentaje" },
                          { key: "MONTO_FIJO", label: "$ Monto Fijo" },
                          { key: "VALOR_DIRECTO", label: "Nuevo Valor" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => {
                            setMetodoCompra(m.key);
                            setValorCompra("");
                          }}
                          className={cn(
                            "py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors",
                            metodoCompra === m.key
                              ? "bg-blue-500 text-white shadow-sm"
                              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Input Valor */}
                    <div className="relative">
                      <input
                        type="number"
                        step={metodoCompra === "PORCENTAJE" ? "0.1" : "1"}
                        placeholder={
                          metodoCompra === "PORCENTAJE"
                            ? "Ej. 10 para +10% o -5 para -5%"
                            : metodoCompra === "MONTO_FIJO"
                            ? "Ej. 500 para +$500 o -200"
                            : "Ej. 15000"
                        }
                        value={valorCompra}
                        onChange={(e) =>
                          setValorCompra(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {/* Chips rápidos si es porcentaje */}
                    {metodoCompra === "PORCENTAJE" && (
                      <div className="flex flex-wrap gap-1">
                        {QUICK_PERCENTAGES.map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setValorCompra(pct)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors",
                              valorCompra === pct
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "bg-[var(--panel)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                            )}
                          >
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] py-2">
                    El precio de compra no se modificará en los productos seleccionados.
                  </p>
                )}
              </div>

              {/* PRECIO DE VENTA */}
              <div
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200",
                  ajustarVenta
                    ? "bg-[#047857]/[0.04] border-[#047857]/40 ring-1 ring-[#047857]/20"
                    : "bg-[var(--panel)]/50 border-[var(--border)]/70 opacity-70"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ajustarVenta}
                      onChange={(e) => setAjustarVenta(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-[#047857] cursor-pointer"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
                      Precio de Venta
                    </span>
                  </label>
                </div>

                {ajustarVenta ? (
                  <div className="space-y-3 animate-in fade-in-0 duration-150">
                    {/* Selector Método */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--panel)] rounded-lg border border-[var(--border)] text-xs font-semibold">
                      {(
                        [
                          { key: "PORCENTAJE", label: "% Porcentaje" },
                          { key: "MONTO_FIJO", label: "$ Monto Fijo" },
                          { key: "VALOR_DIRECTO", label: "Nuevo Valor" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => {
                            setMetodoVenta(m.key);
                            setValorVenta("");
                          }}
                          className={cn(
                            "py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors",
                            metodoVenta === m.key
                              ? "bg-[#047857] text-white shadow-sm"
                              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Input Valor */}
                    <div className="relative">
                      <input
                        type="number"
                        step={metodoVenta === "PORCENTAJE" ? "0.1" : "1"}
                        placeholder={
                          metodoVenta === "PORCENTAJE"
                            ? "Ej. 15 para +15% o -10"
                            : metodoVenta === "MONTO_FIJO"
                            ? "Ej. 1000 para +$1000"
                            : "Ej. 25000"
                        }
                        value={valorVenta}
                        onChange={(e) =>
                          setValorVenta(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none focus:border-[#047857] transition-colors"
                      />
                    </div>

                    {/* Chips rápidos si es porcentaje */}
                    {metodoVenta === "PORCENTAJE" && (
                      <div className="flex flex-wrap gap-1">
                        {QUICK_PERCENTAGES.map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setValorVenta(pct)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors",
                              valorVenta === pct
                                ? "bg-[#047857] border-[#047857] text-white"
                                : "bg-[var(--panel)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                            )}
                          >
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] py-2">
                    El precio de venta no se modificará en los productos seleccionados.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. SECCIÓN: Live Preview */}
          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  3. Previsualización de Resultados
                </h3>
                {previewLoading ? (
                  <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <RefreshCw size={12} className="animate-spin text-[#34D399]" />
                    Calculando...
                  </span>
                ) : (
                  <Badge variant={previewItems.length > 0 ? "success" : "default"} size="sm">
                    {previewItems.length} producto(s) afectados
                  </Badge>
                )}
              </div>

              {/* Buscador dentro del preview */}
              {previewItems.length > 0 && (
                <div className="relative w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Filtrar vista previa..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full h-7 pl-7 pr-6 bg-[var(--panel)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[#047857]"
                  />
                  {previewSearch && (
                    <button
                      type="button"
                      onClick={() => setPreviewSearch("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Error en el preview si hay precios <= 0 */}
            {previewError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{previewError}</span>
              </div>
            )}

            {/* Tabla de Preview */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] [scrollbar-width:thin]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] text-[10px] uppercase font-bold text-[var(--text-secondary)]">
                  <tr>
                    <th className="py-2 px-3">Producto</th>
                    {ajustarCompra && (
                      <th className="py-2 px-3 text-right">Compra Actual → Nueva</th>
                    )}
                    {ajustarVenta && (
                      <th className="py-2 px-3 text-right">Venta Actual → Nueva</th>
                    )}
                    <th className="py-2 px-3 text-center">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50 font-medium">
                  {previewLoading ? (
                    <tr>
                      <td colSpan={ajustarCompra && ajustarVenta ? 4 : 3} className="py-8 text-center text-[var(--text-secondary)]">
                        <RefreshCw size={18} className="animate-spin mx-auto text-[#34D399] mb-1" />
                        Calculando vista previa...
                      </td>
                    </tr>
                  ) : filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={ajustarCompra && ajustarVenta ? 4 : 3} className="py-8 text-center text-[var(--text-secondary)]">
                        {previewItems.length === 0
                          ? "No se encontraron productos que coincidan con los filtros seleccionados."
                          : "No hay productos que coincidan con la búsqueda."}
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map((item) => (
                      <tr key={item.productoId} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3">
                          <p className="font-semibold text-[var(--text)] truncate max-w-[240px]">{item.nombre}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                            {item.categoria && <span>{item.categoria}</span>}
                            {item.marca && <span>· {item.marca}</span>}
                          </div>
                        </td>

                        {/* Compra */}
                        {ajustarCompra && (
                          <td className="py-2 px-3 text-right font-mono">
                            <span className="text-[var(--text-secondary)] line-through mr-1">
                              {formatCurrency(item.precioCompraAnterior)}
                            </span>
                            <span className="text-blue-400 font-bold">
                              {formatCurrency(item.precioCompraNuevo)}
                            </span>
                            {item.diferenciaCompra !== 0 && (
                              <span
                                className={cn(
                                  "block text-[9px] font-bold",
                                  item.diferenciaCompra > 0 ? "text-amber-400" : "text-emerald-400"
                                )}
                              >
                                {item.diferenciaCompra > 0 ? `+${formatCurrency(item.diferenciaCompra)}` : formatCurrency(item.diferenciaCompra)}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Venta */}
                        {ajustarVenta && (
                          <td className="py-2 px-3 text-right font-mono">
                            <span className="text-[var(--text-secondary)] line-through mr-1">
                              {formatCurrency(item.precioVentaAnterior)}
                            </span>
                            <span className="text-[#34D399] font-bold">
                              {formatCurrency(item.precioVentaNuevo)}
                            </span>
                            {item.diferenciaVenta !== 0 && (
                              <span
                                className={cn(
                                  "block text-[9px] font-bold",
                                  item.diferenciaVenta > 0 ? "text-[#34D399]" : "text-[#F87171]"
                                )}
                              >
                                {item.diferenciaVenta > 0 ? `+${formatCurrency(item.diferenciaVenta)}` : formatCurrency(item.diferenciaVenta)}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Margen */}
                        <td className="py-2 px-3 text-center font-mono">
                          <span className="text-[var(--text-secondary)]">
                            {item.margenAnterior !== null ? `${item.margenAnterior}%` : "—"}
                          </span>
                          <span className="text-[var(--text-muted)] mx-1">→</span>
                          <span className="font-bold text-[var(--text)]">
                            {item.margenNuevo !== null ? `${item.margenNuevo}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. SECCIÓN: Motivo obligatorio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text)]">
              Motivo del ajuste masivo * <span className="text-[11px] font-normal text-[var(--text-secondary)]">(Obligatorio para auditoría)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Actualización de lista de precios de Motomax, aumento general por inflación..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#047857] transition-colors"
            />
            {/* Sugerencias de motivo */}
            <div className="flex flex-wrap gap-1 mt-1">
              {MOTIVO_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setMotivo(sug)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 5. Footer Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
            <div className="text-xs text-[var(--text-secondary)]">
              {previewItems.length > 0 && (
                <span>
                  Vas a modificar <strong>{previewItems.length} productos</strong>
                  {ajustarCompra && ajustarVenta
                    ? " (Compra y Venta)"
                    : ajustarCompra
                    ? " (Solo Compra)"
                    : " (Solo Venta)"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!isValid || isPending}
                loading={isPending}
                leftIcon={<CheckCircle size={15} />}
              >
                {previewItems.length > 0
                  ? `Confirmar ajuste (${previewItems.length} productos)`
                  : "Confirmar ajuste"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
