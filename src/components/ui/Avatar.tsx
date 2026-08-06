"use client";

import React, { useState } from "react";
import Image from "next/image";

interface AvatarProps {
  fotoUrl: string | null;
  nombreCompleto: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  activo?: boolean;
}

const SIZE_MAP = {
  sm: { container: "w-8 h-8", text: "text-xs", image: "32px" },
  md: { container: "w-9 h-9", text: "text-xs", image: "36px" },
  lg: { container: "w-12 h-12", text: "text-sm", image: "48px" },
  xl: { container: "w-16 h-16", text: "text-lg", image: "64px" },
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
      <div className={`relative shrink-0 ${dims.container} ${className}`}>
        <Image
          src={fotoUrl}
          alt={`Foto de ${nombreCompleto}`}
          fill
          sizes={dims.image}
          onError={() => setImgError(true)}
          className="rounded-full object-cover border"
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
          : "bg-border text-text-secondary border-border"
      } ${className}`}
    >
      {getInitials(nombreCompleto)}
    </div>
  );
}
