"use client";

import React, { useState, useTransition, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  crearCliente,
  actualizarCliente,
  toggleEstadoCliente,
  eliminarClienteReal,
  getVentasCliente,
  ClienteConVentas,
  VentaCliente,
} from "@/actions/clientes";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import {
  Plus,
  Edit3,
  UserX,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Trash2,
  X,
  Loader2,
  ShoppingBag,
  DollarSign,
  Clock,
  Info,
} from "lucide-react";

type SortField =
  | "nombre"
  | "dni"
  | "telefono"
  | "email"
  | "creadoEn"
  | "activo"
  | "ventas"
  | "totalGastado";

type SortDir = "asc" | "desc" | null;

interface ClientesTableProps {
  initialClientes: ClienteConVentas[];
  userRole: string;
}

export default function ClientesTable({
  initialClientes,
  userRole,
}: ClientesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"activos" | "inactivos" | "todos">("activos");
  const [sortField, setSortField] = useState<SortField>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedCliente, setSelectedCliente] = useState<ClienteConVentas | null>(null);
  const [isFichaOpen, setIsFichaOpen] = useState(false);
  const [ventasCliente, setVentasCliente] = useState<VentaCliente[]>([]);
  const [isLoadingVentas, setIsLoadingVentas] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteConVentas | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    clienteId: number;
    clienteName: string;
    type: "toggle" | "delete";
    isActive?: boolean;
    errorMsg?: string | null;
  }>({ open: false, clienteId: 0, clienteName: "", type: "toggle" });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const handleSortCycle = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        if (sortDir === "asc") setSortDir("desc");
        else if (sortDir === "desc") {
          setSortDir(null);
        } else {
          setSortDir("asc");
        }
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField, sortDir]
  );

  const TEXT_SORT_FIELDS = new Set<SortField>(["nombre", "dni", "activo"]);

  const getSortTooltip = (field: SortField): string => {
    const isText = TEXT_SORT_FIELDS.has(field);
    if (sortField !== field || sortDir === null) return isText ? "Ordenar de A a Z" : "Ordenar de menor a mayor";
    if (sortDir === "asc") return isText ? "Ordenar de Z a A" : "Ordenar de mayor a menor";
    return "Quitar ordenamiento";
  };

  const renderSortIndicator = (field: SortField) => {
    const isActive = sortField === field && sortDir !== null;
    const isText = TEXT_SORT_FIELDS.has(field);
    const color = isActive ? "text-[var(--brand)]" : "opacity-40";
    let label: string;
    if (!isActive) {
      label = isText ? "A–Z ↕" : "1–9 ↕";
    } else if (sortDir === "asc") {
      label = isText ? "A–Z ↑" : "1–9 ↑";
    } else {
      label = isText ? "Z–A ↓" : "1–9 ↓";
    }
    return <span className={`text-[9px] font-medium tracking-normal whitespace-nowrap ${color}`}>{label}</span>;
  };

  const filteredClientes = useMemo(() => {
    let result = initialClientes.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.nombre.toLowerCase().includes(q) ||
        c.dni.toLowerCase().includes(q) ||
        (c.cuit && c.cuit.toLowerCase().includes(q)) ||
        (c.telefono && c.telefono.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));

      let matchesStatus = false;
      if (filterStatus === "todos") matchesStatus = true;
      else if (filterStatus === "activos") matchesStatus = c.activo;
      else matchesStatus = !c.activo;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortDir === null) return 0;
      let cmp = 0;
      switch (sortField) {
        case "nombre":
          cmp = a.nombre.localeCompare(b.nombre);
          break;
        case "dni":
          cmp = a.dni.localeCompare(b.dni);
          break;
        case "telefono":
          cmp = (a.telefono || "").localeCompare(b.telefono || "");
          break;
        case "email":
          cmp = (a.email || "").localeCompare(b.email || "");
          break;
        case "creadoEn":
          cmp = new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime();
          break;
        case "activo":
          cmp = (a.activo ? 0 : 1) - (b.activo ? 0 : 1);
          break;
        case "ventas":
          cmp = a._count.ventas - b._count.ventas;
          break;
        case "totalGastado":
          cmp = (a._sum.ventas ?? 0) - (b._sum.ventas ?? 0);
          break;
        default:
          cmp = 0;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [initialClientes, search, filterStatus, sortField, sortDir]);

  const totalClientes = initialClientes.length;
  const clientesActivos = initialClientes.filter((c) => c.activo).length;
  const clientesInactivos = totalClientes - clientesActivos;

  const handleOpenFicha = async (cliente: ClienteConVentas) => {
    setSelectedCliente(cliente);
    setIsFichaOpen(true);
    setIsLoadingVentas(true);
    try {
      const ventas = await getVentasCliente(cliente.id);
      setVentasCliente(ventas);
    } catch {
      setVentasCliente([]);
    } finally {
      setIsLoadingVentas(false);
    }
  };

  const handleOpenEditFromFicha = () => {
    if (!selectedCliente) return;
    setEditingCliente(selectedCliente);
    setErrorMsg("");
    setSuccessMsg("");
    setIsEditOpen(true);
  };

  const handleEdit = (cliente: ClienteConVentas, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCliente(cliente);
    setErrorMsg("");
    setSuccessMsg("");
    setIsEditOpen(true);
  };

  const handleOpenToggle = (cliente: ClienteConVentas, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      open: true,
      clienteId: cliente.id,
      clienteName: cliente.nombre,
      type: "toggle",
      isActive: cliente.activo,
      errorMsg: null,
    });
  };

  const handleOpenDelete = (cliente: ClienteConVentas, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      open: true,
      clienteId: cliente.id,
      clienteName: cliente.nombre,
      type: "delete",
      errorMsg: null,
    });
  };

  const handleConfirmAction = async () => {
    setConfirmDialog((prev) => ({ ...prev, errorMsg: null }));
    startTransition(async () => {
      let res;
      if (confirmDialog.type === "toggle") {
        res = await toggleEstadoCliente(confirmDialog.clienteId, userRole);
      } else {
        res = await eliminarClienteReal(confirmDialog.clienteId);
      }
      if (res.success) {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        router.refresh();
      } else {
        setConfirmDialog((prev) => ({ ...prev, errorMsg: res.error }));
      }
    });
  };

  const handleSubmitCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const raw = new FormData(e.currentTarget);
    const apellido = (raw.get("apellido") as string || "").trim();
    const nombreParte = (raw.get("nombre") as string || "").trim();
    const fullName = nombreParte ? `${apellido}, ${nombreParte}` : apellido;
    const formData = new FormData();
    formData.set("nombre", fullName);
    for (const [key, val] of raw.entries()) {
      if (key !== "apellido" && key !== "nombre") formData.set(key, val as string);
    }
    startTransition(async () => {
      const res = await crearCliente(formData);
      if (res.success) {
        setSuccessMsg("Cliente registrado exitosamente.");
        setTimeout(() => {
          setIsRegisterOpen(false);
          setSuccessMsg("");
        }, 1200);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Ocurrió un error inesperado.");
      }
    });
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    const raw = new FormData(e.currentTarget);
    const apellido = (raw.get("apellido") as string || "").trim();
    const nombreParte = (raw.get("nombre") as string || "").trim();
    const fullName = nombreParte ? `${apellido}, ${nombreParte}` : apellido;
    const formData = new FormData();
    formData.set("nombre", fullName);
    for (const [key, val] of raw.entries()) {
      if (key !== "apellido" && key !== "nombre") formData.set(key, val as string);
    }
    startTransition(async () => {
      if (!editingCliente) return;
      const res = await actualizarCliente(editingCliente.id, formData);
      if (res.success) {
        setSuccessMsg("Cliente actualizado correctamente.");
        setTimeout(() => {
          setIsEditOpen(false);
          setSuccessMsg("");
          if (selectedCliente) {
            setSelectedCliente({
              ...selectedCliente,
              nombre: fullName,
              dni: (formData.get("dni") as string) || selectedCliente.dni,
              cuit: (formData.get("cuit") as string) || selectedCliente.cuit,
              telefono: (formData.get("telefono") as string) || selectedCliente.telefono,
              direccion: (formData.get("direccion") as string) || selectedCliente.direccion,
              email: (formData.get("email") as string) || selectedCliente.email,
            });
          }
        }, 1200);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Ocurrió un error inesperado.");
      }
    });
  };

  const fichaTotalGastado = useMemo(
    () => ventasCliente.reduce((sum, v) => sum + v.total, 0),
    [ventasCliente]
  );

  const fichaUltimaCompra = useMemo(() => {
    if (ventasCliente.length === 0) return null;
    return new Date(ventasCliente[0].fecha);
  }, [ventasCliente]);

  const SortHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th
      className={`py-2 px-4 cursor-pointer select-none hover:text-text hover:bg-[var(--border)]/30 transition-colors ${className}`}
      onClick={() => handleSortCycle(field)}
      title={getSortTooltip(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {renderSortIndicator(field)}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-3 shrink-0 mb-3">
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total Clientes</p>
            <p className="text-2xl font-extrabold text-[var(--text)]">{totalClientes}</p>
          </div>
          <div className="p-2.5 bg-[var(--brand-light)] rounded-lg text-[var(--brand)]">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Activos</p>
            <p className="text-2xl font-extrabold text-[var(--success)]">{clientesActivos}</p>
          </div>
          <div className="p-2.5 bg-[var(--success-light)] rounded-lg text-[var(--success)]">
            <UserCheck size={20} />
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-2xl font-extrabold text-[var(--danger)]">{clientesInactivos}</p>
          </div>
          <div className="p-2.5 bg-[var(--danger-light)] rounded-lg text-[var(--danger)]">
            <UserX size={20} />
          </div>
        </div>
      </div>

      {/* Table Shell */}
      <TableShell
        title="Gestión de Clientes"
        searchPlaceholder="Buscar por nombre, DNI, CUIT, teléfono o email..."
        searchValue={search}
        onSearchChange={setSearch}
        isEmpty={filteredClientes.length === 0}
        emptyMessage="No se encontraron clientes que coincidan con la búsqueda."
        emptyIcon={<Users size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Estado</label>
              <div className="relative">
                <CheckCircle
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                  size={12}
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="pl-7 pr-6 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:border-brand appearance-none cursor-pointer"
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingCliente(null);
                setErrorMsg("");
                setSuccessMsg("");
                setIsRegisterOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand)]/90 transition"
            >
              <Plus size={14} />
              Registrar
            </button>
          </div>
        }
      >
        <table className="w-full border-collapse min-w-[900px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} />
          </colgroup>
          <thead className="sticky top-0 bg-[var(--panel)]">
            <tr className="border-b-2 border-[var(--border)] text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)] whitespace-nowrap">
              <th className="py-3.5 px-4 text-left cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors" onClick={() => handleSortCycle("nombre")} title={getSortTooltip("nombre")}>
                <div className="flex items-center gap-2">Cliente {renderSortIndicator("nombre")}</div>
              </th>
              <th className="py-3.5 px-4 text-left">
                <div className="flex items-center gap-2">Documentos</div>
              </th>
              <th className="py-3.5 px-4 text-left">Contacto</th>
              <th className="py-3.5 px-4 text-center cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors" onClick={() => handleSortCycle("activo")} title={getSortTooltip("activo")}>
                <div className="flex items-center justify-center gap-2">Estado {renderSortIndicator("activo")}</div>
              </th>
              <th className="py-3.5 px-4 text-center cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors" onClick={() => handleSortCycle("ventas")} title={getSortTooltip("ventas")}>
                <div className="flex items-center justify-center gap-2">Compras {renderSortIndicator("ventas")}</div>
              </th>
              <th className="py-3.5 px-4 text-right cursor-pointer select-none hover:text-[var(--text)] hover:bg-[var(--border)]/30 transition-colors" onClick={() => handleSortCycle("totalGastado")} title={getSortTooltip("totalGastado")}>
                <div className="flex items-center justify-end gap-2">Total Gastado {renderSortIndicator("totalGastado")}</div>
              </th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/60 text-[13px] text-[var(--text-muted)]">
            {filteredClientes.map((cliente) => (
              <tr
                key={cliente.id}
                onClick={() => handleOpenFicha(cliente)}
                className={`group h-[68px] hover:bg-[var(--panel)] transition-colors duration-150 cursor-pointer ${
                  !cliente.activo ? "opacity-60" : ""
                }`}
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-[var(--text)] text-sm leading-tight group-hover:text-[var(--brand)] transition-colors truncate">{cliente.nombre}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />
                    {formatDateShort(cliente.creadoEn)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text-secondary)]">DNI:</span>{" "}
                      {cliente.dni}
                    </span>
                    {cliente.cuit ? (
                      <span className="text-sm text-[var(--text-muted)]">
                        <span className="font-medium text-[var(--text-secondary)]">CUIT:</span>{" "}
                        {cliente.cuit}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)] italic">
                        Sin CUIT
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5">
                    {cliente.telefono && (
                      <div className="text-sm flex items-center gap-1 text-[var(--text-muted)]">
                        <Phone size={11} className="text-[var(--text-secondary)]" />
                        {cliente.telefono}
                      </div>
                    )}
                    {cliente.email && (
                      <div className="text-sm flex items-center gap-1 text-[var(--text-muted)]">
                        <Mail size={11} className="text-[var(--text-secondary)]" />
                        {cliente.email}
                      </div>
                    )}
                    {!cliente.telefono && !cliente.email && (
                      <span className="text-[11px] text-[var(--text-secondary)] italic">
                        Sin datos
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <Badge variant={cliente.activo ? "success" : "danger"} size="sm">
                    {cliente.activo ? "Activo" : "Baja"}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-center font-semibold text-[var(--text)]">
                  {cliente._count.ventas}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-[var(--text)] font-mono">
                  {formatCurrency(cliente._sum.ventas ?? 0)}
                </td>
                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEdit(cliente, e)}
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </Button>
                    {cliente.activo ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleOpenToggle(cliente, e)}
                        title="Desactivar (Baja)"
                        className="hover:text-[var(--danger)]"
                      >
                        <UserX size={16} />
                      </Button>
                    ) : (
                      <>
                        {userRole === "ADMINISTRADOR" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenToggle(cliente, e)}
                            title="Reactivar"
                            className="hover:text-[var(--success)]"
                          >
                            <UserCheck size={16} />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Reactivación restringida a Administrador"
                          >
                            <UserCheck size={16} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleOpenDelete(cliente, e)}
                          title="Eliminar físico de BD"
                          className="hover:text-[var(--danger)]"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {/* ─── Modal Registrar Cliente ─── */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                <Users size={18} />
              </div>
              Registrar Nuevo Cliente
            </DialogTitle>
            <DialogDescription>
              Complete la ficha del cliente. Nombre y DNI son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Apellido / Razón Social" required>
                <Input
                  type="text"
                  name="apellido"
                  placeholder="Ej: Pérez"
                  required
                  className="py-2"
                />
              </FormField>
              <FormField label="Nombre">
                <Input
                  type="text"
                  name="nombre"
                  placeholder="Ej: Juan"
                  className="py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="DNI" required>
                <Input
                  type="text"
                  name="dni"
                  placeholder="Ej: 20123456"
                  required
                  className="py-2"
                />
              </FormField>
              <FormField label="CUIT (Opcional)">
                <Input
                  type="text"
                  name="cuit"
                  placeholder="Ej: 30123456789"
                  className="py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Teléfono">
                <Input
                  type="text"
                  name="telefono"
                  placeholder="Número de contacto"
                  className="py-2"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  name="email"
                  placeholder="correo@ejemplo.com"
                  className="py-2"
                />
              </FormField>
            </div>

            <FormField label="Dirección">
              <Input
                type="text"
                name="direccion"
                placeholder="Calle, Número, Localidad"
                className="py-2"
              />
            </FormField>

            {errorMsg && (
              <div className="p-3 bg-danger-light border border-danger/20 text-danger rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-success-light border border-success/20 text-success rounded-lg text-xs flex items-center gap-2">
                <CheckCircle size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsRegisterOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={isPending} disabled={isPending}>
                Crear Cliente
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Ficha del Cliente ─── */}
      <Dialog open={isFichaOpen} onOpenChange={setIsFichaOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2">
                <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                  <Users size={18} />
                </div>
                Ficha del Cliente
              </span>
              {selectedCliente && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenEditFromFicha}
                  className="flex items-center gap-1.5"
                >
                  <Edit3 size={16} />
                  Editar cliente
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedCliente && (
            <div className="space-y-3">
              {/* Header card */}
              <div className="bg-bg p-3 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-text text-base">{selectedCliente.nombre}</h3>
                  <p className="text-xs text-text-secondary flex items-center gap-1.5 mt-1">
                    <Calendar size={12} />
                    Registrado:{" "}
                    {formatDateShort(selectedCliente.creadoEn)}
                  </p>
                </div>
                <Badge variant={selectedCliente.activo ? "success" : "danger"} size="md">
                  {selectedCliente.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-bg border border-border rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ShoppingBag size={14} className="text-brand" />
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      Total Compras
                    </p>
                  </div>
                  <p className="text-base font-bold text-text">
                    {ventasCliente.length}
                  </p>
                </div>
                <div className="bg-bg border border-border rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <DollarSign size={14} className="text-success" />
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      Total Gastado
                    </p>
                  </div>
                  <p className="text-base font-bold text-success">
                    {formatCurrency(fichaTotalGastado)}
                  </p>
                </div>
                <div className="bg-bg border border-border rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Clock size={14} className="text-info" />
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      Última Compra
                    </p>
                  </div>
                  <p className="text-base font-bold text-text">
                    {fichaUltimaCompra
                      ? formatDateShort(fichaUltimaCompra)
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-bg border border-border rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <CheckCircle size={14} className={selectedCliente.activo ? "text-success" : "text-danger"} />
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      Estado
                    </p>
                  </div>
                  <p className={`text-base font-bold ${selectedCliente.activo ? "text-success" : "text-danger"}`}>
                    {selectedCliente.activo ? "Activo" : "Inactivo"}
                  </p>
                </div>
              </div>

              {/* Information section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Información Personal
                  </h4>
                  <InfoRow label="DNI" value={selectedCliente.dni} />
                  <InfoRow label="CUIT" value={selectedCliente.cuit || "No registrado"} />
                  <InfoRow
                    label="Teléfono"
                    value={selectedCliente.telefono || "No registrado"}
                    icon={<Phone size={13} className="text-[var(--text-secondary)]" />}
                  />
                  <InfoRow
                    label="Correo"
                    value={selectedCliente.email || "No registrado"}
                    icon={<Mail size={13} className="text-[var(--text-secondary)]" />}
                  />
                  <InfoRow
                    label="Dirección"
                    value={selectedCliente.direccion || "No registrada"}
                    icon={<MapPin size={13} className="text-[var(--text-secondary)]" />}
                  />
                </div>

                <div className="bg-bg border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Información Administrativa
                  </h4>
                  <InfoRow
                    label="Fecha de Registro"
                    value={formatDateShort(selectedCliente.creadoEn)}
                  />
                  <InfoRow
                    label="Estado"
                    value={selectedCliente.activo ? "Activo" : "Inactivo"}
                    badge={
                      <Badge variant={selectedCliente.activo ? "success" : "danger"} size="sm">
                        {selectedCliente.activo ? "Activo" : "Baja"}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Última Compra"
                    value={
                      fichaUltimaCompra
                        ? formatDateShort(fichaUltimaCompra)
                        : "Sin compras"
                    }
                  />
                  <InfoRow
                    label="Frecuencia"
                    value={
                      ventasCliente.length > 1
                        ? (() => {
                            const first = new Date(ventasCliente[ventasCliente.length - 1].fecha).getTime();
                            const last = new Date(ventasCliente[0].fecha).getTime();
                            const avgDays = (last - first) / (ventasCliente.length - 1) / (1000 * 60 * 60 * 24);
                            return `~${Math.round(avgDays)} días`;
                          })()
                        : "N/A"
                    }
                  />
                </div>
              </div>

              {/* Purchase history */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Historial de Compras
                </h4>
                {isLoadingVentas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-text-secondary" />
                  </div>
                ) : ventasCliente.length === 0 ? (
                  <div className="bg-bg border border-border rounded-lg py-8 text-center">
                    <ShoppingBag size={28} className="mx-auto text-text-secondary opacity-40 mb-2" />
                    <p className="text-sm text-text-secondary">
                      Este cliente todavía no tiene compras registradas.
                    </p>
                  </div>
                ) : (
                  <div className="bg-bg border border-border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[var(--bg)]">
                        <tr className="border-b border-border text-[10px] uppercase tracking-wider font-semibold text-text-secondary">
                          <th className="py-1.5 px-3">Fecha</th>
                          <th className="py-1.5 px-3">Comprobante</th>
                          <th className="py-1.5 px-3">Forma Pago</th>
                          <th className="py-1.5 px-3 text-center">Productos</th>
                          <th className="py-1.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-xs">
                        {ventasCliente.map((venta) => (
                          <tr
                            key={venta.id}
                            className="hover:bg-border/20 transition-colors"
                          >
                            <td className="py-1.5 px-3 text-text">
                              {formatDateShort(venta.fecha)}
                            </td>
                            <td className="py-1.5 px-3">
                              <Badge
                                variant={venta.tipoComprobante === "FACTURA_A" ? "info" : "default"}
                                size="sm"
                              >
                                {venta.tipoComprobante}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-3 text-text-muted">
                              {venta.metodoPago}
                            </td>
                            <td className="py-1.5 px-3 text-center text-text-muted">
                              {venta.productos}
                            </td>
                            <td className="py-1.5 px-3 text-right font-semibold text-text">
                              {formatCurrency(venta.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsFichaOpen(false);
                    setVentasCliente([]);
                  }}
                >
                  Cerrar Ficha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal Editar Cliente ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                <Edit3 size={18} />
              </div>
              Editar Cliente
            </DialogTitle>
            <DialogDescription>
              Modifique los datos del cliente. Nombre y DNI son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Apellido / Razón Social" required>
                <Input
                  type="text"
                  name="apellido"
                  defaultValue={editingCliente?.nombre?.split(",")[0]?.trim() || editingCliente?.nombre || ""}
                  placeholder="Ej: Pérez"
                  required
                  className="py-2"
                />
              </FormField>
              <FormField label="Nombre">
                <Input
                  type="text"
                  name="nombre"
                  defaultValue={editingCliente?.nombre?.includes(",") ? editingCliente.nombre.split(",")[1]?.trim() : ""}
                  placeholder="Ej: Juan"
                  className="py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="DNI" required>
                <Input
                  type="text"
                  name="dni"
                  defaultValue={editingCliente?.dni || ""}
                  placeholder="DNI del cliente"
                  required
                  className="py-2"
                />
              </FormField>
              <FormField label="CUIT (Opcional)">
                <Input
                  type="text"
                  name="cuit"
                  defaultValue={editingCliente?.cuit || ""}
                  placeholder="Ej: 30123456789"
                  className="py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Teléfono">
                <Input
                  type="text"
                  name="telefono"
                  defaultValue={editingCliente?.telefono || ""}
                  placeholder="Número de contacto"
                  className="py-2"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  name="email"
                  defaultValue={editingCliente?.email || ""}
                  placeholder="correo@ejemplo.com"
                  className="py-2"
                />
              </FormField>
            </div>

            <FormField label="Dirección">
              <Input
                type="text"
                name="direccion"
                defaultValue={editingCliente?.direccion || ""}
                placeholder="Calle, Número, Localidad"
                className="py-2"
              />
            </FormField>

            {errorMsg && (
              <div className="p-3 bg-danger-light border border-danger/20 text-danger rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-success-light border border-success/20 text-success rounded-lg text-xs flex items-center gap-2">
                <CheckCircle size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={isPending} disabled={isPending}>
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Confirmación Toggle / Delete ─── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-3 rounded-lg mb-4 ${
                confirmDialog.type === "toggle"
                  ? "bg-warning-light text-warning"
                  : "bg-danger-light text-danger"
              }`}
            >
              {confirmDialog.type === "toggle" ? (
                confirmDialog.isActive ? (
                  <UserX size={24} />
                ) : (
                  <UserCheck size={24} />
                )
              ) : (
                <Trash2 size={24} />
              )}
            </div>

            <h3 className="text-lg font-bold text-text">
              {confirmDialog.type === "toggle"
                ? confirmDialog.isActive
                  ? "Confirmar Baja Lógica"
                  : "Confirmar Reactivación"
                : "Confirmar Eliminación"}
            </h3>

            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              {confirmDialog.type === "toggle" ? (
                confirmDialog.isActive ? (
                  <>
                    ¿Está seguro de que desea dar de baja al cliente{" "}
                    <strong className="text-text">"{confirmDialog.clienteName}"</strong>?
                    El registro ya no estará disponible para nuevas ventas.
                  </>
                ) : (
                  <>
                    ¿Desea reactivar al cliente{" "}
                    <strong className="text-text">"{confirmDialog.clienteName}"</strong>?
                    Volverá a figurar en las listas de selección.
                  </>
                )
              ) : (
                <>
                  ¿Está completamente seguro de eliminar permanentemente al cliente{" "}
                  <strong className="text-text">"{confirmDialog.clienteName}"</strong>?
                  Esta acción no se puede deshacer.
                </>
              )}
            </p>

            {confirmDialog.errorMsg && (
              <div className="mt-4 p-3 bg-danger-light border border-danger/20 text-danger rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{confirmDialog.errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 w-full mt-6">
              <Button
                variant="secondary"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant={
                  confirmDialog.type === "toggle"
                    ? confirmDialog.isActive
                      ? "danger"
                      : "success"
                    : "danger"
                }
                onClick={handleConfirmAction}
                loading={isPending}
                disabled={isPending}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
  badge,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center text-xs border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
      <span className="text-[var(--text-secondary)]">{label}</span>
      {badge ? (
        badge
      ) : (
        <span className="font-semibold text-text flex items-center gap-1.5">
          {icon}
          {value}
        </span>
      )}
    </div>
  );
}
