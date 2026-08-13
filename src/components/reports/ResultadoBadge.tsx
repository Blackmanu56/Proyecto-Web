"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface ResultadoBadgeProps {
  totalContado: number | null;
  totalEsperado: number;
}

export function getResultado(totalContado: number | null, totalEsperado: number) {
  if (totalContado === null) {
    return { label: "Sin arqueo", variant: "slate" as const, icon: Clock };
  }

  const diff = totalContado - totalEsperado;
  if (diff === 0) return { label: "Balance Correcto", variant: "emerald" as const, icon: CheckCircle };
  if (diff > 0) return { label: "Sobrante", variant: "blue" as const, icon: TrendingUp };
  return { label: "Faltante", variant: "red" as const, icon: AlertTriangle };
}

const VARIANT_CLASSES = {
  emerald: "bg-success-light text-success border border-success/20",
  blue: "bg-info-light text-info border border-info/20",
  red: "bg-danger-light text-danger border border-danger/20",
  slate: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
} as const;

export default function ResultadoBadge({ totalContado, totalEsperado }: ResultadoBadgeProps) {
  const { label, variant, icon: Icon } = getResultado(totalContado, totalEsperado);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${VARIANT_CLASSES[variant]}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}
