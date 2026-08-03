"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartWrapperProps {
  title: string;
  children: React.ReactElement;
  height?: number;
}

const CHART_COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#38bdf8", // sky
  "#a78bfa", // purple
  "#f472b6", // pink
  "#2dd4bf", // teal
];

export { CHART_COLORS };

export default function ChartWrapper({
  title,
  children,
  height = 300,
}: ChartWrapperProps) {
  // Gateamos el montaje de los charts hasta el primer paint del cliente.
  // Recharts mide el contenedor con getBoundingClientRect/ResizeObserver; si el
  // componente se monta con layout 0 (montaje por tabs, animaciones, SSR), el
  // SVG nace con tamaño 0 y, si el data nunca cambia (no hay Cargar/filtros),
  // no hay re-render que dispare una re-medición → gráficos vacíos para siempre.
  // Al montar el ResponsiveContainer recién acá, nace con layout real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children directly dentro de ResponsiveContainer.
  // Antes usábamos React.cloneElement para inyectar margin + Tooltip + Legend,
  // pero en React 19.2 + recharts 2.15, cloneElement produce un elemento que
  // recharts no puede renderizar (charts vacíos). La solución limpia es renderizar
  // children directamente — cada informe puede agregar Tooltip/Legend si lo necesita.
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <h3 className="text-sm font-semibold text-text-muted mb-4">{title}</h3>
      <div style={{ width: "100%", height }}>
        {mounted && <ResponsiveContainer>{children}</ResponsiveContainer>}
      </div>
    </div>
  );
}
