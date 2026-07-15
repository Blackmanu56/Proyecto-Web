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
  const [stockFilter, setStockFilter] = useState<"todos" | "normal" | "poco" | "sin">("todos");

  // Estados del Formulario (Agregar / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cantidadAReponer, setCantidadAReponer] = useState<number | "">("");

  // Manejo de clicks en acciones
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setCantidadAReponer("");
    setErrorMsg("");
    setSuccessMsg("");
    setImagePreview(product.imagen || null);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setCantidadAReponer("");
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

    let matchesStock = false;
    if (stockFilter === "todos") {
      matchesStock = true;
    } else if (stockFilter === "normal") {
      matchesStock = p.cantidad > p.stockMinimo;
    } else if (stockFilter === "poco") {
      matchesStock = p.cantidad > 0 && p.cantidad <= p.stockMinimo;
    } else if (stockFilter === "sin") {
      matchesStock = p.cantidad === 0;
    }

    return matchesSearch && matchesCat && matchesStatus && matchesStock;
  });

  // Count helpers for stock badges
  const activeProductsForCounts = initialProducts.filter(p => {
    if (filterStatus === "todos") return true;
    if (filterStatus === "activos") return p.activo;
    if (filterStatus === "inactivos") return !p.activo;
    return true;
  });

  const countTodos = activeProductsForCounts.length;
  const countNormal = activeProductsForCounts.filter(p => p.cantidad > p.stockMinimo).length;
  const countPoco = activeProductsForCounts.filter(p => p.cantidad > 0 && p.cantidad <= p.stockMinimo).length;
  const countSin = activeProductsForCounts.filter(p => p.cantidad === 0).length;
  const lowStockCount = initialProducts.filter(p => p.activo && p.cantidad <= p.stockMinimo).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1. Header con estadísticas de Stock — compacto */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-2">
        {/* Card Total Productos */}
        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Repuestos</p>
            <p className="text-lg font-extrabold text-text">
              {initialProducts.filter(p => p.activo).length}
            </p>
          </div>
          <div className="p-1.5 bg-brand-light rounded text-brand">
            <Package size={14} />
          </div>
        </div>

        {/* Card Alerta Stock Bajo */}
        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Stock Crítico</p>
            <p className={`text-lg font-extrabold ${lowStockCount > 0 ? "text-warning" : "text-text"}`}>
              {lowStockCount}
            </p>
          </div>
          <div className={`p-1.5 rounded ${lowStockCount > 0 ? "bg-warning-light text-warning animate-pulse" : "bg-border text-text-secondary"}`}>
            <AlertTriangle size={14} />
          </div>
        </div>

        {/* Card Papelera */}
        <div className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Inactivos</p>
            <p className="text-lg font-extrabold text-text">
              {initialProducts.filter(p => !p.activo).length}
            </p>
          </div>
          <div className="p-1.5 bg-border rounded text-text-secondary">
            <FolderOpen size={14} />
          </div>
        </div>
      </div>

      {/* 2. TableShell with filters and actions */}
      <TableShell
        title="Inventario de Productos"
        searchPlaceholder="Buscar repuesto, marca, código..."
        searchValue={search}
        onSearchChange={setSearch}
        isEmpty={filteredProducts.length === 0}
        emptyMessage="No se encontraron productos."
        emptyIcon={<Package size={32} className="opacity-40" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="pl-7 pr-6 py-1.5 bg-bg border border-border rounded text-text text-[11px] focus:outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="all">Categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="relative">
              <CheckCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="pl-7 pr-6 py-1.5 bg-bg border border-border rounded text-text text-[11px] focus:outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>

            {/* Stock filter */}
            <div className="relative">
              <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
              <select
                value={stockFilter}
                onChange={e => setStockFilter(e.target.value as any)}
                className="pl-7 pr-6 py-1.5 bg-bg border border-border rounded text-text text-[11px] focus:outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="todos">Stock ({countTodos})</option>
                <option value="normal">Normal ({countNormal})</option>
                <option value="poco">Poco ({countPoco})</option>
                <option value="sin">Sin ({countSin})</option>
              </select>
            </div>

            {/* Add product button */}
            {["ADMINISTRADOR", "ENCARGADO_STOCK"].includes(userRole) && (
              <button onClick={handleOpenAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand)] text-white rounded text-[11px] font-semibold hover:bg-[var(--brand)]/90 transition">
                <Plus size={12} />
                Agregar
              </button>
            )}
          </div>
        }
      >
        <div className="overflow-auto max-h-[calc(100vh-22rem)]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-[var(--card)]">
              <tr className="border-b border-border text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
                <th className="py-2 px-4 text-center">ID</th>
                <th className="py-2 px-4">Repuesto / Marca / Código</th>
                <th className="py-2 px-4">Categoría</th>
                <th className="py-2 px-4">Proveedor</th>
                <th className="py-2 px-4 text-right">P. Compra</th>
                <th className="py-2 px-4 text-right">P. Venta</th>
                <th className="py-2 px-4 text-center">Stock</th>
                <th className="py-2 px-4 text-center">Acciones</th>
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
                    <td className="py-2 px-4 text-center text-[11px] font-mono text-text-secondary">
                      {p.id}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-border flex items-center justify-center">
                          {p.imagen ? (
                            <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={12} className="text-text-secondary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-text text-sm">{p.nombre}</p>
                          <p className="text-[11px] text-text-secondary">
                            {p.marca && <span className="font-medium">{p.marca}</span>}
                            {p.marca && p.codigo && <span className="mx-0.5">·</span>}
                            {p.codigo && <span className="font-mono">{p.codigo}</span>}
                            {!p.marca && !p.codigo && <span className="italic">Sin marca/código</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant="default" size="sm">{p.categoria.nombre}</Badge>
                    </td>
                    <td className="py-2 px-4 text-text-muted text-[11px]">{p.proveedor.nombre}</td>
                    <td className="py-2 px-4 text-right text-[11px] font-mono text-text-secondary">
                      {formatCurrency(p.precioCompra)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-brand text-sm">
                      {formatCurrency(p.precioVenta)}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Badge variant={stockStatus} size="sm" className="font-mono text-[11px]">
                          {p.cantidad} u
                        </Badge>
                        {isLowStock && (
                          <span className="text-[10px] text-warning font-bold uppercase mt-0.5 flex items-center space-x-0.5 animate-pulse">
                            <AlertTriangle size={8} />
                            <span>Bajo!</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
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
            {editingProduct ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Stock Existencias">
                    <Input
                      type="number"
                      value={editingProduct.cantidad}
                      disabled
                      placeholder="0"
                      className="font-mono bg-[var(--bg-secondary)]"
                    />
                  </FormField>

                  <FormField label="Cantidad a Reponer">
                    <Input
                      type="number"
                      min="0"
                      value={cantidadAReponer}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCantidadAReponer(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                      placeholder="0"
                      className="font-mono"
                    />
                  </FormField>

                  <FormField label="Nuevo Stock">
                    <Input
                      name="cantidad"
                      type="number"
                      value={editingProduct.cantidad + (Number(cantidadAReponer) || 0)}
                      readOnly
                      placeholder="0"
                      className="font-mono font-bold bg-[var(--bg-secondary)] text-[var(--brand)]"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1">
                  <FormField label="Stock de Seguridad Mínimo" required>
                    <Input
                      name="stockMinimo"
                      type="number"
                      defaultValue={editingProduct.stockMinimo ?? ""}
                      required
                      placeholder="0"
                      className="font-mono"
                    />
                  </FormField>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Stock Existencias" required>
                  <Input
                    name="cantidad"
                    type="number"
                    required
                    placeholder="0"
                    className="font-mono"
                  />
                </FormField>

                <FormField label="Stock de Seguridad Mínimo" required>
                  <Input
                    name="stockMinimo"
                    type="number"
                    required
                    placeholder="0"
                    className="font-mono"
                  />
                </FormField>
              </div>
            )}

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
