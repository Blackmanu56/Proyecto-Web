"use client";

import React, { useState, useTransition } from "react";
import { createVenta } from "@/actions/ventas";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  ShoppingCart,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
  CheckCircle,
  FileText,
  Printer,
  X,
  CreditCard,
  UserPlus,
  Minus,
  ArrowRight,
  Package
} from "lucide-react";

interface Product {
  id: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
  categoria: { nombre: string };
}

interface Client {
  id: number;
  nombre: string;
  dni: string;
  cuit: string | null;
}

interface CartItem {
  id: number;
  nombre: string;
  precioVenta: number;
  stockDisponible: number;
  cantidad: number;
}

interface VentasTerminalProps {
  productos: Product[];
  clientes: Client[];
}

export default function VentasTerminal({ productos, clientes }: VentasTerminalProps) {
  const [isPending, startTransition] = useTransition();

  // Búsquedas
  const [prodSearch, setProdSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Entidades Seleccionadas
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estado de Ticket/Factura Emitida
  const [issuedInvoice, setIssuedInvoice] = useState<{
    id: number;
    cliente: string;
    total: number;
    fecha: string;
    detalles: { nombre: string; cantidad: number; precio: number }[];
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  // Obtener categorías únicas
  const categories = Array.from(new Set(productos.map(p => p.categoria.nombre)));

  // Agregar al carrito
  const addToCart = (product: Product) => {
    setErrorMsg("");
    const existing = cart.find(item => item.id === product.id);

    if (product.cantidad <= 0) {
      setErrorMsg("El producto no posee stock disponible.");
      return;
    }

    if (existing) {
      if (existing.cantidad >= product.cantidad) {
        setErrorMsg(`No puede superar el stock disponible (${product.cantidad} u.).`);
        return;
      }
      setCart(
        cart.map(item =>
          item.id === product.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          nombre: product.nombre,
          precioVenta: product.precioVenta,
          stockDisponible: product.cantidad,
          cantidad: 1,
        },
      ]);
    }
  };

  // Restar o quitar del carrito
  const updateQuantity = (id: number, delta: number) => {
    setErrorMsg("");
    setCart(
      cart
        .map(item => {
          if (item.id === id) {
            const newQty = item.cantidad + delta;
            if (newQty > item.stockDisponible) {
              setErrorMsg(`No puede superar el stock disponible (${item.stockDisponible} u.).`);
              return item;
            }
            return { ...item, cantidad: newQty };
          }
          return item;
        })
        .filter(item => item.cantidad > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Calcular total de venta
  const cartTotal = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.cantidad, 0);

  // Confirmar Venta transaccional
  const handleCheckout = async () => {
    setErrorMsg("");
    if (!selectedClient) {
      setErrorMsg("Debe seleccionar un cliente antes de facturar.");
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("El carrito de compras está vacío.");
      return;
    }

    const items = cart.map(item => ({
      productoId: item.id,
      cantidad: item.cantidad,
    }));

    startTransition(async () => {
      const res = await createVenta(selectedClient.id, items);

      if (res.success) {
        // Almacenar datos para renderizar el ticket
        setIssuedInvoice({
          id: res.ventaId!,
          cliente: selectedClient.nombre,
          total: res.total!,
          fecha: new Date().toLocaleDateString("es-AR") + " " + new Date().toLocaleTimeString("es-AR"),
          detalles: cart.map(item => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precioVenta,
          })),
        });

        // Limpiar estados
        setCart([]);
        setSelectedClient(null);
      } else {
        setErrorMsg(res.error || "Ocurrió un error al procesar el pago.");
      }
    });
  };

  // Filtrar productos
  const filteredProducts = productos.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(prodSearch.toLowerCase()) ||
      p.categoria.nombre.toLowerCase().includes(prodSearch.toLowerCase());
    const matchesCategory = !selectedCategory || p.categoria.nombre === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filtrar clientes
  const filteredClients = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.dni.includes(clientSearch) ||
    (c.cuit && c.cuit.includes(clientSearch))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* SECCIÓN IZQUIERDA: Productos (7/12 cols) */}
      <div className="lg:col-span-7 space-y-4 md:space-y-6">
        {/* 1. Panel de Selección de Clientes */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 space-y-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center space-x-2 text-[var(--brand)]">
            <Users size={18} />
            <h2 className="text-base font-bold text-[var(--text)]">Selección de Cliente</h2>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente por nombre, DNI o CUIT..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)] text-xs transition-colors"
            />
          </div>

          {/* Grilla Clientes */}
          <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)]">
            {filteredClients.map(c => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-[var(--brand-light)] text-[var(--brand)] font-semibold"
                      : "text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--text)]"
                  }`}
                >
                  <div>
                    <p className={isSelected ? "text-[var(--brand)]" : "text-[var(--text)]"}>{c.nombre}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      DNI: {c.dni} {c.cuit ? `| CUIT: ${c.cuit}` : ""}
                    </p>
                  </div>
                  {isSelected && <span className="text-[10px] bg-[var(--brand-light)] px-2 py-0.5 rounded border border-[var(--brand)]/20 font-bold uppercase">Seleccionado</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Panel de Búsqueda de Repuestos */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 space-y-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[var(--brand)]">
              <ShoppingCart size={18} />
              <h2 className="text-base font-bold text-[var(--text)]">Catálogo de Venta</h2>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">Haga clic en un producto para agregarlo</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
            <input
              type="text"
              placeholder="Buscar por repuesto, código, categoría..."
              value={prodSearch}
              onChange={e => setProdSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)] text-xs transition-colors"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium transition-all ${
                !selectedCategory
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)]"
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredProducts.map(p => {
              const isLowStock = p.cantidad <= 5;
              const hasNoStock = p.cantidad <= 0;
              return (
                <div
                  key={p.id}
                  onClick={() => !hasNoStock && addToCart(p)}
                  className={`bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 cursor-pointer transition-all hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)] ${
                    hasNoStock
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:scale-[1.02]"
                  }`}
                >
                  {/* Product Image Placeholder */}
                  <div className="w-full aspect-square bg-[var(--panel)] rounded-[var(--radius-md)] flex items-center justify-center mb-3">
                    <Package size={24} className="text-[var(--text-secondary)]" />
                  </div>
                  
                  {/* Product Info */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text)] line-clamp-2 leading-tight">{p.nombre}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{p.categoria.nombre}</p>
                    
                    {/* Stock Badge */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-semibold ${
                        hasNoStock ? "text-[var(--danger)]" : isLowStock ? "text-[var(--warning)]" : "text-[var(--success)]"
                      }`}>
                        {p.cantidad} u.
                      </span>
                      <span className="text-[9px] text-[var(--text-secondary)]">Stock</span>
                    </div>
                    
                    {/* Price and Add Button */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--brand)] font-mono">{formatCurrency(p.precioVenta)}</p>
                      {!hasNoStock && (
                        <button className="p-1.5 rounded-[var(--radius-md)] bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)]/20 hover:bg-[var(--brand)] hover:text-white transition-all">
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN DERECHA: Carrito de Compras (5/12 cols) - Sticky */}
      <div className="lg:col-span-5 lg:sticky lg:top-6">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 space-y-5 flex flex-col shadow-[var(--shadow-sm)]">
          {/* Header Carrito */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
            <div className="flex items-center space-x-2 text-[var(--brand)]">
              <ShoppingCart size={18} />
              <h2 className="text-base font-bold text-[var(--text)]">Carrito de compras</h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 bg-[var(--brand-light)] border border-[var(--brand)]/20 text-[var(--brand)] font-semibold rounded-[var(--radius-full)] font-mono">
              {cartItemCount} {cartItemCount === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          {/* Listado de ítems del Carrito */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-80">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-16 space-y-2">
                <ShoppingCart size={32} className="opacity-40" />
                <p className="text-xs">El carrito está vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] flex items-center justify-between">
                  <div className="max-w-[60%]">
                    <p className="text-xs font-semibold text-[var(--text)] truncate">{item.nombre}</p>
                    <p className="text-[10px] text-[var(--brand)] font-mono mt-0.5">{formatCurrency(item.precioVenta)} c/u</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Controles de Cantidad */}
                    <div className="flex items-center bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden h-7">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 text-[var(--text-secondary)] hover:text-[var(--text)] transition text-xs font-bold"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="px-2 text-xs font-mono font-semibold text-[var(--text)]">{item.cantidad}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 text-[var(--text-secondary)] hover:text-[var(--text)] transition text-xs font-bold"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    {/* Quitar */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-[var(--text-secondary)] hover:text-[var(--danger)] transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Info */}
          <div className="border-t border-[var(--border)] pt-4 space-y-4">
            {/* Cliente Activo */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Cliente Asignado:</span>
              <span className="font-semibold text-[var(--text)]">
                {selectedClient ? selectedClient.nombre : <span className="text-[var(--text-secondary)] italic">No seleccionado</span>}
              </span>
            </div>

            {/* Summary Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)]">Subtotal:</span>
                <span className="font-mono text-[var(--text)]">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)]">IVA (21%):</span>
                <span className="font-mono text-[var(--text)]">{formatCurrency(cartTotal * 0.21)}</span>
              </div>
              <div className="h-px bg-[var(--border)] my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[var(--text)]">Total:</span>
                <span className="text-xl font-black font-mono text-[var(--success)]">{formatCurrency(cartTotal * 1.21)}</span>
              </div>
            </div>

            {/* Mensajes de Error */}
            {errorMsg && (
              <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center space-x-2">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Cobrar - ROJO Y PROMINENTE */}
            <button
              onClick={handleCheckout}
              disabled={isPending || cart.length === 0}
              className="w-full py-4 bg-gradient-to-r from-[var(--danger)] to-[var(--brand)] hover:from-[var(--brand)] hover:to-[var(--danger)] text-white font-bold rounded-[var(--radius-lg)] shadow-lg shadow-[var(--danger)]/20 focus:outline-none transition duration-150 flex items-center justify-center text-base disabled:opacity-40 hover:shadow-xl hover:shadow-[var(--danger)]/30"
            >
              {isPending ? (
                "Procesando Cobro..."
              ) : (
                <>
                  <span>Cobrar</span>
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </button>

            {/* Botón Limpiar Carrito */}
            {cart.length > 0 && (
              <button
                onClick={() => {
                  setCart([]);
                  setSelectedClient(null);
                  setErrorMsg("");
                }}
                className="w-full py-2.5 bg-transparent border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] font-semibold rounded-[var(--radius-md)] transition duration-150 text-xs"
              >
                Limpiar carrito
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. TICKET DE VENTA EMITIDA (DIALOG DE EXITO) */}
      {issuedInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 border border-slate-300 w-full max-w-sm rounded-[var(--radius-xl)] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 font-mono text-xs">
            {/* Cerrar modal */}
            <button
              onClick={() => setIssuedInvoice(null)}
              className="absolute right-4 top-4 p-1.5 rounded-[var(--radius-md)] bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
            >
              <X size={16} />
            </button>

            {/* Cabecera del Ticket */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
              <h3 className="text-base font-black uppercase tracking-wider">CHOPPER REPUESTOS</h3>
              <p className="text-[10px] text-slate-500 mt-1">Av. Roque Saenz Peña 1500 - Posadas</p>
              <p className="text-[10px] text-slate-500">CUIT: 37323400546</p>
            </div>

            {/* Metadata Venta */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-4 mb-4">
              <div className="flex justify-between">
                <span>FACTURA Nº:</span>
                <span className="font-bold">#{issuedInvoice.id.toString().padStart(6, "0")}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{issuedInvoice.fecha}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold truncate max-w-[70%]">{issuedInvoice.cliente}</span>
              </div>
            </div>

            {/* Desglose de Productos */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-4 mb-4">
              <div className="flex justify-between font-bold text-slate-500">
                <span>DETALLE</span>
                <span>CANT x PRECIO</span>
              </div>
              {issuedInvoice.detalles.map((det, index) => (
                <div key={index} className="flex justify-between leading-normal">
                  <span className="truncate max-w-[65%]">{det.nombre}</span>
                  <span className="font-mono text-right flex-shrink-0">
                    {det.cantidad} x {formatCurrency(det.precio)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Cobrado */}
            <div className="space-y-1 pb-4 mb-4 text-sm font-bold flex justify-between border-b border-slate-300">
              <span>TOTAL NETO:</span>
              <span className="font-mono text-slate-950 text-base">{formatCurrency(issuedInvoice.total)}</span>
            </div>

            {/* Pie de Página */}
            <div className="text-center text-slate-500 space-y-2">
              <p className="text-[10px]">¡GRACIAS POR SU COMPRA!</p>
              <p className="text-[9px] italic">Este ticket sirve como constancia de pago.</p>
              
              <div className="pt-2 flex justify-center space-x-3 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-sans font-semibold rounded-[var(--radius-md)] flex items-center space-x-1.5 transition text-xs shadow-md"
                >
                  <Printer size={12} />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIssuedInvoice(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 font-sans font-semibold rounded-[var(--radius-md)] flex items-center transition text-xs"
                >
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
