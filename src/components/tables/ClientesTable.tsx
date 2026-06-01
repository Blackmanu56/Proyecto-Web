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
import {
  Plus,
  Search,
  Edit2,
  UserX,
  UserCheck,
  X,
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
  Loader2,
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


  // Estados del Formulario (Agregar / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteConVentas | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // Nuevo filtro de estado: 'activos', 'inactivos', 'todos'
  const [filterStatus, setFilterStatus] = useState<'activos' | 'inactivos' | 'todos'>('activos');

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
    if (filterStatus === 'todos') {
      matchesStatus = true;
    } else if (filterStatus === 'activos') {
      matchesStatus = c.activo;
    } else if (filterStatus === 'inactivos') {
      matchesStatus = !c.activo;
    }
    return matchesSearch && matchesStatus;
  });

  // Métricas para tarjetas superiores
  const totalClientes = initialClientes.length;
  const clientesActivos = initialClientes.filter((c) => c.activo).length;
  const clientesInactivos = totalClientes - clientesActivos;
  const totalVentasRegistradas = initialClientes.reduce((acc, c) => acc + c._count.ventas, 0);

  return (
    <div className="space-y-6">
      {/* Encabezado y Métricas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="text-indigo-400" />
            Gestión de Clientes
          </h1>
          <p className="text-sm text-slate-400">
            Administrá los datos fiscales, CUIT y contacto de los clientes de la tienda.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/20 active:scale-95"
        >
          <Plus size={16} />
          Registrar Cliente
        </button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Clientes</p>
            <p className="text-2xl font-bold text-white mt-1">{totalClientes}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Activos</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{clientesActivos}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inactivos</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{clientesInactivos}</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
            <UserX size={22} />
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transacciones Realizadas</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{totalVentasRegistradas}</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
            <FileText size={22} />
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-850 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, CUIT, teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
          />
        </div>
        <div className="flex items-center space-x-2 text-indigo-400">
          <Users size={18} />
          <h2 className="text-base font-bold text-white">Gestión de Cliente</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400 mr-2">Filtrar:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl text-white text-xs px-2 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-slate-900/30 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-5">Cliente</th>
                <th className="py-4 px-5">Documentos (DNI / CUIT)</th>
                <th className="py-4 px-5">Contacto</th>
                <th className="py-4 px-5 text-center">Estado</th>
                <th className="py-4 px-5 text-center">Compras</th>
                <th className="py-4 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-sm text-slate-300">
              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No se encontraron clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className={`hover:bg-slate-850/30 transition-colors duration-150 ${
                      !cliente.activo ? "opacity-60 bg-red-950/5" : ""
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-white">{cliente.nombre}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} />
                        Registrado: {new Date(cliente.creadoEn).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-400">
                          <span className="font-medium text-slate-500">DNI:</span> {cliente.dni}
                        </span>
                        {cliente.cuit ? (
                          <span className="text-xs text-slate-400">
                            <span className="font-medium text-slate-500">CUIT:</span> {cliente.cuit}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600 italic">Sin CUIT</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-0.5">
                        {cliente.telefono && (
                          <div className="text-xs flex items-center gap-1 text-slate-400">
                            <Phone size={12} className="text-slate-500" />
                            {cliente.telefono}
                          </div>
                        )}
                        {cliente.email && (
                          <div className="text-xs flex items-center gap-1 text-slate-400">
                            <Mail size={12} className="text-slate-500" />
                            {cliente.email}
                          </div>
                        )}
                        {!cliente.telefono && !cliente.email && (
                          <span className="text-[11px] text-slate-600 italic">Sin datos de contacto</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {cliente.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Baja Lógica
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center font-semibold text-slate-200">
                      {cliente._count.ventas}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(cliente)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Ficha Cliente"
                        >
                          <Info size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        {cliente.activo ? (
                          <button
                            onClick={() => handleOpenToggle(cliente)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:text-white hover:bg-red-500 transition-colors"
                            title="Desactivar (Baja)"
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <>
                            {userRole === "ADMINISTRADOR" ? (
                              <button
                                onClick={() => handleOpenToggle(cliente)}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:text-white hover:bg-emerald-500 transition-colors"
                                title="Reactivar"
                              >
                                <UserCheck size={14} />
                              </button>
                            ) : (
                              <span
                                className="p-1.5 rounded-lg bg-slate-800/40 text-slate-600 cursor-not-allowed"
                                title="Reactivación restringida a Administrador"
                              >
                                <UserCheck size={14} />
                              </span>
                            )}
                            <button
                              onClick={() => handleOpenDelete(cliente)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:text-white hover:bg-red-600 transition-colors"
                              title="Eliminar físico de BD"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear / Editar Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Users className="text-indigo-400" size={20} />
              {editingCliente ? "Editar Cliente" : "Registrar Nuevo Cliente"}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Complete la ficha del cliente. El Nombre y el DNI son campos obligatorios.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nombre y Apellido / Razón Social *
                </label>
                <input
                  type="text"
                  name="nombre"
                  defaultValue={editingCliente?.nombre || ""}
                  placeholder="Ej: Juan Pérez o Distribuidora S.A."
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    DNI *
                  </label>
                  <input
                    type="text"
                    name="dni"
                    defaultValue={editingCliente?.dni || ""}
                    placeholder="DNI del cliente (ej: 20123456)"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    CUIT (Opcional)
                  </label>
                  <input
                    type="text"
                    name="cuit"
                    defaultValue={editingCliente?.cuit || ""}
                    placeholder="Ej: 30123456789"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="telefono"
                    defaultValue={editingCliente?.telefono || ""}
                    placeholder="Número de contacto"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCliente?.email || ""}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Dirección
                </label>
                <input
                  type="text"
                  name="direccion"
                  defaultValue={editingCliente?.direccion || ""}
                  placeholder="Calle, Número, Localidad"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* Mensajes de feedback */}
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle size={14} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                  disabled={isPending}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {editingCliente ? "Guardar Cambios" : "Crear Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Cliente (Ver Detalles) */}
      {isDetailModalOpen && selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Users className="text-indigo-400" size={20} />
              Ficha del Cliente
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Información de registro y detalles fiscales.
            </p>

            <div className="space-y-4">
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">{selectedCliente.nombre}</h3>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    <Calendar size={12} />
                    Registrado: {new Date(selectedCliente.creadoEn).toLocaleString()}
                  </p>
                </div>
                <div>
                  {selectedCliente.activo ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                      Inactivo
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex justify-between items-center text-sm border-b border-slate-850 pb-2">
                  <span className="text-slate-500">DNI</span>
                  <span className="font-semibold text-white">{selectedCliente.dni}</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-850 pb-2">
                  <span className="text-slate-500">CUIT Fiscal</span>
                  <span className="font-semibold text-white">{selectedCliente.cuit || "Sin CUIT registrado"}</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-850 pb-2">
                  <span className="text-slate-500">Teléfono</span>
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-500" />
                    {selectedCliente.telefono || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-850 pb-2">
                  <span className="text-slate-500">Correo Electrónico</span>
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-500" />
                    {selectedCliente.email || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-start text-sm border-b border-slate-850 pb-2">
                  <span className="text-slate-500 mt-0.5">Dirección</span>
                  <span className="font-semibold text-white flex items-start gap-1.5 text-right max-w-[200px]">
                    <MapPin size={14} className="text-slate-500 mt-0.5 shrink-0" />
                    {selectedCliente.direccion || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-slate-500">Ventas en el sistema</span>
                  <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md text-xs">
                    {selectedCliente._count.ventas} compras
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                >
                  Cerrar Ficha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmación */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-white">
                {confirmDialog.type === "toggle"
                  ? confirmDialog.isActive
                    ? "Confirmar Baja Lógica"
                    : "Confirmar Reactivación"
                  : "Confirmar Eliminación"}
              </h3>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {confirmDialog.type === "toggle" ? (
                confirmDialog.isActive ? (
                  <>
                    ¿Está seguro de que desea dar de baja al cliente{" "}
                    <strong className="text-white">"{confirmDialog.clienteName}"</strong>? El registro ya no
                    estará disponible para registrar nuevas ventas, pero conservará su historial intacto.
                  </>
                ) : (
                  <>
                    ¿Desea reactivar al cliente{" "}
                    <strong className="text-white">"{confirmDialog.clienteName}"</strong>? Esto le permitirá
                    volver a figurar en las listas de selección del terminal de ventas.
                  </>
                )
              ) : (
                <>
                  ¿Está completamente seguro de que desea eliminar permanentemente de la base de datos al
                  cliente <strong className="text-white">"{confirmDialog.clienteName}"</strong>? Esta acción no
                  se puede deshacer y fallará si el cliente tiene registros históricos.
                </>
              )}
            </p>

            {/* Error específico de la acción */}
            {confirmDialog.errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{confirmDialog.errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-1.5 ${
                  confirmDialog.type === "toggle"
                    ? confirmDialog.isActive
                      ? "bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/10"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/10"
                    : "bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/10"
                }`}
                disabled={isPending}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
