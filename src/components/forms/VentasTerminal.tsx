"use client";

import { crearClienteRapido,createVenta,toggleFavorito } from "@/actions/ventas";
import { ToolbarSelect } from "@/components/ui/toolbar-select";
import Image from "next/image";
import { formatCurrency,formatDate,formatDateShort,formatTime24 } from "@/lib/utils";
import {
AlertTriangle,
ArrowLeftRight,
ArrowRight,
Banknote,
CheckCircle,
CreditCard,
Eraser,
Eye,
Layers,
Minus,
Package,
Plus,
Printer,
Search,
ShoppingCart,
Star,
Tag,
Trash2,
TrendingUp,
UserPlus,
Users,
X
} from "lucide-react";
import React,{ useRef,useState,useTransition } from "react";

interface Product {
  id: number;
  nombre: string;
  imagen: string | null;
  precioVenta: number;
  cantidad: number;
  activo: boolean;
  marca: string | null;
  categoria: { nombre: string };
  codigo?: string | null;
}

interface Client {
  id: number;
  nombre: string;
  dni: string;
  cuit: string | null;
  telefono?: string | null;
  direccion?: string | null;
  email?: string | null;
}

interface CartItem {
  id: number;
  nombre: string;
  imagen: string | null;
  categoria: string;
  precioVenta: number;
  stockDisponible: number;
  cantidad: number;
}

interface VentasTerminalProps {
  productos: Product[];
  clientes: Client[];
  usuario?: { id: number; username: string; nombreCompleto: string } | null;
  favoritoIds: number[];
  ventasPorProducto: Record<number, number>;
}

type ProductFilter = "todos" | "favoritos" | "mas-vendidos";

type DiscountType = "PORCENTAJE" | "MONTO";
type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA_DEBITO" | "TARJETA_CREDITO";
type ComprobanteType = "FACTURA_A" | "FACTURA_B" | "FACTURA_C";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "EFECTIVO", label: "Efectivo", icon: <Banknote size={16} /> },
  { value: "TRANSFERENCIA", label: "Transferencia", icon: <ArrowLeftRight size={16} /> },
  { value: "TARJETA_DEBITO", label: "Débito", icon: <CreditCard size={16} /> },
  { value: "TARJETA_CREDITO", label: "Crédito", icon: <CreditCard size={16} /> },
];

const COMPROBANTES: { value: ComprobanteType; label: string; desc: string }[] = [
  { value: "FACTURA_A", label: "Factura A", desc: "Responsable inscripto" },
  { value: "FACTURA_B", label: "Factura B", desc: "Consumidor final" },
  { value: "FACTURA_C", label: "Factura C", desc: "Exento" },
];

export default function VentasTerminal({ productos, clientes, usuario, favoritoIds: initialFavoritoIds, ventasPorProducto }: VentasTerminalProps) {
  const [isPending, startTransition] = useTransition();
  const receiptRef = useRef<HTMLDivElement>(null);
  const issuedReceiptRef = useRef<HTMLDivElement>(null);

  // Búsquedas
  const [prodSearch, setProdSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("todos");
  const [favoritoIds, setFavoritoIds] = useState<Set<number>>(() => new Set(initialFavoritoIds));

  // Mapa de ventas para lookup rápido
  const ventasMap = ventasPorProducto;

  // Entidades Seleccionadas
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Estados de pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [discountType, setDiscountType] = useState<DiscountType>("MONTO");
  const [discountValue, setDiscountValue] = useState<string>("0");
  const [comprobanteType, setComprobanteType] = useState<ComprobanteType>("FACTURA_B");
  const [cuotas, setCuotas] = useState<number>(3);

  // Modales
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // Nuevo cliente (modal)
  const [newClientNombre, setNewClientNombre] = useState("");
  const [newClientDni, setNewClientDni] = useState("");
  const [newClientTelefono, setNewClientTelefono] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientError, setNewClientError] = useState("");
  const [newClientLoading, setNewClientLoading] = useState(false);

  // Estado de Ticket/Factura Emitida
  const [issuedInvoice, setIssuedInvoice] = useState<{
    id: number;
    cliente: string;
    dni: string;
    cuit: string | null;
    telefono: string | null;
    direccion: string | null;
    email: string | null;
    total: number;
    subtotal: number;
    descuento: number;
    descuentoTipo: string | null;
    metodoPago: string;
    tipoComprobante: string;
    cuotas: number | null;
    fecha: string;
    empleado: string;
    usuarioSistema: string;
    detalles: { nombre: string; cantidad: number; precio: number; subtotal: number; codigo: string | null }[];
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  // Obtener categorías únicas
  const categories = Array.from(new Set(productos.map(p => p.categoria.nombre))).sort((a, b) => a.localeCompare(b));
  const brands = Array.from(new Set(productos.map(p => p.marca).filter((m): m is string => Boolean(m)))).sort((a, b) => a.localeCompare(b));
  const hasCatalogFilters = prodSearch.trim().length > 0 || selectedCategory !== null || selectedBrand !== null || activeFilter !== "todos";

  const handleClearCatalogFilters = () => {
    setProdSearch("");
    setSelectedCategory(null);
    setSelectedBrand(null);
    setActiveFilter("todos");
  };

  // ─── TOGGLE FAVORITO ───
  const handleToggleFavorito = async (e: React.MouseEvent, productoId: number) => {
    e.stopPropagation(); // No activar el addToCart
    const prev = new Set(favoritoIds);
    // Optimistic update
    if (prev.has(productoId)) {
      prev.delete(productoId);
    } else {
      prev.add(productoId);
    }
    setFavoritoIds(prev);

    const res = await toggleFavorito(productoId);
    if (!res.success) {
      // Revert on error
      setFavoritoIds(favoritoIds);
    }
  };

  // ─── CÁLCULOS ───
  const cartSubtotal = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);

  let discountAmount = 0;
  const numDiscount = parseFloat(discountValue) || 0;
  if (numDiscount > 0) {
    if (discountType === "PORCENTAJE") {
      discountAmount = cartSubtotal * (Math.min(numDiscount, 100) / 100);
    } else {
      discountAmount = Math.min(numDiscount, cartSubtotal);
    }
  }
  const cartTotal = cartSubtotal - discountAmount;
  const cartItemCount = cart.reduce((sum, item) => sum + item.cantidad, 0);

  // Display del campo de descuento: vacío cuando no se tocó (se ve el placeholder atenuado, no un valor literal)
  const displayDiscount = discountValue === "0" ? "" : discountValue;

  // ─── AGREGAR AL CARRITO ───
  const addToCart = (product: Product) => {
    setErrorMsg("");
    if (!product.activo) {
      setErrorMsg("El producto está inactivo y no puede venderse.");
      return;
    }
    if (product.cantidad <= 0) {
      setErrorMsg("El producto no posee stock disponible.");
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.cantidad >= product.cantidad) {
        setErrorMsg(`No puede superar el stock disponible (${product.cantidad} u.).`);
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCart([...cart, { id: product.id, nombre: product.nombre, imagen: product.imagen, categoria: product.categoria.nombre, precioVenta: product.precioVenta, stockDisponible: product.cantidad, cantidad: 1 }]);
    }
  };

  // ─── EDITAR CANTIDAD DIRECTA ───
  const setQuantity = (id: number, rawValue: string) => {
    setErrorMsg("");
    if (rawValue === "") {
      setCart(cart.map(item => item.id === id ? { ...item, cantidad: 0 } : item));
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (isNaN(parsed)) return;
    setCart(
      cart.map(item => {
        if (item.id !== id) return item;
        if (parsed < 1) return { ...item, cantidad: 1 };
        if (parsed > item.stockDisponible) {
          setErrorMsg(`No puede superar el stock disponible (${item.stockDisponible} u.).`);
          return { ...item, cantidad: item.stockDisponible };
        }
        return { ...item, cantidad: parsed };
      })
    );
  };

  // ─── ACTUALIZAR CANTIDAD (+/-) ───
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

  // ─── CREAR CLIENTE RÁPIDO ───
  const handleCreateClient = async () => {
    setNewClientError("");
    if (!newClientNombre.trim() || !newClientDni.trim()) {
      setNewClientError("Nombre y DNI son obligatorios.");
      return;
    }
    setNewClientLoading(true);
    try {
      const res = await crearClienteRapido(newClientNombre.trim(), newClientDni.trim(), newClientTelefono.trim(), newClientEmail.trim());
      if (res.success && res.cliente) {
        setSelectedClient(res.cliente as Client);
        setShowNewClientModal(false);
        setNewClientNombre("");
        setNewClientDni("");
        setNewClientTelefono("");
        setNewClientEmail("");
      } else {
        setNewClientError(res.error || "Error al crear el cliente.");
      }
    } catch {
      setNewClientError("Error inesperado al crear el cliente.");
    } finally {
      setNewClientLoading(false);
    }
  };

  // ─── FILTRAR PRODUCTOS ───
  let filteredProducts = productos.filter(p => {
    if (!p.activo) return false; // No mostrar productos inactivos en ventas
    const matchesSearch = p.nombre.toLowerCase().includes(prodSearch.toLowerCase()) ||
      p.categoria.nombre.toLowerCase().includes(prodSearch.toLowerCase());
    const matchesCategory = !selectedCategory || p.categoria.nombre === selectedCategory;
    const matchesBrand = !selectedBrand || p.marca === selectedBrand;
    const matchesFilter =
      activeFilter === "todos" ||
      (activeFilter === "favoritos" && favoritoIds.has(p.id)) ||
      activeFilter === "mas-vendidos"; // se ordena después
    return matchesSearch && matchesCategory && matchesBrand && matchesFilter;
  });

  // Ordenar por "más vendidos" si corresponde
  if (activeFilter === "mas-vendidos") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (ventasMap[b.id] ?? 0) - (ventasMap[a.id] ?? 0)
    );
  }

  // ─── FILTRAR CLIENTES ───
  const filteredClients = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.dni.includes(clientSearch) ||
    (c.cuit && c.cuit.includes(clientSearch))
  );

  // ─── ABRIR VISTA PREVIA ───
  const handleOpenPreview = () => {
    setErrorMsg("");
    if (!selectedClient) {
      setErrorMsg("Debe seleccionar un cliente antes de facturar.");
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("El carrito de compras está vacío.");
      return;
    }
    if (cart.some(item => item.cantidad <= 0)) {
      setErrorMsg("Hay productos con cantidad inválida en el carrito.");
      return;
    }
    setShowReceiptPreview(true);
  };

  // ─── CONFIRMAR COBRO ───
  const handleConfirmPayment = async () => {
    setShowReceiptPreview(false);
    const items = cart.map(item => ({ productoId: item.id, cantidad: item.cantidad }));

    startTransition(async () => {
      const res = await createVenta(selectedClient!.id, items, paymentMethod, discountType, parseFloat(discountValue) || 0, comprobanteType, paymentMethod === "TARJETA_CREDITO" ? cuotas : null);

      if (res.success) {
        const now = new Date();
        setIssuedInvoice({
          id: res.ventaId!,
          cliente: selectedClient!.nombre,
          dni: selectedClient!.dni,
          cuit: selectedClient!.cuit ?? null,
          telefono: selectedClient!.telefono ?? null,
          direccion: selectedClient!.direccion ?? null,
          email: selectedClient!.email ?? null,
          total: res.total!,
          subtotal: cartSubtotal,
          descuento: discountAmount,
          descuentoTipo: discountType,
          metodoPago: paymentMethod,
          tipoComprobante: comprobanteType,
          cuotas: paymentMethod === "TARJETA_CREDITO" ? cuotas : null,
          fecha: formatDate(now),
          empleado: usuario?.nombreCompleto || "N/D",
          usuarioSistema: usuario?.username || "N/D",
          detalles: cart.map(item => {
            const fullProduct = productos.find(p => p.id === item.id);
            return {
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio: item.precioVenta,
              subtotal: item.precioVenta * item.cantidad,
              codigo: fullProduct?.codigo ?? null,
            };
          }),
        });
        // Limpiar
        setCart([]);
        setSelectedClient(null);
        setPaymentMethod("EFECTIVO");
        setDiscountValue("0");
        setComprobanteType("FACTURA_B");
        setCuotas(3);
        setClientSearch("");
      } else {
        setErrorMsg(res.error || "Ocurrió un error al procesar el pago.");
      }
    });
  };

  // ─── IMPRIMIR COMPROBANTE ───
  const handlePrint = () => {
    // Try issued receipt first (post-payment), then preview receipt
    const content = issuedReceiptRef.current || receiptRef.current;
    if (!content) return;

    // Remove old overlay if exists
    const old = document.getElementById("print-overlay");
    if (old) old.remove();

    // Create overlay at body level with receipt content
    const overlay = document.createElement("div");
    overlay.id = "print-overlay";
    overlay.setAttribute("style", "background:#fff;color:#000;padding:20px;margin:0;width:100%;max-width:none;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;");
    overlay.innerHTML = content.innerHTML;
    document.body.appendChild(overlay);

    // Add class to body to hide other elements during print
    document.body.classList.add("print-active");

    // Print then cleanup
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("print-active");
      }, 500);
    }, 100);
  };

  // ─── PAYMENT METHOD LABEL ───
  const getPaymentLabel = (m: string) => PAYMENT_METHODS.find(p => p.value === m)?.label || m;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch h-full">
      {/* ═══ SECCIÓN IZQUIERDA: Productos (7/12 cols) ═══ */}
      <div className="lg:col-span-7 flex flex-col gap-1 min-h-0 h-full">
        {/* 1. Panel de Selección de Clientes */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-2 space-y-1 shadow-[var(--shadow-sm)] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-[var(--brand)] min-w-0">
              <Users size={17} className="shrink-0" />
              <h2 className="shrink-0 text-base font-bold text-[var(--text)]">Selección de Cliente</h2>
            </div>
            <span className="ml-auto min-w-0 truncate text-[11px] font-semibold text-[var(--text-secondary)]">
              Haz clic sobre un cliente para agregarlo al carrito.
            </span>
            <button
              type="button"
              onClick={() => setShowNewClientModal(true)}
              className="group ml-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--brand)]/40 bg-[rgba(214,40,40,0.08)] px-3 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[var(--brand)]/60 hover:bg-[rgba(214,40,40,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 active:bg-[rgba(214,40,40,0.22)]"
            >
              <UserPlus size={15} className="shrink-0 text-[#E56B6B] group-hover:text-[#EF8B8B]" />
              <span className="whitespace-nowrap">Nuevo cliente</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] pl-9 pr-4 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] transition-colors focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          {/* Grilla Clientes */}
          <div className="max-h-32 overflow-y-auto border border-[var(--border)] rounded divide-y divide-[var(--border)]">
            {filteredClients.length === 0 && (
              <div className="px-3 py-4 text-xs text-[var(--text-secondary)] text-center">No se encontraron clientes</div>
            )}
            {filteredClients.map(c => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`flex items-center justify-between px-2.5 py-1.5 text-sm cursor-pointer transition ${
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
                  {isSelected && <span className="text-[10px] bg-[var(--brand-light)] px-1.5 py-0.5 rounded border border-[var(--brand)]/20 font-bold uppercase">Seleccionado</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Panel de Búsqueda de Repuestos */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-2 space-y-0.5 shadow-[var(--shadow-sm)] flex-1 flex flex-col min-h-0">
          {/* Encabezado, buscador y filtros del catalogo */}
          <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 xl:grid-cols-[minmax(260px,1fr)_150px_150px]">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 xl:col-start-1 xl:row-start-1">
              <div className="flex shrink-0 items-center space-x-1.5 text-[var(--brand)]">
                <ShoppingCart size={17} />
                <h2 className="text-base font-bold text-[var(--text)]">Catálogo de Venta</h2>
              </div>
              <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--text-secondary)]">
                Haz clic sobre un producto para agregarlo al carrito.
              </span>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:col-start-1 xl:row-start-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o categoría..."
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] pl-9 pr-4 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] transition-colors focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              {hasCatalogFilters && (
                <button
                  type="button"
                  onClick={handleClearCatalogFilters}
                  className="group flex h-10 min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 hover:border-[var(--brand)]/60 hover:bg-[var(--brand-light)]/10 hover:text-white focus-visible:border-[var(--brand)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--brand)]/20 active:scale-[0.98]"
                  aria-label="Limpiar filtros del catalogo"
                  title="Limpiar filtros del catalogo"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20 transition-colors duration-200 group-hover:bg-[var(--brand-light)]/80">
                      <Eraser size={14} strokeWidth={2.4} />
                    </span>
                    <span>Limpiar</span>
                  </span>
                </button>
              )}
            </div>

            <div className="[&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-[var(--text-secondary)] [&_label]:uppercase [&_label]:tracking-wider xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-end">
              <ToolbarSelect
                label="Categoría"
                value={selectedCategory ?? "all"}
                onValueChange={value => setSelectedCategory(value === "all" ? null : value)}
                triggerIcon={Layers}
                minWidth="min-w-[150px]"
                options={[
                  { value: "all", label: "Todas", icon: Layers },
                  ...categories.map(cat => ({ value: cat, label: cat, icon: Layers })),
                ]}
              />
            </div>

            <div className="[&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-[var(--text-secondary)] [&_label]:uppercase [&_label]:tracking-wider xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-end">
              <ToolbarSelect
                label="Marca"
                value={selectedBrand ?? "all"}
                onValueChange={value => setSelectedBrand(value === "all" ? null : value)}
                triggerIcon={Tag}
                minWidth="min-w-[150px]"
                tone={{
                  trigger: "border-violet-500/25 hover:border-violet-400/60 focus-visible:border-violet-400 focus-visible:ring-violet-500/20 data-[state=open]:border-violet-400/70 data-[state=open]:ring-violet-500/20",
                  icon: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
                  content: "border-violet-500/30",
                  itemFocus: "focus:bg-violet-500/10",
                  selected: "data-[state=checked]:bg-violet-500/12 data-[state=checked]:text-violet-200",
                  check: "text-violet-300",
                  chevron: "text-violet-300",
                }}
                options={[
                  { value: "all", label: "Todas", icon: Tag },
                  ...brands.map(brand => ({ value: brand, label: brand, icon: Tag })),
                ]}
              />
            </div>
          </div>

          {/* Filtros rápidos: Todos / Favoritos / Más vendidos */}
          <div className="flex gap-1 p-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)]">
            {([
              { key: "todos" as ProductFilter, label: "Todos", icon: <Package size={12} /> },
              { key: "favoritos" as ProductFilter, label: "Favoritos", icon: <Star size={12} />, count: favoritoIds.size },
              { key: "mas-vendidos" as ProductFilter, label: "Más vendidos", icon: <TrendingUp size={12} /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-semibold transition-all ${
                  activeFilter === tab.key
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--panel)]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-0.5 text-[10px] px-1 py-0 rounded-full font-bold ${
                    activeFilter === tab.key ? "bg-white/20" : "bg-[var(--border)]"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Product Grid — 2 filas visibles, scroll interno */}
          <div className={`grid grid-cols-4 gap-2 flex-1 overflow-y-auto pr-1 ${filteredProducts.length > 0 ? "content-start" : ""}`}>
            {filteredProducts.length === 0 ? (
              <div className="col-span-4 h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
                {activeFilter === "favoritos" ? (
                  <>
                    <Star size={24} className="opacity-30 mb-1.5" />
                    <p className="text-xs font-semibold">No tenés favoritos aún</p>
                    <p className="text-[10px] opacity-60">Tocá la estrella en un producto para marcarlo</p>
                  </>
                ) : activeFilter === "mas-vendidos" ? (
                  <>
                    <TrendingUp size={24} className="opacity-30 mb-1.5" />
                    <p className="text-xs font-semibold">Sin ventas registradas</p>
                    <p className="text-[10px] opacity-60">Aún no se registraron ventas en el sistema</p>
                  </>
                ) : (
                  <>
                    <Package size={24} className="opacity-30 mb-1.5" />
                    <p className="text-xs font-semibold">No se encontraron productos</p>
                    <p className="text-[10px] opacity-60">Probá con otros términos de búsqueda</p>
                  </>
                )}
              </div>
            ) : (
            filteredProducts.map(p => {
              const isLowStock = p.cantidad <= 5;
              const hasNoStock = p.cantidad <= 0;
              const isFavorito = favoritoIds.has(p.id);
              const vendidos = ventasMap[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  onClick={() => !hasNoStock && addToCart(p)}
                  className={`relative bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 cursor-pointer transition-all hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)] ${
                    hasNoStock ? "opacity-40 cursor-not-allowed" : "hover:scale-[1.02]"
                  }`}
                >
                  {/* Botón Favorito */}
                  <button
                    onClick={(e) => handleToggleFavorito(e, p.id)}
                    className={`absolute top-1.5 right-1.5 z-10 p-0.5 rounded transition-all ${
                      isFavorito
                        ? "text-yellow-400 hover:text-yellow-300"
                        : "text-[var(--text-secondary)] opacity-40 hover:opacity-100 hover:text-yellow-400"
                    }`}
                    title={isFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
                  >
                    <Star size={16} fill={isFavorito ? "currentColor" : "none"} />
                  </button>

                  <div className="relative w-full h-36 bg-[var(--panel)] rounded flex items-center justify-center mb-1.5 overflow-hidden">
                    {p.imagen ? (
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        sizes="(max-width: 1024px) 25vw, 12vw"
                        className="object-contain"
                      />
                    ) : (
                      <Package size={32} className="text-[var(--text-secondary)]" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text)] leading-tight line-clamp-2 min-h-[2rem]">{p.nombre}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] truncate">{p.categoria.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold text-[#22D3EE] font-mono">{formatCurrency(p.precioVenta)}</p>
                    <span className={`text-[10px] font-mono font-semibold ${hasNoStock ? "text-[var(--danger)]" : isLowStock ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                      {p.cantidad}u
                    </span>
                  </div>
                  {/* Badge de vendidos en filtro "Más vendidos" */}
                  {activeFilter === "mas-vendidos" && vendidos > 0 && (
                    <div className="mt-1 flex items-center gap-0.5 text-[10px] text-[var(--text-secondary)]">
                      <TrendingUp size={8} />
                      <span>{vendidos} vendidos</span>
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>

      {/* ═══ SECCIÓN DERECHA: Carrito + Pago (5/12 cols) ═══ */}
      <div className="lg:col-span-5 h-full flex flex-col min-h-0">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 space-y-1.5 flex flex-col flex-1 min-h-0 shadow-[var(--shadow-sm)]">
          {/* Header Carrito */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
            <div className="flex items-center space-x-1.5 text-[var(--brand)]">
              <ShoppingCart size={17} />
              <h2 className="text-base font-bold text-[var(--text)]">Carrito de compras</h2>
            </div>
            <span className="rounded-lg border border-[var(--brand)]/25 bg-[var(--brand-light)] px-2.5 py-1 text-sm font-bold text-[var(--brand)] font-mono shadow-[var(--shadow-sm)]">
              {cartItemCount} {cartItemCount === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          {/* Listado de ítems del Carrito — fill remaining space, scroll interno */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-6 space-y-1.5">
                <ShoppingCart size={24} className="opacity-40" />
                <p className="text-sm">El carrito está vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-[var(--bg)] border border-[var(--border)] rounded">
                  {/* Imagen */}
                  <div className="relative w-9 h-9 bg-[var(--panel)] rounded flex items-center justify-center shrink-0 overflow-hidden">
                    {item.imagen ? (
                      <Image
                        src={item.imagen}
                        alt={item.nombre}
                        fill
                        sizes="36px"
                        className="object-contain"
                      />
                    ) : (
                      <Package size={14} className="text-[var(--text-secondary)]" />
                    )}
                  </div>

                  {/* Nombre + Categoría */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text)] truncate leading-tight">{item.nombre}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate leading-tight">{item.categoria}</p>
                  </div>

                  {/* Controles de cantidad */}
                  <div className="flex items-center bg-[var(--panel)] border border-[var(--border-hover)] rounded overflow-hidden h-7 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="px-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--brand)]/20 transition text-[11px] font-bold leading-none"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.cantidad}
                      onChange={e => setQuantity(item.id, e.target.value)}
                      onBlur={e => {
                        const v = parseInt(e.target.value, 10);
                        if (isNaN(v) || v < 1) setQuantity(item.id, "1");
                      }}
                      className="w-7 text-center text-[11px] font-mono font-bold text-white bg-transparent border-x border-[var(--border-hover)] outline-none focus:bg-[var(--brand-light)] h-full"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="px-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--brand)]/20 transition text-[11px] font-bold leading-none"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <p className="text-sm font-bold font-mono text-[#22D3EE] shrink-0 whitespace-nowrap">{formatCurrency(item.precioVenta * item.cantidad)}</p>

                  {/* Eliminar */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    title="Eliminar producto"
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition rounded-md shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ═══ BOTÓN LIMPIAR CARRITO ═══ */}
          <button
            onClick={() => {
              setCart([]);
              setSelectedClient(null);
              setErrorMsg("");
              setPaymentMethod("EFECTIVO");
              setDiscountValue("0");
            }}
            disabled={cart.length === 0 && !selectedClient}
            className="w-full py-2 flex items-center justify-center gap-1.5 bg-transparent border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10 font-semibold rounded-[var(--radius-md)] transition text-[11px] disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
          >
            <Trash2 size={13} />
            <span>Limpiar carrito</span>
          </button>

          {/* ═══ SECCIÓN DE PAGO ═══ */}
          <div className="border-t border-[var(--border)] pt-2 space-y-2 shrink-0">
            {/* Cliente */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-sm items-center">
              <span className="text-slate-200 font-semibold">Cliente:</span>
              <span className="font-semibold text-[var(--text)] text-right min-w-0">
                {selectedClient ? (
                  <span className="inline-flex items-center justify-end gap-1 min-w-0">
                    <span className="truncate">{selectedClient.nombre}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      title="Quitar cliente de la venta"
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition rounded-md shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">No seleccionado</span>
                )}
              </span>
            </div>

            {/* Forma de Pago */}
            <div>
              <label className="block text-xs text-slate-200 font-semibold mb-0.5">Forma de pago</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded text-sm font-semibold transition-all border ${
                      paymentMethod === pm.value
                        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                        : "bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    {pm.icon}
                    <span>{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Factura */}
            <div>
              <label className="block text-xs text-slate-200 font-semibold mb-0.5">Tipo de factura</label>
              <div className="flex gap-1.5">
                {COMPROBANTES.map(comp => (
                  <button
                    key={comp.value}
                    onClick={() => setComprobanteType(comp.value)}
                    className={`flex-1 py-1.5 px-2 rounded text-sm font-semibold transition-all border text-center ${
                      comprobanteType === comp.value
                        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                        : "bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    {comp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ DESCUENTO + SUBTOTAL/TOTAL (2 columnas) ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 items-center">
              {/* Columna izquierda: Descuento */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs text-slate-200 font-semibold">Descuento</label>
                  <span className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">Clic para elegir monto o porcentaje</span>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDiscountType(discountType === "MONTO" ? "PORCENTAJE" : "MONTO")}
                    aria-label="Cambiar tipo de descuento"
                    className="absolute left-0 top-0 h-full w-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand)] transition text-sm font-bold border-r border-[var(--border-hover)] cursor-pointer"
                  >
                    {discountType === "PORCENTAJE" ? "%" : "$"}
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displayDiscount}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.]/g, "");
                      setDiscountValue(val);
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={() => {
                      if (discountValue.trim() === "") setDiscountValue("0");
                    }}
                    placeholder={discountType === "PORCENTAJE" ? "ej: 10" : "0,00"}
                    className="w-full pl-9 pr-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border-hover)] rounded text-sm text-white font-mono font-semibold text-right placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
                {discountAmount > 0 && (
                  <p className="mt-0.5 text-[10px] font-mono text-[var(--danger)]">
                    Desc.: -{formatCurrency(discountAmount)}
                  </p>
                )}
              </div>

              {/* Columna derecha: Subtotal + Total */}
              <div className="space-y-1 sm:pl-2">
                <div className="flex justify-between items-center text-[13px] leading-tight">
                  <span className="text-[#7C8AA5]">Subtotal:</span>
                  <span className="font-mono font-semibold text-[#CBD5E1]">{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-[var(--border)]">
                  <span className="text-sm font-bold text-[var(--text)]">Total:</span>
                  <span className="text-lg font-black font-mono text-[var(--success)]">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="p-2 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded flex items-center space-x-1.5">
                <AlertTriangle size={12} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Cobrar */}
            <button
              onClick={handleOpenPreview}
              disabled={isPending || cart.length === 0}
              className="w-full py-3 bg-gradient-to-r from-[var(--danger)] to-[var(--brand)] hover:from-[var(--brand)] hover:to-[var(--danger)] text-white font-bold rounded shadow-lg shadow-[var(--danger)]/20 focus:outline-none transition duration-150 flex items-center justify-center text-base disabled:opacity-40 hover:shadow-xl hover:shadow-[var(--danger)]/30"
            >
              {isPending ? "Procesando..." : (
                <>
                  <span>Cobrar</span>
                  <ArrowRight size={16} className="ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MODAL: NUEVO CLIENTE ═══ */}
      {showNewClientModal && (
        <div
          onClick={() => setShowNewClientModal(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card)] border border-[var(--border)] w-full max-w-sm rounded-[var(--radius-xl)] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200"
          >
            <button
              onClick={() => setShowNewClientModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-2 text-[var(--brand)] mb-5">
              <UserPlus size={18} />
              <h3 className="text-base font-bold text-[var(--text)]">Nuevo Cliente Rápido</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Nombre y Apellido *</label>
                <input
                  type="text"
                  value={newClientNombre}
                  onChange={e => setNewClientNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">DNI *</label>
                <input
                  type="text"
                  value={newClientDni}
                  onChange={e => setNewClientDni(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej: 40123456"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Teléfono</label>
                <input
                  type="text"
                  value={newClientTelefono}
                  onChange={e => setNewClientTelefono(e.target.value)}
                  placeholder="Ej: 3764-123456"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Correo (opcional)</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={e => setNewClientEmail(e.target.value)}
                  placeholder="Ej: juan@email.com"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>

            {newClientError && (
              <div className="mt-3 p-2.5 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)]">
                {newClientError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] font-semibold rounded-[var(--radius-md)] transition text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                disabled={newClientLoading}
                className="flex-1 py-2.5 bg-[var(--brand)] text-white font-semibold rounded-[var(--radius-md)] transition text-sm hover:opacity-90 disabled:opacity-50"
              >
                {newClientLoading ? "Guardando..." : "Guardar y Seleccionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: VISTA PREVIA DEL COMPROBANTE ═══ */}
      {showReceiptPreview && (
        <div
          onClick={() => setShowReceiptPreview(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card)] border border-[var(--border)] w-full max-w-2xl rounded-[var(--radius-xl)] shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center space-x-2 text-[var(--brand)]">
                <Eye size={18} />
                <h3 className="text-base font-bold text-[var(--text)]">Vista Previa del Comprobante</h3>
              </div>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Receipt Content — styled like A4 invoice */}
            <div className="flex-1 overflow-y-auto p-6">
              <div ref={receiptRef} className="bg-white text-gray-900 p-8 rounded font-sans text-xs" style={{ maxWidth: "750px", margin: "0 auto" }}>

                {/* ── HEADER ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #D62828", paddingBottom: "16px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Logo dentro del comprobante imprimible: se evita el wrapper de next/image para clonar/imprimir HTML estable. */}
                      <img src="/logo.png" alt="Logo de Chopper Repuestos" style={{ height: "48px", width: "auto" }} />
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px" }}>Chopper Repuestos</span>
                    </div>
                    <div style={{ fontSize: "9px", color: "#555", lineHeight: 1.5 }}>
                      Av. Roque Saenz Peña 1500<br />
                      Posadas, Misiones<br />
                      Tel: (0376) 444-5555<br />
                      Email: info@chopperrepuestos.com.ar<br />
                      CUIT: 37-32340054-6<br />
                      Condición IVA: Responsable Inscripto
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "180px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#D62828", border: "2px solid #D62828", padding: "6px 14px", display: "inline-block", marginBottom: "6px" }}>
                      {COMPROBANTES.find(c => c.value === comprobanteType)?.label}
                    </div>
                    <div style={{ fontSize: "9px", color: "#555", lineHeight: 1.6, textAlign: "right" }}>
                      <div>Nº: <strong>0001-00000001</strong></div>
                      <div>Fecha: <strong>{formatDateShort(new Date())}</strong></div>
                      <div>Hora: <strong>{formatTime24(new Date())}</strong></div>
                    </div>
                  </div>
                </div>

                {/* ── CLIENT + EMPLOYEE ── */}
                <div style={{ display: "flex", gap: "24px", marginBottom: "14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>Datos del Cliente</div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777", fontWeight: 600 }}>Nombre:</span>
                      <span style={{ color: "#1a1a1a" }}>{selectedClient?.nombre}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777", fontWeight: 600 }}>DNI/CUIT:</span>
                      <span style={{ color: "#1a1a1a" }}>{selectedClient?.dni}{selectedClient?.cuit ? ` / ${selectedClient.cuit}` : ""}</span>
                    </div>
                    {selectedClient?.telefono && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                        <span style={{ color: "#777", fontWeight: 600 }}>Teléfono:</span>
                        <span style={{ color: "#1a1a1a" }}>{selectedClient.telefono}</span>
                      </div>
                    )}
                    {selectedClient?.email && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                        <span style={{ color: "#777", fontWeight: 600 }}>Email:</span>
                        <span style={{ color: "#1a1a1a" }}>{selectedClient.email}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>Empleado</div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777", fontWeight: 600 }}>Vendedor:</span>
                      <span style={{ color: "#1a1a1a" }}>{usuario?.nombreCompleto || "N/D"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777", fontWeight: 600 }}>Usuario:</span>
                      <span style={{ color: "#1a1a1a" }}>{usuario?.username || "N/D"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777", fontWeight: 600 }}>Emisión:</span>
                      <span style={{ color: "#1a1a1a" }}>{formatDate(new Date())}</span>
                    </div>
                  </div>
                </div>

                {/* ── PRODUCTS TABLE ── */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "left", width: "10%" }}>Código</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "left", width: "38%" }}>Producto</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "center", width: "10%" }}>Cant.</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "14%" }}>P. Unit.</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "12%" }}>Descuento</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "16%" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #eee", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "5px 8px", fontSize: "9px", color: "#999" }}>-</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px" }}>{item.nombre}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "center" }}>{item.cantidad}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{formatCurrency(item.precioVenta)}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>-</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{formatCurrency(item.precioVenta * item.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ── SUMMARY ── */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
                  <div style={{ width: "280px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9px" }}>
                      <span style={{ color: "#777" }}>Subtotal:</span>
                      <span style={{ fontFamily: "Consolas, monospace" }}>{formatCurrency(cartSubtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9px" }}>
                        <span style={{ color: "#777" }}>Descuento ({discountType === "PORCENTAJE" ? `${Math.min(numDiscount, 100)}%` : "fijo"}):</span>
                        <span style={{ fontFamily: "Consolas, monospace", color: "#D62828", fontWeight: 600 }}>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: "2px solid #D62828", marginTop: "4px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 800 }}>
                      <span>TOTAL:</span>
                      <span style={{ color: "#D62828", fontFamily: "Consolas, monospace" }}>{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* ── PAYMENT ── */}
                <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "4px", padding: "8px 12px", marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", padding: "2px 0" }}>
                    <span style={{ color: "#777" }}>Forma de Pago:</span>
                    <span style={{ fontWeight: 700 }}>{getPaymentLabel(paymentMethod)}</span>
                  </div>
                </div>

                {/* ── OBSERVATIONS ── */}
                <div style={{ border: "1px dashed #ccc", borderRadius: "4px", padding: "8px 12px", minHeight: "36px", marginBottom: "14px", fontSize: "9px", color: "#999" }}>
                  Observaciones: _______________
                </div>

                {/* ── FOOTER ── */}
                <div style={{ textAlign: "center", borderTop: "2px solid #D62828", paddingTop: "12px", marginTop: "16px" }}>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="flex-1 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] font-semibold rounded-[var(--radius-md)] transition text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isPending}
                className="flex-1 py-2.5 bg-[var(--success)] text-white font-semibold rounded-[var(--radius-md)] transition text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <CheckCircle size={14} />
                <span>{isPending ? "Procesando..." : "Confirmar Cobro"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: COMPROBANTE EMITIDO ═══ */}
      {issuedInvoice && (
        <div
          onClick={() => setIssuedInvoice(null)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card)] border border-[var(--border)] w-full max-w-2xl rounded-[var(--radius-xl)] shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center space-x-2 text-[var(--success)]">
                <CheckCircle size={18} />
                <h3 className="text-base font-bold text-[var(--text)]">Comprobante Emitido</h3>
              </div>
              <button
                onClick={() => setIssuedInvoice(null)}
                className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Receipt Content — mirrors preview but with issued data */}
            <div className="flex-1 overflow-y-auto p-6">
              <div ref={issuedReceiptRef} className="bg-white text-gray-900 p-8 rounded font-sans text-xs" style={{ maxWidth: "750px", margin: "0 auto" }}>

                {/* ── HEADER ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #D62828", paddingBottom: "16px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Logo dentro del comprobante emitido imprimible: se evita el wrapper de next/image para clonar/imprimir HTML estable. */}
                      <img src="/logo.png" alt="Logo de Chopper Repuestos" style={{ height: "48px", width: "auto" }} />
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px" }}>Chopper Repuestos</span>
                    </div>
                    <div style={{ fontSize: "9px", color: "#555", lineHeight: 1.5 }}>
                      Av. Roque Saenz Peña 1500<br />
                      Posadas, Misiones<br />
                      Tel: (0376) 444-5555<br />
                      Email: info@chopperrepuestos.com.ar<br />
                      CUIT: 37-32340054-6<br />
                      Condición IVA: Responsable Inscripto
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "180px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#D62828", border: "2px solid #D62828", padding: "6px 14px", display: "inline-block", marginBottom: "6px" }}>
                      {COMPROBANTES.find(c => c.value === issuedInvoice.tipoComprobante)?.label}
                    </div>
                    <div style={{ fontSize: "9px", color: "#555", lineHeight: 1.6, textAlign: "right" }}>
                      <div>Nº: <strong>#{issuedInvoice.id.toString().padStart(6, "0")}</strong></div>
                      <div>Fecha: <strong>{issuedInvoice.fecha}</strong></div>
                    </div>
                  </div>
                </div>

                {/* ── CLIENT + EMPLOYEE ── */}
                <div style={{ display: "flex", gap: "24px", marginBottom: "14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>Datos del Cliente</div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Nombre:</span>
                      <span style={{ color: "#1a1a1a" }}>{issuedInvoice.cliente}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#1a1a1a", fontWeight: 600 }}>DNI/CUIT:</span>
                      <span style={{ color: "#1a1a1a" }}>{issuedInvoice.dni}{issuedInvoice.cuit ? ` / ${issuedInvoice.cuit}` : ""}</span>
                    </div>
                    {issuedInvoice.telefono && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                        <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Teléfono:</span>
                        <span style={{ color: "#1a1a1a" }}>{issuedInvoice.telefono}</span>
                      </div>
                    )}
                    {issuedInvoice.email && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                        <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Email:</span>
                        <span style={{ color: "#1a1a1a" }}>{issuedInvoice.email}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#D62828", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>Empleado</div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Vendedor:</span>
                      <span style={{ color: "#1a1a1a" }}>{issuedInvoice.empleado}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "9px" }}>
                      <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Usuario:</span>
                      <span style={{ color: "#1a1a1a" }}>{issuedInvoice.usuarioSistema}</span>
                    </div>
                  </div>
                </div>

                {/* ── PRODUCTS TABLE ── */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "left", width: "10%" }}>Código</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "left", width: "38%" }}>Producto</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "center", width: "10%" }}>Cant.</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "14%" }}>P. Unit.</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "12%" }}>Descuento</th>
                      <th style={{ background: "#D62828", color: "#fff", fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 8px", textAlign: "right", width: "16%" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedInvoice.detalles.map((det, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "5px 8px", fontSize: "9px", color: "#1a1a1a" }}>{det.codigo || "-"}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px" }}>{det.nombre}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "center" }}>{det.cantidad}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{formatCurrency(det.precio)}</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>-</td>
                        <td style={{ padding: "5px 8px", fontSize: "9px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{formatCurrency(det.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ── SUMMARY ── */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
                  <div style={{ width: "280px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9px" }}>
                      <span style={{ color: "#1a1a1a" }}>Subtotal:</span>
                      <span style={{ fontFamily: "Consolas, monospace" }}>{formatCurrency(issuedInvoice.subtotal)}</span>
                    </div>
                    {issuedInvoice.descuento > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9px" }}>
                        <span style={{ color: "#1a1a1a" }}>Descuento:</span>
                        <span style={{ fontFamily: "Consolas, monospace", color: "#D62828", fontWeight: 600 }}>-{formatCurrency(issuedInvoice.descuento)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: "2px solid #D62828", marginTop: "4px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 800 }}>
                      <span>TOTAL:</span>
                      <span style={{ color: "#D62828", fontFamily: "Consolas, monospace" }}>{formatCurrency(issuedInvoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* ── PAYMENT ── */}
                <div style={{ border: "1px solid #ddd", borderRadius: "4px", padding: "8px 12px", marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", padding: "2px 0" }}>
                    <span style={{ color: "#1a1a1a", fontWeight: 600 }}>Forma de Pago:</span>
                    <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{getPaymentLabel(issuedInvoice.metodoPago)}</span>
                  </div>
                </div>

                {/* ── OBSERVATIONS ── */}
                <div style={{ border: "1px dashed #ccc", borderRadius: "4px", padding: "8px 12px", minHeight: "36px", marginBottom: "14px", fontSize: "9px", color: "#1a1a1a" }}>
                  Observaciones: _______________
                </div>

                {/* ── FOOTER ── */}
                <div style={{ textAlign: "center", borderTop: "2px solid #D62828", paddingTop: "12px", marginTop: "16px" }}>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 bg-[var(--brand)] text-white font-semibold rounded-[var(--radius-md)] transition text-sm hover:opacity-90 flex items-center justify-center space-x-1.5"
              >
                <Printer size={14} />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setIssuedInvoice(null)}
                className="flex-1 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] font-semibold rounded-[var(--radius-md)] transition text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
