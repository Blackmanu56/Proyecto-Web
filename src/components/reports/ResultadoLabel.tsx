"use client";

import React from "react";

interface ResultadoLabelProps {
  totalContado: number | null;
  totalEsperado: number;
}

export function getResultado(totalContado: number | null, totalEsperado: number) {
  if (totalContado === null || totalContado === undefined) {
    return { label: "Sin arqueo", colorClass: "text-text-muted" };
  }
  const diff = totalContado - totalEsperado;
  if (diff === 0) return { label: "Balance Correcto", colorClass: "text-success" };
  if (diff > 0) return { label: "Sobrante", colorClass: "text-info" };
  return { label: "Faltante", colorClass: "text-danger" };
}

export default function ResultadoLabel({ totalContado, totalEsperado }: ResultadoLabelProps) {
  const { label, colorClass } = getResultado(totalContado, totalEsperado);

  return <span className={`text-[10px] font-bold ${colorClass}`}>{label}</span>;
}
