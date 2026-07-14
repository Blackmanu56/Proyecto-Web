"use client";

import React from "react";

interface KpiCardData {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "amber" | "rose" | "sky" | "purple";
  trend?: { direction: "up" | "down"; value: string };
}

const COLOR_STYLES: Record<
  string,
  { bg: string; iconBg: string; text: string }
> = {
  indigo: {
    bg: "bg-indigo-500/10",
    iconBg: "bg-indigo-500/20",
    text: "text-indigo-400",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/20",
    text: "text-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
    text: "text-amber-400",
  },
  rose: {
    bg: "bg-rose-500/10",
    iconBg: "bg-rose-500/20",
    text: "text-rose-400",
  },
  sky: {
    bg: "bg-sky-500/10",
    iconBg: "bg-sky-500/20",
    text: "text-sky-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    iconBg: "bg-purple-500/20",
    text: "text-purple-400",
  },
};

export default function StatCard({ label, value, icon, color, trend }: KpiCardData) {
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES.indigo;

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
        <span className={`w-5 h-5 ${styles.text}`}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-400 leading-tight">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5 break-words">{value}</p>
        {trend && (
          <p
            className={`text-xs mt-1 flex items-center gap-1 ${
              trend.direction === "up" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            <span>{trend.direction === "up" ? "↑" : "↓"}</span>
            <span>{trend.value}</span>
          </p>
        )}
      </div>
    </div>
  );
}
