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
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
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
  marca: string | null;
  codigo: string | null;
  imagen: string | null;
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Manejo de clicks en acciones
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(product.imagen || null);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(null);
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
                          (p.marca && p.marca.toLowerCase().includes(search.toLowerCase())) ||
                          (p.codigo && p.codigo.toLowerCase().includes(search.toLowerCase())) ||
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
    <div className="space-y-4 md:space-y-6">
      {/* 1. Header con estadísticas de Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
        {/* Card Total Productos */}
        <div className="bg-card border border-border p-5 rounded-[var(--radius-lg)] flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Total Repuestos</p>
            <p className="text-2xl font-extrabold text-text mt-1">
              {initialProducts.filter(p => p.activo).length}
            </p>
          </div>
          <div className="p-3 bg-brand-light rounded-[var(--radius-md)] text-brand">
            <Package size={24} />
          </div>
        </div>

        {/* Card Alerta Stock Bajo */}
        <div className="bg-card border border-border p-5 rounded-[var(--radius-lg)] flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Stock Crítico</p>
            <p className={`text-2xl font-extrabold mt-1 ${lowStockCount > 0 ? "text-warning" : "text-text"}`}>
              {lowStockCount}
            </p>
          </div>
          <div className={`p-3 rounded-[var(--radius-md)] ${lowStockCount > 0 ? "bg-warning-light text-warning animate-pulse" : "bg-border text-text-secondary"}`}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card Papelera */}
        <div className="bg-card border border-border p-5 rounded-[var(--radius-lg)] flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Inactivos / De Baja</p>
            <p className="text-2xl font-extrabold text-text mt-1">
              {initialProducts.filter(p => !p.activo).length}
            </p>
          </div>
          <div className="p-3 bg-border rounded-[var(--radius-md)] text-text-secondary">
            <FolderOpen size={24} />
          </div>
        </div>
      </div>

      {/* 2. TableShell with filters and actions */}
      <TableShell
        title="Inventario de Productos"
        searchPlaceholder="Buscar por repuesto, marca, código, proveedor..."
        searchValue={search}
        onSearchChange={setSearch}
        isEmpty={filteredProducts.length === 0}
        emptyMessage="No se encontraron productos coincidentes."
        emptyIcon={<Package size={40} className="opacity-40" />}
        actions={
          <div className="flex items-center gap-3">
            {/* Category filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-bg border border-border rounded-[var(--radius-md)] text-text text-sm focus:outline-none focus:border-brand appearance-none"
              >
                <option value="all">Todas las Categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <StatusFilter value={filterStatus} onChange={setFilterStatus} />

            {/* Add product button */}
            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
              <Button onClick={handleOpenAdd} leftIcon={<Plus size={16} />}>
                Agregar Repuesto
              </Button>
            )}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider font-semibold text-text-secondary">
                <th className="py-4 px-6 text-center">ID</th>
                <th className="py-4 px-6">Repuesto / Marca / Código</th>
                <th className="py-4 px-6">Categoría</th>
                <th className="py-4 px-6">Proveedor</th>
                <th className="py-4 px-6 text-right">Precio Compra</th>
                <th className="py-4 px-6 text-right">Precio Venta</th>
                <th className="py-4 px-6 text-center">Stock</th>
                <th className="py-4 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm text-text-muted">
              {filteredProducts.map(p => {
                const isLowStock = p.activo && p.cantidad <= p.stockMinimo;
                const stockStatus = p.cantidad === 0 ? "danger" : isLowStock ? "warning" : "success";
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-border/30 transition duration-150 ${
                      isLowStock ? "bg-warning-light/5 hover:bg-warning-light/10" : ""
                    }`}
                  >
                    <td className="py-4 px-6 text-center text-xs font-mono text-text-secondary">
                      {p.id}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 flex-shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-border flex items-center justify-center">
                          {p.imagen ? (
                            <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-text-secondary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-text">{p.nombre}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {p.marca && <span className="font-medium">{p.marca}</span>}
                            {p.marca && p.codigo && <span className="mx-1">·</span>}
                            {p.codigo && <span className="font-mono">{p.codigo}</span>}
                            {!p.marca && !p.codigo && "Sin marca/código"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="default" size="sm">{p.categoria.nombre}</Badge>
                    </td>
                    <td className="py-4 px-6 text-text-muted">{p.proveedor.nombre}</td>
                    <td className="py-4 px-6 text-right text-xs font-mono text-text-secondary">
                      {formatCurrency(p.precioCompra)}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-brand">
                      {formatCurrency(p.precioVenta)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Badge variant={stockStatus} size="sm" className="font-mono">
                          {p.cantidad} u
                        </Badge>
                        {isLowStock && (
                          <span className="text-[10px] text-warning font-bold uppercase mt-1 flex items-center space-x-0.5 animate-pulse">
                            <AlertTriangle size={10} />
                            <span>Bajo Stock!</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-1 md:space-x-2">
                        {p.activo ? (
                          <>
                            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(p)}
                                title="Editar Producto"
                              >
                                <Edit2 size={14} />
                              </Button>
                            )}
                            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(p.id)}
                                title="Dar de Baja"
                                className="hover:text-danger"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </>
                        ) : (
                          ["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(p.id)}
                              title="Reactivar"
                              className="hover:text-success"
                            >
                              <RotateCcw size={14} />
                              <span className="hidden md:inline text-xs font-semibold">Reactivar</span>
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TableShell>

      {/* 3. MODAL (AGREGAR / EDITAR) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-[var(--radius-md)] bg-brand-light text-brand">
                <Package size={18} />
              </div>
              {editingProduct ? "Editar Repuesto" : "Agregar Nuevo Repuesto"}
            </DialogTitle>
            <DialogDescription>
              Complete la información técnica y comercial del producto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Nombre */}
            <FormField label="Descripción / Nombre del Repuesto" required>
              <Input
                name="nombre"
                type="text"
                defaultValue={editingProduct?.nombre || ""}
                required
                placeholder="Ej: Aceite Motul 5100 15W-50 4T"
              />
            </FormField>

            {/* Marca & Código */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Marca">
                <Input
                  name="marca"
                  type="text"
                  defaultValue={editingProduct?.marca || ""}
                  placeholder="Ej: Motul, Castrol..."
                />
              </FormField>

              <FormField label="Código / SKU">
                <Input
                  name="codigo"
                  type="text"
                  defaultValue={editingProduct?.codigo || ""}
                  placeholder="Ej: MOT-5100-15W50"
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* Categoría & Proveedor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Categoría" required>
                <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <select
                    name="categoriaId"
                    defaultValue={editingProduct?.categoria.id || ""}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-bg border border-border rounded-[var(--radius-md)] text-text text-sm focus:outline-none focus:border-brand appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </FormField>

              <FormField label="Proveedor" required>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <select
                    name="proveedorId"
                    defaultValue={editingProduct?.proveedor.id || ""}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-bg border border-border rounded-[var(--radius-md)] text-text text-sm focus:outline-none focus:border-brand appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </FormField>
            </div>

            {/* Imagen del Producto */}
            <FormField label="Imagen del Producto">
              <div className="flex items-center space-x-4">
                <div className="relative flex-shrink-0">
                  {imagePreview ? (
                    <div className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden border border-border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-[var(--radius-md)] bg-border flex items-center justify-center">
                      <Package size={24} className="text-text-secondary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center px-4 py-2 bg-brand-light text-brand border border-brand/20 rounded-[var(--radius-md)] text-sm font-semibold hover:bg-brand/20 cursor-pointer transition">
                      <span>Seleccionar imagen</span>
                      <input
                        type="file"
                        name="imagenFile"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.size > 2 * 1024 * 1024) {
                            alert("La imagen no puede superar 2MB");
                            e.target.value = "";
                            return;
                          }
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setImagePreview(url);
                          }
                        }}
                      />
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          // Reset file input
                          const fileInput = document.querySelector('input[name="imagenFile"]') as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                          // Clear hidden field
                          const hiddenInput = document.querySelector('input[name="imagen"]') as HTMLInputElement;
                          if (hiddenInput) hiddenInput.value = "";
                        }}
                        className="inline-flex items-center px-3 py-2 bg-danger-light text-danger border border-danger/20 rounded-[var(--radius-md)] text-xs font-semibold hover:bg-danger/20 transition"
                      >
                        Eliminar imagen
                      </button>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="imagen"
                    value={editingProduct?.imagen || ""}
                  />
                  <p className="text-[10px] text-text-secondary">
                    JPG, PNG o WebP. Máximo 2MB.
                  </p>
                </div>
              </div>
            </FormField>

            {/* Precio Compra & Venta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Precio Compra (Costo)" required>
                <Input
                  name="precioCompra"
                  type="number"
                  step="0.01"
                  defaultValue={editingProduct?.precioCompra || ""}
                  required
                  placeholder="0.00"
                  className="font-mono"
                />
              </FormField>

              <FormField label="Precio Venta (Público)" required>
                <Input
                  name="precioVenta"
                  type="number"
                  step="0.01"
                  defaultValue={editingProduct?.precioVenta || ""}
                  required
                  placeholder="0.00"
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* Cantidad & Stock Mínimo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Stock Existencias" required>
                <Input
                  name="cantidad"
                  type="number"
                  defaultValue={editingProduct?.cantidad ?? ""}
                  required
                  placeholder="0"
                  className="font-mono"
                />
              </FormField>

              <FormField label="Stock de Seguridad Mínimo" required>
                <Input
                  name="stockMinimo"
                  type="number"
                  defaultValue={editingProduct?.stockMinimo ?? ""}
                  required
                  placeholder="0"
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* Alerta Reposición (si el stock sube) */}
            {editingProduct && (
              <div className="p-3.5 bg-brand-light/5 border border-brand/10 rounded-[var(--radius-lg)] text-[11px] text-text-muted leading-normal flex items-start space-x-2">
                <TrendingDown className="text-brand mt-0.5 flex-shrink-0" size={14} />
                <span>
                  <strong>Regla Transaccional:</strong> Si incrementa el stock actual ({editingProduct.cantidad} u), el sistema generará automáticamente una <strong>Compra</strong> y registrará la salida financiera contable en el panel de <strong>Caja</strong>.
                </span>
              </div>
            )}

            {/* Alertas de Mensaje */}
            {errorMsg && (
              <div className="p-3 bg-danger-light border border-danger/20 text-danger text-xs font-semibold rounded-[var(--radius-md)] flex items-center space-x-2">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-success-light border border-success/20 text-success text-xs font-semibold rounded-[var(--radius-md)] flex items-center space-x-2">
                <CheckCircle size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Botón Guardar */}
            <div className="pt-2 flex justify-end space-x-3">
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
                {editingProduct ? "Actualizar Repuesto" : "Agregar Repuesto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
