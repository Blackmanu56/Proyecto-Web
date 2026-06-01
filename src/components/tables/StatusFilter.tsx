"use client";

/**
 * Componente reutilizable de filtro de estado Activo/Inactivo/Todos.
 * Mantiene la consistencia visual con el módulo de Clientes.
 */
export type FilterStatus = "activos" | "inactivos" | "todos";

interface StatusFilterProps {
  value: FilterStatus;
  onChange: (value: FilterStatus) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-400 mr-2">Filtrar:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FilterStatus)}
        className="bg-slate-950 border border-slate-800 rounded-xl text-white text-xs px-2 py-1 focus:outline-none focus:border-indigo-500"
      >
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
        <option value="todos">Todos</option>
      </select>
    </div>
  );
}
