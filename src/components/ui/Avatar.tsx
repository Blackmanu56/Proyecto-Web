"use client";

import React, { useState } from "react";

interface AvatarProps {
  fotoUrl: string | null;
  nombreCompleto: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  activo?: boolean;
}

const SIZE_MAP = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-9 h-9", text: "text-xs" },
  lg: { container: "w-12 h-12", text: "text-sm" },
  xl: { container: "w-16 h-16", text: "text-lg" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Avatar({
  fotoUrl,
  nombreCompleto,
  size = "md",
  className = "",
  activo = true,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const dims = SIZE_MAP[size];

  // If there's a photo URL and it hasn't errored, show the image
  if (fotoUrl && !imgError) {
    return (
      <div className={`shrink-0 ${dims.container} ${className}`}>
        <img
          src={fotoUrl}
          alt={nombreCompleto}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover border"
          style={{
            borderColor: activo
              ? "rgba(99,102,241,0.2)"
              : "rgba(51,65,85,0.5)",
          }}
        />
      </div>
    );
  }

  // Fallback to initials
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-bold border ${dims.container} ${dims.text} ${
        activo
          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
          : "bg-slate-800 text-slate-500 border-slate-700"
      } ${className}`}
    >
      {getInitials(nombreCompleto)}
    </div>
  );
}
