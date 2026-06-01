"use client";

import React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface ChartWrapperProps {
  title: string;
  children: React.ReactElement;
  height?: number;
}

interface ChartProps {
  margin?: { top: number; right: number; left: number; bottom: number };
  children?: React.ReactNode;
}

const DARK_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "0.5rem",
    color: "#f1f5f9",
    fontSize: "0.875rem",
  },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#94a3b8" },
};

const DARK_LEGEND_PROPS = {
  wrapperStyle: { color: "#94a3b8" as const },
};

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

export { CHART_COLORS, DARK_TOOLTIP_STYLE };

export default function ChartWrapper({
  title,
  children,
  height = 300,
}: ChartWrapperProps) {
  const chartEl = children as React.ReactElement<ChartProps>;
  const originalChildren = chartEl.props.children;

  const enhanced = React.cloneElement<ChartProps>(
    chartEl,
    { margin: { top: 10, right: 10, left: 0, bottom: 0 } },
    <>
      {originalChildren}
      <Tooltip
        contentStyle={DARK_TOOLTIP_STYLE.contentStyle}
        itemStyle={DARK_TOOLTIP_STYLE.itemStyle}
        labelStyle={DARK_TOOLTIP_STYLE.labelStyle}
      />
      <Legend {...DARK_LEGEND_PROPS} />
    </>
  );

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{enhanced}</ResponsiveContainer>
      </div>
    </div>
  );
}
