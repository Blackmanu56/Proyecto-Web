"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProducto,
  updateProducto,
  deleteProducto,
  reactivarProducto
} from "@/actions/productos";
import { formatCurrency } from "@/lib/utils";
import StatusFilter from "./StatusFilter";
import type { FilterStatus } from "./StatusFilter";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FolderOpen,
  Filter,
  Package,
  X,
  CheckCircle,
  Truck,
  Layers,
  ArrowRight,
  TrendingDown
} from "lucide-react";

interface Product {
  id: number;
  nombre: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  categoria: { id: number; nombre: string };
  proveedor: { id: number; nombre: string };
}

interface ProductosTableProps {
  initialProducts: Product[];
  categorias: { id: number; nombre: string }[];
  proveedores: { id: number; cuit: string; nombre: string }[];
  userRole: string;
}

export default function ProductosTable({
  initialProducts,
  categorias,
  proveedores,
  userRole
}: ProductosTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filtros y búsquedas
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("activos");

  // Estados del Formulario (Agregar / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Manejo de clicks en acciones
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setErrorMsg("");
    setSuccessMsg("");
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setErrorMsg("");
    setSuccessMsg("");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Seguro que desea dar de baja este producto?")) return;
    
    startTransition(async () => {
      const res = await deleteProducto(id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  };

  const handleRestore = async (id: number) => {
    if (!confirm("¿Desea reactivar este producto y devolverlo al catálogo activo?")) return;
    
    startTransition(async () => {
      const res = await reactivarProducto(id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
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
      if (editingProduct) {
        res = await updateProducto(editingProduct.id, formData);
      } else {
        res = await createProducto(formData);
      }

      if (res.success) {
        setSuccessMsg(
          editingProduct
            ? "Producto actualizado exitosamente."
            : "Producto creado exitosamente."
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

  // Filtrar productos del lado del cliente
  const filteredProducts = initialProducts.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || 
                          p.proveedor.nombre.toLowerCase().includes(search.toLowerCase()) ||
                          p.categoria.nombre.toLowerCase().includes(search.toLowerCase());
    
    const matchesCat = catFilter === "all" || p.categoria.id === Number(catFilter);

    let matchesStatus = false;
    if (filterStatus === "todos") {
      matchesStatus = true;
    } else if (filterStatus === "activos") {
      matchesStatus = p.activo;
    } else if (filterStatus === "inactivos") {
      matchesStatus = !p.activo;
    }

    return matchesSearch && matchesCat && matchesStatus;
  });

  const lowStockCount = initialProducts.filter(p => p.activo && p.cantidad <= p.stockMinimo).length;

  return (
    <div className="space-y-6">
      {/* 1. Header con estadísticas de Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card Total Productos */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Repuestos</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {initialProducts.filter(p => p.activo).length}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Package size={24} />
          </div>
        </div>

        {/* Card Alerta Stock Bajo */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stock Crítico</p>
            <p className={`text-2xl font-extrabold mt-1 ${lowStockCount > 0 ? "text-amber-400" : "text-white"}`}>
              {lowStockCount}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${lowStockCount > 0 ? "bg-amber-500/10 text-amber-400 animate-pulse" : "bg-slate-800 text-slate-400"}`}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card Papelera */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inactivos / De Baja</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {initialProducts.filter(p => !p.activo).length}
            </p>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl text-slate-400">
            <FolderOpen size={24} />
          </div>
        </div>
      </div>

      {/* 2. Filtros & Acciones */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por repuesto, proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Categoría dropdown */}
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm appearance-none"
            >
              <option value="all">Todas las Categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Filtro de estado Activo/Inactivo */}
          <StatusFilter value={filterStatus} onChange={setFilterStatus} />

          {/* Agregar producto */}
          {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-600 hover:border-indigo-500 text-white text-sm font-semibold rounded-xl transition duration-200 flex items-center space-x-1.5 shadow-lg shadow-indigo-600/10"
            >
              <Plus size={16} />
              <span>Agregar Repuesto</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Tabla de Productos */}
      <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-6 text-center">ID</th>
                <th className="py-4 px-6">Repuesto / Marca</th>
                <th className="py-4 px-6">Categoría</th>
                <th className="py-4 px-6">Proveedor</th>
                <th className="py-4 px-6 text-right">Precio Compra</th>
                <th className="py-4 px-6 text-right">Precio Venta</th>
                <th className="py-4 px-6 text-center">Stock</th>
                <th className="py-4 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-6 text-center text-slate-500">
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLowStock = p.activo && p.cantidad <= p.stockMinimo;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-900/30 transition duration-150 ${
                        isLowStock ? "bg-amber-950/5 hover:bg-amber-950/10" : ""
                      }`}
                    >
                      <td className="py-4 px-6 text-center text-xs font-mono text-slate-500">
                        {p.id}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-white">{p.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Marca estándar</p>
                      </td>
                      <td className="py-4 px-6 text-slate-400">{p.categoria.nombre}</td>
                      <td className="py-4 px-6 text-slate-400">{p.proveedor.nombre}</td>
                      <td className="py-4 px-6 text-right text-xs font-mono text-slate-500">
                        {formatCurrency(p.precioCompra)}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-semibold text-indigo-400">
                        {formatCurrency(p.precioVenta)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded-lg text-xs font-mono ${
                              isLowStock
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {p.cantidad} u
                          </span>
                          {isLowStock && (
                            <span className="text-[10px] text-amber-500 font-bold uppercase mt-1 flex items-center space-x-0.5 animate-pulse">
                              <AlertTriangle size={10} />
                              <span>Bajo Stock!</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {p.activo ? (
                            <>
                              {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                                <button
                                  onClick={() => handleEdit(p)}
                                  className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 border border-slate-700/40 transition duration-150"
                                  title="Editar Producto"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700/40 transition duration-150"
                                  title="Dar de Baja"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                              <button
                                onClick={() => handleRestore(p.id)}
                                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 border border-slate-700/40 transition duration-150 flex items-center space-x-1"
                                title="Reactivar"
                              >
                                <RotateCcw size={14} />
                                <span className="text-xs font-semibold pr-1">Reactivar</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL DRAWER (AGREGAR / EDITAR) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            {/* Cerrar modal */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X size={16} />
            </button>

            {/* Icono Cabecera */}
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Package size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingProduct ? "Editar Repuesto" : "Agregar Nuevo Repuesto"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete la información técnica y comercial del producto.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Descripción / Nombre del Repuesto
                </label>
                <input
                  name="nombre"
                  type="text"
                  defaultValue={editingProduct?.nombre || ""}
                  required
                  placeholder="Ej: Aceite Motul 5100 15W-50 4T"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Categoría & Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Categoría
                  </label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                    <select
                      name="categoriaId"
                      defaultValue={editingProduct?.categoria.id || ""}
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm appearance-none"
                    >
                      <option value="">Seleccione...</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Proveedor
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                    <select
                      name="proveedorId"
                      defaultValue={editingProduct?.proveedor.id || ""}
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm appearance-none"
                    >
                      <option value="">Seleccione...</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Precio Compra & Venta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Precio Compra (Costo)
                  </label>
                  <input
                    name="precioCompra"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.precioCompra || ""}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Precio Venta (Público)
                  </label>
                  <input
                    name="precioVenta"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.precioVenta || ""}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Cantidad & Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Stock Existencias
                  </label>
                  <input
                    name="cantidad"
                    type="number"
                    defaultValue={editingProduct?.cantidad ?? ""}
                    required
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Stock de Seguridad Mínimo
                  </label>
                  <input
                    name="stockMinimo"
                    type="number"
                    defaultValue={editingProduct?.stockMinimo ?? ""}
                    required
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Alerta Reposición (si el stock sube) */}
              {editingProduct && (
                <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-slate-400 leading-normal flex items-start space-x-2">
                  <TrendingDown className="text-indigo-400 mt-0.5 flex-shrink-0" size={14} />
                  <span>
                    <strong>Regla Transaccional:</strong> Si incrementa el stock actual ({editingProduct.cantidad} u), el sistema generará automáticamente una <strong>Compra</strong> y registrará la salida financiera contable en el panel de **Caja**.
                  </span>
                </div>
              )}

              {/* Alertas de Mensaje */}
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl flex items-center space-x-2 animate-shake">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl flex items-center space-x-2 animate-pulse">
                  <CheckCircle size={14} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Botón Guardar */}
              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-sm font-semibold rounded-xl transition duration-150"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-600 hover:border-indigo-500 text-white text-sm font-semibold rounded-xl transition duration-150 flex items-center justify-center disabled:opacity-50"
                  disabled={isPending}
                >
                  {isPending ? "Procesando..." : editingProduct ? "Actualizar Repuesto" : "Agregar Repuesto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
