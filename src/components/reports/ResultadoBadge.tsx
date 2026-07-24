"use client";

import React from "react";
import { CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";

interface ResultadoBadgeProps {
  totalContado: number | null;
  totalEsperado: number;
}

function getResultado(totalContado: number | null, totalEsperado: number) {
  const diff = (totalContado ?? totalEsperado) - totalEsperado;
  if (diff === 0) return { label: "Balance Correcto", variant: "emerald" as const, icon: CheckCircle };
  if (diff > 0) return { label: "Sobrante", variant: "blue" as const, icon: TrendingUp };
  return { label: "Faltante", variant: "red" as const, icon: AlertTriangle };
}

const VARIANT_CLASSES = {
  emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  red: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
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
