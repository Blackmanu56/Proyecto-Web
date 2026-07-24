import { Input } from "@/components/ui/input";
import { Inbox,Search,X } from "lucide-react";
import * as React from "react";

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
    <div className="bg-card border border-border rounded-lg shadow-[var(--shadow-sm)] overflow-hidden flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-2 p-3 border-b border-border/60 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-text tracking-tight">{title}</h2>
          {actions}
        </div>
        {onSearchChange !== undefined && (
          <div className="relative w-full">
            <Input
              placeholder={searchPlaceholder}
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<Search size={14} />}
              className="py-1.5 text-[11px]"
            />
            {searchValue && searchValue.length > 0 && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <div className="py-12 flex flex-col items-center justify-center text-text-secondary text-xs space-y-2">
            {emptyIcon ?? <Inbox size={28} className="opacity-40" />}
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0 max-h-[calc(100vh-22rem)] pb-8">
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
