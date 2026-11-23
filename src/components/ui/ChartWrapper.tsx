"use client";

import React, { useSyncExternalStore } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartWrapperProps {
  title: string;
  children: React.ReactNode;
  height?: number;
  action?: React.ReactNode;
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
  action,
}: ChartWrapperProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const isRechartsChild =
    React.isValidElement(children) &&
    typeof children.type !== "string";

  return (
    <div className="bg-card rounded-xl p-2.5 desk:p-4 border border-border min-w-0 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2 desk:mb-4">
        <h3 className="text-xs desk:text-sm font-semibold text-text-muted">{title}</h3>
        {action}
      </div>
      <div
        style={{ width: "100%", "--chart-h": `${height}px` } as React.CSSProperties}
        className="min-w-0 relative h-[calc(var(--chart-h)*0.68)] desk:h-[var(--chart-h)]"
      >
        {mounted && (
          isRechartsChild ? (
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          ) : (
            children
          )
        )}
      </div>
    </div>
  );
}

