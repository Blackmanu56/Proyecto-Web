"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Edit2,
  ToggleLeft,
  AlertTriangle,
  CheckCircle,
  X,
  type LucideIcon,
} from "lucide-react";

/* ────────────────────── Types ────────────────────── */

export interface EntityWithCount {
  id: number;
  nombre: string;
  activo: boolean;
  _count: { productos: number };
}

type FilterMode = "todas" | "activas" | "inactivas";

export interface AdminEntityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: string;
  onRefresh: () => void;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Modal title */
  title: string;
  /** Placeholder for search input */
  searchPlaceholder: string;
  /** Placeholder for new item input */
  createPlaceholder: string;
  /** Entity name for messages (e.g. "categoría", "marca") */
  entityName: string;
  /** Plural entity name for messages (e.g. "categorías", "marcas") */
  entityNamePlural: string;
  /** Load all entities with count */
  loadData: () => Promise<EntityWithCount[]>;
  /** Create a new entity */
  createItem: (nombre: string) => Promise<any>;
  /** Update an existing entity */
  updateItem: (id: number, nombre: string) => Promise<any>;
  /** Toggle active status */
  toggleItemActivo: (id: number, activo: boolean) => Promise<any>;
}

/* ────────────────────── Component ────────────────────── */

export default function AdminEntityModal({
  open,
  onOpenChange,
  userRole,
  onRefresh,
  icon: Icon,
  title,
  searchPlaceholder,
  createPlaceholder,
  entityName,
  entityNamePlural,
  loadData,
  createItem,
  updateItem,
  toggleItemActivo,
}: AdminEntityModalProps) {
  const [items, setItems] = useState<EntityWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("activas");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmInactivate, setConfirmInactivate] = useState<{
    id: number;
    nombre: string;
    activar: boolean;
  } | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  /* ── Load data ── */
  const refreshData = useCallback(async () => {
    try {
      const data = await loadData();
      setItems(data);
    } catch {
      /* ignore */
    }
  }, [loadData]);

  useEffect(() => {
    if (open) {
      refreshData();
      setSearch("");
      setFilter("activas");
      setNewName("");
      setEditingId(null);
      setNotification(null);
      setConfirmInactivate(null);
    }
  }, [open, refreshData]);

  /* ── Notification ── */
  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 3000);
    },
    []
  );

  /* ── Filtered list ── */
  const filtered = items.filter((item) => {
    const matchesSearch = item.nombre
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter =
      filter === "todas" ||
      (filter === "activas" && item.activo) ||
      (filter === "inactivas" && !item.activo);
    return matchesSearch && matchesFilter;
  });

  /* ── Counts ── */
  const countActivas = items.filter((i) => i.activo).length;
  const countInactivas = items.filter((i) => !i.activo).length;

  /* ── Handlers ── */
  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createItem(newName.trim());
      setNewName("");
      showNotification("success", `${entityName} creada exitosamente.`);
      await refreshData();
      onRefresh();
    } catch (err: any) {
      showNotification("error", err.message || `Error al crear ${entityName}.`);
    } finally {
      setCreating(false);
    }
  }, [newName, createItem, showNotification, entityName, refreshData, onRefresh]);

  const handleUpdate = useCallback(
    async (id: number) => {
      if (!editName.trim()) return;
      setLoading(true);
      try {
        await updateItem(id, editName.trim());
        setEditingId(null);
        setEditName("");
        showNotification("success", `${entityName} actualizada exitosamente.`);
        await refreshData();
        onRefresh();
      } catch (err: any) {
        showNotification(
          "error",
          err.message || `Error al actualizar ${entityName}.`
        );
      } finally {
        setLoading(false);
      }
    },
    [editName, updateItem, showNotification, entityName, refreshData, onRefresh]
  );

  const handleToggleActivo = useCallback(async () => {
    if (!confirmInactivate) return;
    setLoading(true);
    try {
      await toggleItemActivo(confirmInactivate.id, !confirmInactivate.activar);
      setConfirmInactivate(null);
      showNotification(
        "success",
        confirmInactivate.activar
          ? `${entityName} inactivada.`
          : `${entityName} reactivada.`
      );
      await refreshData();
      onRefresh();
    } catch (err: any) {
      showNotification(
        "error",
        err.message || "Error al cambiar estado."
      );
    } finally {
      setLoading(false);
    }
  }, [
    confirmInactivate,
    toggleItemActivo,
    showNotification,
    entityName,
    refreshData,
    onRefresh,
  ]);

  /* ── Focus edit input ── */
  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  /* ── Filter buttons ── */
  const filterButtons: { key: FilterMode; label: string; count: number }[] = [
    { key: "activas", label: "Activas", count: countActivas },
    { key: "inactivas", label: "Inactivas", count: countInactivas },
    { key: "todas", label: "Todas", count: items.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[var(--brand)]" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Crear, editar y gestionar {entityNamePlural}.
          </DialogDescription>
        </DialogHeader>

        {/* Notification */}
        {notification && (
          <div
            className={`p-3 text-xs font-semibold rounded-[var(--radius-md)] flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--success)]"
                : "bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)]"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {notification.message}
          </div>
        )}

        {/* Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setFilter(btn.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                filter === btn.key
                  ? "bg-[var(--panel)] text-[var(--text)] shadow-sm border border-[var(--border)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {btn.label}
              <span
                className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  filter === btn.key
                    ? "bg-[var(--brand-light)] text-[var(--brand)]"
                    : "bg-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                {btn.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Create */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={createInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder={createPlaceholder}
              className="h-9 w-48 px-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)] transition-colors"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="flex items-center gap-1.5 px-3 h-9 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand)]/90 transition disabled:opacity-50 active:scale-[0.97]"
            >
              <Plus size={14} />
              {creating ? "Creando..." : "Crear"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto border border-[var(--border)] rounded-[var(--radius-md)]">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--panel)] z-10">
              <tr className="border-b-2 border-[var(--border)] text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4 text-center">Productos</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-[var(--text-secondary)]"
                  >
                    {items.length === 0
                      ? `No hay ${entityNamePlural} registradas.`
                      : `No se encontraron ${entityNamePlural} con esa búsqueda.`}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--panel)]/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={editInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(item.id);
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setEditName("");
                              }
                            }}
                            className="h-8 px-2 bg-[var(--bg)] border border-[var(--brand)] rounded text-sm text-[var(--text)] focus:outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.id)}
                            disabled={!editName.trim() || loading}
                            className="p-1 text-[var(--success)] hover:bg-[var(--success-light)]/20 rounded transition-colors"
                            title="Guardar"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditName("");
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:bg-[var(--border)]/60 rounded transition-colors"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-[var(--text)]">
                          {item.nombre}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-[var(--text-secondary)]">
                        {item._count.productos}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.activo
                            ? "bg-[var(--success-light)] text-[var(--success)]"
                            : "bg-[var(--danger-light)] text-[var(--danger)]"
                        }`}
                      >
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingId !== item.id && (
                        <div className="flex items-center justify-center gap-1">
                          {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(
                            userRole
                          ) && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditName(item.nombre);
                              }}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--border)]/60 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {["ADMINISTRADOR"].includes(userRole) && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmInactivate({
                                  id: item.id,
                                  nombre: item.nombre,
                                  activar: item.activo,
                                })
                              }
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[var(--brand-light)]/30 rounded transition-colors"
                              title="Cambiar estado"
                            >
                              <ToggleLeft size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Confirmation dialog */}
        {confirmInactivate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-[var(--text)] mb-2">
                Cambiar estado
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                ¿Desea cambiar el estado de{" "}
                {entityName}{" "}
                <strong className="text-[var(--text)]">
                  &ldquo;{confirmInactivate.nombre}&rdquo;
                </strong>
                ? El estado pasará de{" "}
                <strong className={confirmInactivate.activar ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  {confirmInactivate.activar ? "Activo" : "Inactivo"}
                </strong>{" "}
                a{" "}
                <strong className={confirmInactivate.activar ? "text-[var(--danger)]" : "text-[var(--success)]"}>
                  {confirmInactivate.activar ? "Inactivo" : "Activo"}
                </strong>
                .
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmInactivate(null)}
                  className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--border)]/60 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleToggleActivo}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 bg-[var(--brand)] hover:bg-[var(--brand)]/90"
                >
                  {loading ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
