"use client";

import React, { useState, useEffect } from "react";
import { getMovimientosProducto } from "@/actions/productos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, ExternalLink, User } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { TipoMovimientoProducto } from "@prisma/client";

interface MovimientoProductoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoId: number;
  productoNombre: string;
}

interface MovimientoEntry {
  id: number;
  createdAt: Date;
  tipo: TipoMovimientoProducto;
  cantidadAnterior: number;
  cantidadNueva: number;
  compraId: number | null;
  ventaId: number | null;
  motivo: string;
  observacion: string | null;
  cambios: Array<{ campo: string; anterior: unknown; nuevo: unknown }> | null;
  usuario: {
    id: number;
    username: string;
    nombreCompleto: string;
  };
}

const TIPO_BADGE: Record<TipoMovimientoProducto, { label: string; className: string }> = {
  COMPRA:              { label: "Compra",              className: "bg-blue-500/15 text-blue-400 ring-blue-500/30" },
  VENTA:               { label: "Venta",               className: "bg-purple-500/15 text-purple-400 ring-purple-500/30" },
  RESTA_MANUAL:        { label: "Resta manual",        className: "bg-red-500/15 text-red-400 ring-red-500/30" },
  EDICION:             { label: "Edición",             className: "bg-amber-500/15 text-amber-400 ring-amber-500/30" },
  REPOSICION_DIRECTA:  { label: "Reposición directa",  className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" },
  REPOSICION_APROBADA: { label: "Reposición aprobada", className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" },
};

export default function MovimientoProductoModal({
  open,
  onOpenChange,
  productoId,
  productoNombre,
}: MovimientoProductoModalProps) {
  const [movimientos, setMovimientos] = useState<MovimientoEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchMovimientos = async () => {
      setLoading(true);
      try {
        const data = await getMovimientosProducto(productoId);
        setMovimientos(data as MovimientoEntry[]);
      } catch {
        setMovimientos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovimientos();
  }, [open, productoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-info" />
            Historial de movimientos
          </DialogTitle>
          <DialogDescription>
            Movimientos de stock de{" "}
            <span className="font-medium text-text">{productoNombre}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">Cargando movimientos...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">
                No hay movimientos registrados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {movimientos.map((entry) => {
                const fecha = new Date(entry.createdAt);
                const fechaStr = formatDate(fecha);
                const badge = TIPO_BADGE[entry.tipo];

                return (
                  <div
                    key={entry.id}
                    className="rounded-[var(--radius-md)] border border-border bg-card p-4 space-y-2"
                  >
                    {/* Fecha, tipo y usuario */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">
                        {fechaStr}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <User className="h-3 w-3" />
                        {entry.usuario.nombreCompleto || entry.usuario.username}
                      </span>
                    </div>

                    {/* Tipo badge */}
                    <Badge
                      variant="default"
                      size="sm"
                      className={badge.className}
                    >
                      {badge.label}
                    </Badge>

                    {/* Stock change */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-medium text-text-secondary">
                        {entry.cantidadAnterior}
                      </span>
                      <ArrowRight className="h-3 w-3 text-text-secondary flex-shrink-0" />
                      <span className="font-mono font-medium text-text">
                        {entry.cantidadNueva}
                      </span>
                      <span className="text-xs text-text-muted">unidades</span>
                    </div>

                    {/* Motivo */}
                    <p className="text-xs text-text-muted">
                      <span className="font-medium">Motivo:</span>{" "}
                      {entry.motivo}
                    </p>

                    {/* Observación */}
                    {entry.observacion && (
                      <p className="text-xs italic text-text-secondary">
                        {entry.observacion}
                      </p>
                    )}

                    {/* Cambios (EDICION) */}
                    {entry.cambios && entry.cambios.length > 0 && (
                      <div className="mt-2 border-t border-border/60 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">
                          Cambios
                        </p>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-text-secondary">
                              <th className="text-left font-medium pr-2">Campo</th>
                              <th className="text-left font-medium" colSpan={2}>
                                Anterior → Nuevo
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.cambios.map((cambio, i) => (
                              <tr key={i} className="text-text-muted">
                                <td className="pr-2 py-0.5">{cambio.campo}</td>
                                <td className="py-0.5">
                                  {String(cambio.anterior ?? "—")}
                                </td>
                                <td className="py-0.5">
                                  → {String(cambio.nuevo ?? "—")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Compra/Venta link */}
                    {entry.compraId && (
                      <a
                        href={`/compras/${entry.compraId}`}
                        className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver compra #{entry.compraId}
                      </a>
                    )}
                    {entry.ventaId && (
                      <a
                        href={`/ventas/${entry.ventaId}`}
                        className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver venta #{entry.ventaId}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
