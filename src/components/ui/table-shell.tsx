import { Input } from "@/components/ui/input";
import { Eraser,Inbox,Search,X } from "lucide-react";
import * as React from "react";

export interface TableShellProps {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  isLoading?: boolean;
  centeredHeaderControls?: boolean;
  hideHeaderTitle?: boolean;
}

function TableShell({
  title,
  subtitle,
  searchPlaceholder = "Buscar...",
  searchLabel,
  searchValue,
  onSearchChange,
  actions,
  children,
  isEmpty = false,
  emptyMessage = "No se encontraron resultados.",
  emptyIcon,
  isLoading = false,
  centeredHeaderControls = false,
  hideHeaderTitle = false,
}: TableShellProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleClearSearch = () => {
    onSearchChange?.("");
    searchInputRef.current?.focus();
  };

  const searchControl = onSearchChange !== undefined && (
    <div className={centeredHeaderControls ? "w-full sm:w-[520px] xl:w-[620px] 2xl:w-[700px]" : "relative w-full md:max-w-[680px]"}>
      <Input
        ref={searchInputRef}
        placeholder={searchPlaceholder}
        value={searchValue ?? ""}
        onChange={(e) => onSearchChange(e.target.value)}
        leftIcon={<Search size={14} />}
        className={centeredHeaderControls ? "py-1.5 pr-3 text-[11px]" : "py-1.5 pr-24 text-[11px]"}
      />
      {!centeredHeaderControls && searchValue && searchValue.length > 0 && (
        <button
          type="button"
          onClick={handleClearSearch}
          className="absolute right-2 top-1/2 flex h-6 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 text-[10px] font-bold text-text-secondary shadow-sm transition-all duration-150 hover:border-border-hover hover:bg-border/60 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-95"
          aria-label="Limpiar busqueda"
          title="Limpiar busqueda"
        >
          <X size={11} />
          <span className="hidden sm:inline">Limpiar</span>
        </button>
      )}
    </div>
  );

  const hasSearchValue = Boolean(searchValue && searchValue.length > 0);

  const clearSearchButton = centeredHeaderControls && hasSearchValue && (
    <button
      type="button"
      onClick={handleClearSearch}
      className="group flex h-10 min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 hover:bg-[var(--brand-light)]/10 hover:text-white focus-visible:border-[var(--brand)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20 active:scale-[0.98]"
      aria-label="Limpiar busqueda"
      title="Limpiar busqueda"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20 transition-colors duration-200 group-hover:bg-[var(--brand-light)]/80 group-hover:text-[var(--brand)]">
          <Eraser size={14} strokeWidth={2.4} />
        </span>
        <span>Limpiar</span>
      </span>
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-[var(--shadow-sm)] overflow-hidden flex flex-col h-full min-h-0">
      {/* Header */}
      <div className={`flex flex-col border-b border-border/60 shrink-0 ${centeredHeaderControls ? hideHeaderTitle ? "gap-2 px-4 py-3" : "gap-3 px-4 pb-4 pt-4" : "gap-2 p-3"}`}>
        {centeredHeaderControls ? (
          <>
            {!hideHeaderTitle && (
              <div className="text-center">
                <h2 className="text-base font-extrabold text-text tracking-tight">{title}</h2>
                {subtitle && (
                  <p className="mt-1 text-xs text-text-secondary leading-tight">{subtitle}</p>
                )}
              </div>
            )}
            <div className={`${hideHeaderTitle ? "mt-0" : "mt-4"} flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between`}>
              <div className="flex flex-wrap items-end gap-2.5">
                {searchControl && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      {searchLabel ?? "Busqueda"}
                    </label>
                    {searchControl}
                  </div>
                )}
                {clearSearchButton && (
                  <div className="flex flex-col gap-1">
                    <span aria-hidden="true" className="h-[13px]" />
                    {clearSearchButton}
                  </div>
                )}
              </div>
              {actions && (
                <div className="flex shrink-0 justify-start xl:justify-end">
                  {actions}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-text tracking-tight">{title}</h2>
                {subtitle && (
                  <p className="mt-1 text-xs text-text-secondary leading-tight">{subtitle}</p>
                )}
              </div>
              {actions}
            </div>
            {searchControl}
          </>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-1 min-h-0 flex-col overflow-hidden ${centeredHeaderControls ? hideHeaderTitle ? "p-3 pt-2" : "p-4 pt-3" : "p-3"}`}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <div className="py-12 flex flex-col items-center justify-center text-text-secondary text-xs space-y-2">
            {emptyIcon ?? <Inbox size={28} className="opacity-40" />}
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pr-1">
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
