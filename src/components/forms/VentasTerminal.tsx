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
  UserPlus
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
  const filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.categoria.nombre.toLowerCase().includes(prodSearch.toLowerCase())
  );

  // Filtrar clientes
  const filteredClients = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.dni.includes(clientSearch)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* SECCIÓN IZQUIERDA: Búsqueda e Inserción (7/12 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* 1. Panel de Selección de Clientes */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center space-x-2 text-indigo-400">
            <Users size={18} />
            <h2 className="text-base font-bold text-white">Selección de Cliente</h2>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o DNI..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Grilla Clientes */}
          <div className="max-h-36 overflow-y-auto border border-slate-800/60 rounded-xl divide-y divide-slate-850">
            {filteredClients.map(c => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-indigo-600/10 text-indigo-400 font-semibold"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <div>
                    <p className={isSelected ? "text-indigo-400" : "text-white"}>{c.nombre}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">DNI: {c.dni}</p>
                  </div>
                  {isSelected && <span className="text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-bold uppercase">Seleccionado</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Panel de Búsqueda de Repuestos */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-indigo-400">
              <ShoppingCart size={18} />
              <h2 className="text-base font-bold text-white">Catálogo de Venta</h2>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Haga clic en un producto para agregarlo</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar por repuesto, código, categoría..."
              value={prodSearch}
              onChange={e => setProdSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Grilla Productos */}
          <div className="max-h-72 overflow-y-auto border border-slate-800/60 rounded-xl divide-y divide-slate-850">
            {filteredProducts.map(p => {
              const isLowStock = p.cantidad <= 5;
              const hasNoStock = p.cantidad <= 0;
              return (
                <div
                  key={p.id}
                  onClick={() => !hasNoStock && addToCart(p)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition ${
                    hasNoStock
                      ? "opacity-40 cursor-not-allowed bg-slate-900/10"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">{p.nombre}</p>
                    <p className="text-[10px] text-slate-500">{p.categoria.nombre}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Stock */}
                    <div className="text-right">
                      <p className={`text-xs font-mono font-semibold ${
                        hasNoStock ? "text-red-500" : isLowStock ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {p.cantidad} u.
                      </p>
                      <p className="text-[9px] text-slate-500">Disp.</p>
                    </div>
                    {/* Precio */}
                    <div className="text-right">
                      <p className="text-xs font-bold text-indigo-400 font-mono">{formatCurrency(p.precioVenta)}</p>
                      <p className="text-[9px] text-slate-500">P. Venta</p>
                    </div>
                    {/* Botón rápido */}
                    {!hasNoStock && (
                      <button className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 hover:bg-indigo-600 hover:text-white transition">
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN DERECHA: Carrito de Compras (5/12 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-5 flex flex-col min-h-[500px]">
          {/* Header Carrito */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center space-x-2 text-indigo-400">
              <ShoppingCart size={18} />
              <h2 className="text-base font-bold text-white">Carrito de Venta</h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold rounded-lg font-mono">
              {cart.length} repuestos
            </span>
          </div>

          {/* Listado de ítems del Carrito */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-80">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-2">
                <ShoppingCart size={32} className="opacity-40" />
                <p className="text-xs">El carrito está vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                  <div className="max-w-[60%]">
                    <p className="text-xs font-semibold text-white truncate">{item.nombre}</p>
                    <p className="text-[10px] text-indigo-400 font-mono mt-0.5">{formatCurrency(item.precioVenta)} c/u</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Controles de Cantidad */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden h-7">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 text-slate-500 hover:text-white transition text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-mono font-semibold text-white">{item.cantidad}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 text-slate-500 hover:text-white transition text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                    {/* Quitar */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Info */}
          <div className="border-t border-slate-800/80 pt-4 space-y-4">
            {/* Cliente Activo */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Cliente Asignado:</span>
              <span className="font-semibold text-white">
                {selectedClient ? selectedClient.nombre : <span className="text-slate-600 italic">No seleccionado</span>}
              </span>
            </div>

            {/* Total Neto */}
            <div className="flex justify-between items-center bg-slate-950/50 p-4 border border-slate-850 rounded-2xl">
              <span className="text-sm font-semibold text-slate-400">Total a Pagar:</span>
              <span className="text-xl font-black font-mono text-emerald-400">{formatCurrency(cartTotal)}</span>
            </div>

            {/* Mensajes de Error */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl flex items-center space-x-2 animate-shake">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Facturar */}
            <button
              onClick={handleCheckout}
              disabled={isPending || cart.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-600 hover:border-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 focus:outline-none transition duration-150 flex items-center justify-center text-sm disabled:opacity-40"
            >
              {isPending ? "Procesando Cobro..." : "Confirmar Venta y Cobrar"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. TICKET DE VENTA EMITIDA (DIALOG DE EXITO) */}
      {issuedInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 border border-slate-300 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 font-mono text-xs">
            {/* Cerrar modal */}
            <button
              onClick={() => setIssuedInvoice(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
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
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-sans font-semibold rounded-lg flex items-center space-x-1.5 transition text-xs shadow-md"
                >
                  <Printer size={12} />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIssuedInvoice(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 font-sans font-semibold rounded-lg flex items-center transition text-xs"
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
