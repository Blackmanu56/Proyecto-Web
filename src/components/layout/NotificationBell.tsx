"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  getContadorNotificaciones,
} from "@/actions/solicitudes-stock";
import NotificationPanel from "@/components/ui/NotificationPanel";

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await getContadorNotificaciones();
      if (!("error" in res)) setCount(res.count);
    } catch {
      // Silently ignore — polling will retry
    }
  }, []);

  // Poll every 30s + immediate fetch
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const badgeText = count > 9 ? "9+" : String(count);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--card)]/80 border border-transparent hover:border-[var(--border)]/40 transition-all duration-300"
        title="Notificaciones"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#D62828] text-white text-[10px] font-bold leading-none shadow-[0_2px_6px_rgba(214,40,40,0.4)]">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          onClose={() => setIsOpen(false)}
          onCountChange={setCount}
        />
      )}
    </div>
  );
}
