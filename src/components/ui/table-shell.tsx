import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Inbox, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface TableShellProps {
  title: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  isLoading?: boolean;
}

function TableShell({
  title,
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  actions,
  children,
  isEmpty = false,
  emptyMessage = "No se encontraron resultados.",
  emptyIcon,
  isLoading = false,
}: TableShellProps) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 p-6 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-text tracking-tight">{title}</h2>
          {actions}
        </div>
        {onSearchChange !== undefined && (
          <div className="relative w-full">
            <Input
              placeholder={searchPlaceholder}
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<Search size={16} />}
            />
            {searchValue && searchValue.length > 0 && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <div className="py-16 flex flex-col items-center justify-center text-text-secondary text-sm space-y-3">
            {emptyIcon ?? <Inbox size={36} className="opacity-40" />}
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-4 bg-border rounded-[var(--radius-sm)] w-1/4" />
          <div className="h-4 bg-border rounded-[var(--radius-sm)] w-1/3" />
          <div className="h-4 bg-border rounded-[var(--radius-sm)] w-1/6" />
          <div className="h-4 bg-border rounded-[var(--radius-sm)] w-1/5" />
        </div>
      ))}
    </div>
  );
}

export { TableShell };
