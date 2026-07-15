"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearCliente,
  actualizarCliente,
  toggleEstadoCliente,
  eliminarClienteReal,
  ClienteConVentas,
} from "@/actions/clientes";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  Plus,
  Edit2,
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
  Info,
} from "lucide-react";

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

  // Búsqueda y Filtros
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"activos" | "inactivos" | "todos">("activos");

  // Estados del Formulario (Agregar / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteConVentas | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal de Detalle / Visualización
  const [selectedCliente, setSelectedCliente] = useState<ClienteConVentas | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Diálogo de Confirmación (Baja Lógica / Eliminar Físico)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    clienteId: number;
    clienteName: string;
    type: "toggle" | "delete";
    isActive?: boolean;
    errorMsg?: string | null;
  }>({ open: false, clienteId: 0, clienteName: "", type: "toggle" });

  const handleEdit = (cliente: ClienteConVentas) => {
    setEditingCliente(cliente);
    setErrorMsg("");
    setSuccessMsg("");
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingCliente(null);
    setErrorMsg("");
    setSuccessMsg("");
    setIsModalOpen(true);
  };

  const handleViewDetails = (cliente: ClienteConVentas) => {
    setSelectedCliente(cliente);
    setIsDetailModalOpen(true);
  };

  const handleOpenToggle = (cliente: ClienteConVentas) => {
    setConfirmDialog({
      open: true,
      clienteId: cliente.id,
      clienteName: cliente.nombre,
      type: "toggle",
      isActive: cliente.activo,
      errorMsg: null,
    });
  };

  const handleOpenDelete = (cliente: ClienteConVentas) => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let res;
      if (editingCliente) {
        res = await actualizarCliente(editingCliente.id, formData);
      } else {
        res = await crearCliente(formData);
      }

      if (res.success) {
        setSuccessMsg(
          editingCliente
            ? "Cliente actualizado correctamente."
            : "Cliente registrado exitosamente."
        );
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg("");
        }, 1500);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Ocurrió un error inesperado.");
      }
    });
  };

  // Filtrado de clientes (búsqueda multicriterio)
  const filteredClientes = initialClientes.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.dni.toLowerCase().includes(search.toLowerCase()) ||
      (c.cuit && c.cuit.toLowerCase().includes(search.toLowerCase())) ||
      (c.telefono && c.telefono.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()));

    let matchesStatus = false;
    if (filterStatus === "todos") {
      matchesStatus = true;
    } else if (filterStatus === "activos") {
      matchesStatus = c.activo;
    } else if (filterStatus === "inactivos") {
      matchesStatus = !c.activo;
    }
    return matchesSearch && matchesStatus;
  });

  // Contadores para stats
  const totalClientes = initialClientes.length;
  const clientesActivos = initialClientes.filter((c) => c.activo).length;
  const clientesInactivos = totalClientes - clientesActivos;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1. Header con estadísticas — compacto */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-2">
        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Total Clientes</p>
            <p className="text-lg font-extrabold text-text">{totalClientes}</p>
          </div>
          <div className="p-1.5 bg-brand-light rounded text-brand">
            <Users size={14} />
          </div>
        </div>

        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Activos</p>
            <p className="text-lg font-extrabold text-success">{clientesActivos}</p>
          </div>
          <div className="p-1.5 bg-success-light rounded text-success">
            <UserCheck size={14} />
          </div>
        </div>

        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-lg font-extrabold text-danger">{clientesInactivos}</p>
          </div>
          <div className="p-1.5 bg-danger-light rounded text-danger">
            <UserX size={14} />
          </div>
        </div>
      </div>

      {/* 2. TableShell with filters and actions */}
      <TableShell
        title="Gestión de Clientes"
        searchPlaceholder="Buscar por nombre, DNI, CUIT, teléfono..."
        searchValue={search}
        onSearchChange={setSearch}
        isEmpty={filteredClientes.length === 0}
        emptyMessage="No se encontraron clientes que coincidan con la búsqueda."
        emptyIcon={<Users size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status filter */}
            <div className="relative">
              <CheckCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="pl-7 pr-6 py-1.5 bg-bg border border-border rounded text-text text-[11px] focus:outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>

            {/* Add client button */}
            <button onClick={handleOpenAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand)] text-white rounded text-[11px] font-semibold hover:bg-[var(--brand)]/90 transition">
              <Plus size={12} />
              Registrar
            </button>
          </div>
        }
      >
        <div className="overflow-auto max-h-[calc(100vh-22rem)]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-[var(--card)]">
              <tr className="border-b border-border text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
                <th className="py-2 px-4">Cliente</th>
                <th className="py-2 px-4">Documentos (DNI / CUIT)</th>
                <th className="py-2 px-4">Contacto</th>
                <th className="py-2 px-4 text-center">Estado</th>
                <th className="py-2 px-4 text-center">Compras</th>
                <th className="py-2 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm text-text-muted">
              {filteredClientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  className={`hover:bg-border/30 transition-colors duration-150 ${
                    !cliente.activo ? "opacity-60 bg-danger-light/5" : ""
                  }`}
                >
                  <td className="py-2 px-4">
                    <div className="font-semibold text-text text-sm">{cliente.nombre}</div>
                    <div className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      {new Date(cliente.creadoEn).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-text-muted">
                        <span className="font-medium text-text-secondary">DNI:</span> {cliente.dni}
                      </span>
                      {cliente.cuit ? (
                        <span className="text-[11px] text-text-muted">
                          <span className="font-medium text-text-secondary">CUIT:</span> {cliente.cuit}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-secondary italic">Sin CUIT</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex flex-col gap-0.5">
                      {cliente.telefono && (
                        <div className="text-[11px] flex items-center gap-1 text-text-muted">
                          <Phone size={11} className="text-text-secondary" />
                          {cliente.telefono}
                        </div>
                      )}
                      {cliente.email && (
                        <div className="text-[11px] flex items-center gap-1 text-text-muted">
                          <Mail size={11} className="text-text-secondary" />
                          {cliente.email}
                        </div>
                      )}
                      {!cliente.telefono && !cliente.email && (
                        <span className="text-[11px] text-text-secondary italic">Sin datos</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <Badge variant={cliente.activo ? "success" : "danger"} size="sm">
                      {cliente.activo ? "Activo" : "Baja"}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 text-center font-semibold text-text">
                    {cliente._count.ventas}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(cliente)}
                        title="Ficha Cliente"
                      >
                        <Info size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(cliente)}
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </Button>
                      {cliente.activo ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenToggle(cliente)}
                          title="Desactivar (Baja)"
                          className="hover:text-danger"
                        >
                          <UserX size={14} />
                        </Button>
                      ) : (
                        <>
                          {userRole === "ADMINISTRADOR" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenToggle(cliente)}
                              title="Reactivar"
                              className="hover:text-success"
                            >
                              <UserCheck size={14} />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              title="Reactivación restringida a Administrador"
                            >
                              <UserCheck size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(cliente)}
                            title="Eliminar físico de BD"
                            className="hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>

      {/* 3. Modal para Crear / Editar Cliente */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                <Users size={18} />
              </div>
              {editingCliente ? "Editar Cliente" : "Registrar Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              Complete la ficha del cliente. El Nombre y el DNI son campos obligatorios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nombre y Apellido / Razón Social" required>
              <Input
                type="text"
                name="nombre"
                defaultValue={editingCliente?.nombre || ""}
                placeholder="Ej: Juan Pérez o Distribuidora S.A."
                required
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="DNI" required>
                <Input
                  type="text"
                  name="dni"
                  defaultValue={editingCliente?.dni || ""}
                  placeholder="DNI del cliente (ej: 20123456)"
                  required
                />
              </FormField>

              <FormField label="CUIT (Opcional)">
                <Input
                  type="text"
                  name="cuit"
                  defaultValue={editingCliente?.cuit || ""}
                  placeholder="Ej: 30123456789"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Teléfono">
                <Input
                  type="text"
                  name="telefono"
                  defaultValue={editingCliente?.telefono || ""}
                  placeholder="Número de contacto"
                />
              </FormField>

              <FormField label="Email">
                <Input
                  type="email"
                  name="email"
                  defaultValue={editingCliente?.email || ""}
                  placeholder="correo@ejemplo.com"
                />
              </FormField>
            </div>

            <FormField label="Dirección">
              <Input
                type="text"
                name="direccion"
                defaultValue={editingCliente?.direccion || ""}
                placeholder="Calle, Número, Localidad"
              />
            </FormField>

            {/* Mensajes de feedback */}
            {errorMsg && (
              <div className="p-3 bg-danger-light border border-danger/20 text-danger rounded-[var(--radius-md)] text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-success-light border border-success/20 text-success rounded-[var(--radius-md)] text-xs flex items-center gap-2">
                <CheckCircle size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={isPending}
              >
                {editingCliente ? "Guardar Cambios" : "Crear Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Modal Ficha Cliente (Ver Detalles) */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                <Users size={18} />
              </div>
              Ficha del Cliente
            </DialogTitle>
            <DialogDescription>
              Información de registro y detalles fiscales.
            </DialogDescription>
          </DialogHeader>

          {selectedCliente && (
            <div className="space-y-4">
              <div className="bg-bg p-4 rounded-[var(--radius-lg)] border border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-text text-base">{selectedCliente.nombre}</h3>
                  <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-1">
                    <Calendar size={12} />
                    Registrado: {new Date(selectedCliente.creadoEn).toLocaleString()}
                  </p>
                </div>
                <Badge variant={selectedCliente.activo ? "success" : "danger"} size="sm">
                  {selectedCliente.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                  <span className="text-text-secondary">DNI</span>
                  <span className="font-semibold text-text">{selectedCliente.dni}</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                  <span className="text-text-secondary">CUIT Fiscal</span>
                  <span className="font-semibold text-text">{selectedCliente.cuit || "Sin CUIT registrado"}</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                  <span className="text-text-secondary">Teléfono</span>
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <Phone size={14} className="text-text-secondary" />
                    {selectedCliente.telefono || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                  <span className="text-text-secondary">Correo Electrónico</span>
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <Mail size={14} className="text-text-secondary" />
                    {selectedCliente.email || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-start text-sm border-b border-border pb-2">
                  <span className="text-text-secondary mt-0.5">Dirección</span>
                  <span className="font-semibold text-text flex items-start gap-1.5 text-right max-w-[200px]">
                    <MapPin size={14} className="text-text-secondary mt-0.5 shrink-0" />
                    {selectedCliente.direccion || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-text-secondary">Ventas en el sistema</span>
                  <span className="font-bold text-brand bg-brand-light px-2 py-0.5 rounded-md text-xs">
                    {selectedCliente._count.ventas} compras
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  Cerrar Ficha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Diálogo de Confirmación */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-3 rounded-[var(--radius-lg)] mb-4 ${
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
                    <strong className="text-text">"{confirmDialog.clienteName}"</strong>? El registro ya no
                    estará disponible para registrar nuevas ventas, pero conservará su historial intacto.
                  </>
                ) : (
                  <>
                    ¿Desea reactivar al cliente{" "}
                    <strong className="text-text">"{confirmDialog.clienteName}"</strong>? Esto le permitirá
                    volver a figurar en las listas de selección del terminal de ventas.
                  </>
                )
              ) : (
                <>
                  ¿Está completamente seguro de que desea eliminar permanentemente de la base de datos al
                  cliente <strong className="text-text">"{confirmDialog.clienteName}"</strong>? Esta acción no
                  se puede deshacer y fallará si el cliente tiene registros históricos.
                </>
              )}
            </p>

            {/* Error específico de la acción */}
            {confirmDialog.errorMsg && (
              <div className="mt-4 p-3 bg-danger-light border border-danger/20 text-danger rounded-[var(--radius-md)] text-xs flex items-center gap-2">
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
                variant={confirmDialog.type === "toggle" ? (confirmDialog.isActive ? "danger" : "success") : "danger"}
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
