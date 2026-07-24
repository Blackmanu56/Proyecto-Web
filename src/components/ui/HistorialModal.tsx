"use client";

import React, { useState, useEffect } from "react";
import { getHistorialEstado } from "@/actions/productos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, User } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface HistorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoId: number;
  productoNombre: string;
}

interface HistorialEntry {
  id: number;
  fecha: Date;
  estadoAnterior: string;
  estadoNuevo: string;
  motivo: string;
  observacion: string | null;
  usuario: {
    id: number;
    username: string;
    nombreCompleto: string;
  };
}

const MOTIVO_LABELS: Record<string, string> = {
  VENCIDO: "Vencido",
  DEFECTUOSO: "Defectuoso",
  DISCONTINUADO: "Discontinuado",
  BAJA_TEMPORAL: "Baja temporal",
  YA_NO_SE_COMERCIALIZA: "Ya no se comercializa",
  OTRO: "Otro",
  REACTIVACION: "Reactivación",
};

function estadoBadgeVariant(estado: string): "success" | "danger" | "default" {
  if (estado === "ACTIVO") return "success";
  if (estado === "INACTIVO") return "danger";
  return "default";
}

export default function HistorialModal({
  open,
  onOpenChange,
  productoId,
  productoNombre,
}: HistorialModalProps) {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchHistorial = async () => {
      setLoading(true);
      try {
        const data = await getHistorialEstado(productoId);
        setHistorial(data as HistorialEntry[]);
      } catch {
        setHistorial([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [open, productoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-info" />
            Historial de estados
          </DialogTitle>
          <DialogDescription>
            Cambios de estado de{" "}
            <span className="font-medium text-text">{productoNombre}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">Cargando historial...</p>
            </div>
          ) : historial.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">
                No hay cambios de estado registrados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {historial.map((entry) => {
                const fecha = new Date(entry.fecha);
                const fechaStr = formatDate(fecha);

                return (
                  <div
                    key={entry.id}
                    className="rounded-[var(--radius-md)] border border-border bg-card p-4 space-y-2"
                  >
                    {/* Fecha y usuario */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">
                        {fechaStr}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <User className="h-3 w-3" />
                        {entry.usuario.nombreCompleto || entry.usuario.username}
                      </span>
                    </div>

                    {/* Estado anterior → Estado nuevo */}
                    <div className="flex items-center gap-2">
                      <Badge variant={estadoBadgeVariant(entry.estadoAnterior)} size="sm">
                        {entry.estadoAnterior}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-text-secondary flex-shrink-0" />
                      <Badge variant={estadoBadgeVariant(entry.estadoNuevo)} size="sm">
                        {entry.estadoNuevo}
                      </Badge>
                    </div>

                    {/* Motivo */}
                    <p className="text-xs text-text-muted">
                      <span className="font-medium">Motivo:</span>{" "}
                      {MOTIVO_LABELS[entry.motivo] || entry.motivo}
                    </p>

                    {/* Observación */}
                    {entry.observacion && (
                      <p className="text-xs italic text-text-secondary">
                        {entry.observacion}
                      </p>
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
