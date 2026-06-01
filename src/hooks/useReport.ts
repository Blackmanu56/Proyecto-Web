"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface ReportFiltersState {
  fechaDesde: string;
  fechaHasta: string;
  [key: string]: string | number | boolean | undefined;
}

interface UseReportOptions<T> {
  fetchFn: (filters: ReportFiltersState & { page?: number }) => Promise<T>;
  defaultFilters?: Partial<ReportFiltersState>;
  autoFetch?: boolean;
}

export function useReport<T>({ fetchFn, defaultFilters = {}, autoFetch = true }: UseReportOptions<T>) {
  const [filters, setFiltersState] = useState<ReportFiltersState>({
    fechaDesde: "",
    fechaHasta: "",
    ...defaultFilters,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  const fetchData = useCallback(
    async (page?: number) => {
      setLoading(true);
      setError(null);
      const callId = ++fetchCountRef.current;

      try {
        const params: any = { ...filters };
        if (search) params.search = search;
        if (page !== undefined) params.page = page;

        const result = await fetchFn(params);

        if (mountedRef.current && callId === fetchCountRef.current) {
          setData(result);
        }
      } catch (err) {
        if (mountedRef.current && callId === fetchCountRef.current) {
          setError(err instanceof Error ? err.message : "Error al cargar datos");
        }
      } finally {
        if (mountedRef.current && callId === fetchCountRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchFn, filters, search]
  );

  const setFilter = useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      setFiltersState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFiltersState({ fechaDesde: "", fechaHasta: "", ...defaultFilters });
    setSearch("");
  }, [defaultFilters]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    filters,
    setFilter,
    search,
    setSearch,
    loading,
    data,
    error,
    fetchData,
    resetFilters,
  };
}
