"use client";

import {
  abrirCaja,
  aprobarSolicitudCaja,
  cerrarCaja,
  rechazarSolicitudCaja,
  registrarAjusteBanco,
  registrarAjusteEfectivo,
  registrarGastoCaja
} from "@/actions/caja";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AjustarBancoModal, { type AjusteBancoPayload } from "@/components/ui/AjustarBancoModal";
import AjustarEfectivoModal, { type AjusteEfectivoPayload } from "@/components/ui/AjustarEfectivoModal";
import ConfirmarCierreModal from "@/components/ui/ConfirmarCierreModal";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MovimientoDetalleModal from "@/components/ui/MovimientoDetalleModal";
import { TableShell } from "@/components/ui/table-shell";
import { ToolbarSelect, type ToolbarSelectTone } from "@/components/ui/toolbar-select";
import {
calcularTotales,
enrichMovimientos,
filtrarMovimientos,
getConcepto,
getTipoVisual,
getUsuariosUnicos,
type MovimientoCompra,
type MovimientoEnriched,
type MovimientoInput,
type MovimientoVenta
} from "@/lib/caja-filters";
import { enviarCierreCaja, type CierreCajaPayload } from "@/lib/caja-closing";
import {
  calcularFlujosImpresion,
  construirDescripcionImpresion,
  crearFilaImpresionLibroDiario,
  crearModeloImpresionLibroDiario,
  type MovimientoFinancieroImpresion,
} from "@/lib/caja-print";
import { cn, formatCurrency, formatDate, formatDateShort, formatTime24 } from "@/lib/utils";
import { formatMovimientoDescripcion,formatReposicionFila,formatTipoComprobante } from "@/lib/movimiento-format";
import { isSameDay } from "date-fns";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  FolderOpen,
  Landmark,
  ListFilter,
  Lock,
  MinusCircle,
  PackagePlus,
  PlusCircle,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  Tags,
  Unlock,
  User,
  UserRound,
  Waves,
  X,
  XCircle
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState, useTransition } from "react";

function labelMetodoPago(metodo: string): string {
  const labels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    EFECTIVO_CAJA: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    TRANSFERENCIA_BANCARIA: "Transferencia",
    TARJETA_DEBITO: "Débito",
    TARJETA_CREDITO: "Crédito",
    CUENTA_CORRIENTE_PROVEEDOR: "Cta. Cte.",
    FONDOS_EXTERNOS: "Fondos externos",
    MERCADOPAGO: "Mercado Pago",
    MERCADO_PAGO: "Mercado Pago",
    OTROS: "Otros",
  };
  return labels[metodo] ?? metodo;
}

function renderPagoBadge(medio: string) {
  if (medio === "—") {
    return <span className="text-[var(--text-secondary)] opacity-50">{"\u2014"}</span>;
  }

  let style = "";
  switch (medio) {
    case "Efectivo":
      style = "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20";
      break;
    case "Transferencia":
    case "Débito":
    case "Crédito":
    case "Mercado Pago":
      style = "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20";
      break;
    case "Mixto":
      style = "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20";
      break;
    case "Cta. Cte.":
      style = "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20";
      break;
    case "Fondos externos":
      style = "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20";
      break;
    default:
      style = "bg-card text-text-muted border-border";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${style} whitespace-nowrap`}>
      {medio}
    </span>
  );
}

function getVentaDescripcionClean(mov: MovimientoInput): string {
  if (mov.venta) {
    const tipo = mov.venta.tipoComprobante ? formatTipoComprobante(mov.venta.tipoComprobante) : "Comprobante";
    return `${tipo} N° ${mov.venta.id}`;
  }
  return formatMovimientoDescripcion(mov.descripcion ?? "");
}

const cajaSelectBase = {
  trigger: "border-[#2B303B] hover:border-[#3A414F] hover:bg-[#17191F]",
  content: "border-[#2B303B]",
  itemFocus: "focus:bg-[#1E2129] focus:text-white",
  selected: "data-[state=checked]:bg-[rgba(214,40,40,0.10)] data-[state=checked]:text-white",
  check: "text-white",
  chevron: "text-[#7890B2]",
};

const cajaSelectToneNaturaleza: ToolbarSelectTone = {
  ...cajaSelectBase,
  trigger: `${cajaSelectBase.trigger} focus-visible:border-[#D62828] focus-visible:ring-[rgba(214,40,40,0.15)] data-[state=open]:border-[#D62828] data-[state=open]:ring-[rgba(214,40,40,0.15)]`,
  icon: "bg-[rgba(214,40,40,0.12)] text-[#EF4444] ring-white/5",
};

const cajaSelectToneConcepto: ToolbarSelectTone = {
  ...cajaSelectBase,
  trigger: `${cajaSelectBase.trigger} focus-visible:border-[#3B82F6] focus-visible:ring-[rgba(59,130,246,0.12)] data-[state=open]:border-[#3B82F6] data-[state=open]:ring-[rgba(59,130,246,0.12)]`,
  icon: "bg-[rgba(59,130,246,0.12)] text-[#3B82F6] ring-white/5",
};

const cajaSelectToneUsuario: ToolbarSelectTone = {
  ...cajaSelectBase,
  trigger: `${cajaSelectBase.trigger} focus-visible:border-[#8B5CF6] focus-visible:ring-[rgba(139,92,246,0.12)] data-[state=open]:border-[#8B5CF6] data-[state=open]:ring-[rgba(139,92,246,0.12)]`,
  icon: "bg-[rgba(139,92,246,0.12)] text-[#8B5CF6] ring-white/5",
};

const cajaSelectClassName = {
  trigger: "h-[36px] rounded-[10px]",
  icon: "h-[26px] w-[26px] rounded-full",
  label: "mb-0.5 text-[#8EA4C7] tracking-[0.06em] font-semibold",
  content: "rounded-[10px] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
  item: "rounded-[10px] text-[#CBD5E1]",
};

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date;
  usuario: { username: string; nombreCompleto?: string };
  ventaId?: number | null;
  venta?: MovimientoVenta | null;
  compraId?: number | null;
  compra?: MovimientoCompra | null;
}

interface VentaNoEfectiva {
  id: number;
  total: number;
  fecha: Date | string;
  metodoPago?: string | null;
  descuentoTipo?: string | null;
  montoDescuento?: number;
  tipoComprobante?: string | null;
  usuario?: { id?: number; username: string; nombreCompleto?: string } | null;
  cliente?: { id: number; nombre: string; dni?: string | null; cuit?: string | null } | null;
  detalles?: { id: number; cantidad: number; precioUnitario: number; subtotal: number; producto: { id: number; nombre: string; marca?: string | null; categoria?: { id: number; nombre: string } | null } }[];
}

interface CajaActiva {
  id: number;
  montoInicial: number;
  totalVentas: number;
  fechaApertura: Date;
  fechaCierre: Date | null;
  estado: string;
  usuario: { username: string; nombreCompleto?: string };
  gastosManuales: number;
  totalContado: number | null;
  movimientos: Movimiento[];
  ventasNoEfectivas?: VentaNoEfectiva[];
}

interface CajaHistorial {
  id: number;
  montoInicial: number;
  totalVentas: number;
  fechaApertura: Date;
  fechaCierre: Date | null;
  estado: string;
  usuario: { username: string; nombreCompleto?: string };
}

interface CajaTerminalProps {
  cajaActiva: CajaActiva | null;
  historialCajas: CajaHistorial[];
  userRole: string;
  user?: {
    id: number;
    username: string;
    nombreCompleto: string;
    fotoUrl?: string | null;
    rol?: { id: number; nombre: string };
  };
  saldosFinancieros?: {
    efectivoFisico: number;
    banco: number;
    porAcreditar: number;
    totalDisponible: number;
  };
  resumenBancoPeriodo?: {
    inicial: number;
    ingresos: number;
    egresos: number;
    saldo: number;
  };
  movimientosBanco?: MovimientoFinancieroImpresion[];
  cajaPendiente?: {
    id: number;
    montoInicial: number;
    montoInicialBanco: number;
    fechaApertura: Date;
    estado: string;
    usuario: { username: string; nombreCompleto?: string };
  } | null;
  solicitudesPendientes?: Array<{
    id: number;
    tipo: string;
    estado: string;
    monto?: number | null;
    motivo?: string | null;
    fechaSolicitud: Date;
    datosExtra?: unknown;
    solicitante: { id: number; username: string; nombreCompleto: string };
  }>;
  solicitudesUsuario?: Array<{
    id: number;
    tipo: string;
    estado: string;
    monto?: number | null;
    motivoRechazo?: string | null;
    fechaSolicitud: Date;
    fechaResolucion?: Date | null;
  }>;
}

export default function CajaTerminal({
  cajaActiva,
  historialCajas,
  userRole,
  user,
  saldosFinancieros,
  resumenBancoPeriodo,
  movimientosBanco = [],
  cajaPendiente = null,
  solicitudesPendientes = [],
  solicitudesUsuario = [],
}: CajaTerminalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [montoApertura, setMontoApertura] = useState("");
  const [montoAperturaBanco, setMontoAperturaBanco] = useState("");
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [gastoMetodoPago, setGastoMetodoPago] = useState<"EFECTIVO" | "BANCO">("EFECTIVO");
  const [aperturaCompletada, setAperturaCompletada] = useState(false);

  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showAjustarBancoModal, setShowAjustarBancoModal] = useState(false);
  const [showAjustarEfectivoModal, setShowAjustarEfectivoModal] = useState(false);
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [ajusteBancoErrorMsg, setAjusteBancoErrorMsg] = useState("");
  const [ajusteEfectivoErrorMsg, setAjusteEfectivoErrorMsg] = useState("");
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<MovimientoEnriched | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [cierreErrorMsg, setCierreErrorMsg] = useState("");

  const [filtroNaturaleza, setFiltroNaturaleza] = useState("");
  const [filtroConcepto, setFiltroConcepto] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  const searchParams = useSearchParams();
  const ventaIdParam = searchParams?.get("ventaId");
  const movIdParam = searchParams?.get("movimientoId");
  const [highlightedVentaId, setHighlightedVentaId] = useState<number | null>(null);
  const [highlightedMovId, setHighlightedMovId] = useState<number | null>(null);

  useEffect(() => {
    if (ventaIdParam) {
      const vId = Number(ventaIdParam);
      if (!Number.isNaN(vId)) {
        startTransition(() => {
          setHighlightedVentaId(vId);
          setFiltroNaturaleza("");
          setFiltroConcepto("");
          setFiltroUsuario("");
          setFiltroBusqueda("");
        });
      }
    } else if (movIdParam) {
      const mId = Number(movIdParam);
      if (!Number.isNaN(mId)) {
        startTransition(() => {
          setHighlightedMovId(mId);
          setFiltroNaturaleza("");
          setFiltroConcepto("");
          setFiltroUsuario("");
          setFiltroBusqueda("");
        });
      }
    }
  }, [ventaIdParam, movIdParam]);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!cajaActiva) return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [cajaActiva]);

  // Auto-fill bank balance from last closed caja's montoInicialBanco
  useEffect(() => {
    if (!cajaActiva && !aperturaCompletada) {
      const lastClosed = historialCajas.find((c) => c.estado === "CERRADA" && "montoInicialBanco" in c);
      if (lastClosed && "montoInicialBanco" in lastClosed) {
        const montoBanco = (lastClosed as { montoInicialBanco?: number }).montoInicialBanco;
        if (montoBanco != null && montoBanco >= 0) {
          startTransition(() => {
            setMontoAperturaBanco(String(montoBanco));
          });
        }
      }
    }
  }, [cajaActiva, aperturaCompletada, historialCajas]);

  const dayChanged = useMemo(() => {
    if (!cajaActiva) return false;
    return !isSameDay(new Date(cajaActiva.fechaApertura), now);
  }, [cajaActiva, now]);

  const fechaApertura = cajaActiva ? new Date(cajaActiva.fechaApertura) : null;
  const duracionMins = fechaApertura ? Math.max(0, Math.floor((now.getTime() - fechaApertura.getTime()) / 60000)) : 0;
  const duracionHoras = Math.floor(duracionMins / 60);
  const duracionMinutos = duracionMins % 60;
  const duracionDias = Math.floor(duracionHoras / 24);
  const duracionStr = duracionDias > 0
    ? `${duracionDias} día${duracionDias > 1 ? "s" : ""}`
    : `${String(duracionHoras).padStart(2, "0")}h ${String(duracionMinutos).padStart(2, "0")}m`;
  const aperturaDesdeStr = fechaApertura
    ? `Abierta desde el ${formatDateShort(fechaApertura)} a las ${formatTime24(fechaApertura)}`
    : "";

  const handleAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setAperturaCompletada(false);
    const monto = Number(montoApertura);
    const montoBanco = Number(montoAperturaBanco);
    if (isNaN(monto) || monto < 0) {
      setErrorMsg("Ingrese un monto inicial de efectivo válido.");
      return;
    }
    if (isNaN(montoBanco) || montoBanco < 0) {
      setErrorMsg("Ingrese un saldo bancario válido.");
      return;
    }
    startTransition(async () => {
      const res = await abrirCaja(monto, montoBanco);
      if (res.success) {
        setMontoApertura("");
        setMontoAperturaBanco("");
        if (res.needsApproval) {
          setErrorMsg("");
          setAperturaCompletada(false);
        } else {
          setAperturaCompletada(true);
        }
        router.refresh();
      } else {
        setAperturaCompletada(false);
        setErrorMsg(res.error || "Ocurrió un error al abrir la caja.");
      }
    });
  };

  const handleCerrar = () => {
    if (!cajaActiva) return;
    setCierreErrorMsg("");
    setShowCerrarModal(true);
  };

  const handleAjusteBanco = (payload: AjusteBancoPayload) => {
    setAjusteBancoErrorMsg("");
    startTransition(async () => {
      const res = await registrarAjusteBanco(payload);
      if (res.success) {
        setShowAjustarBancoModal(false);
        toast.success(
          userRole === "ADMINISTRADOR"
            ? "Ajuste de Banco registrado correctamente."
            : "Solicitud de ajuste de Banco enviada al administrador."
        );
        router.refresh();
        return;
      }
      setAjusteBancoErrorMsg(res.error || "Error al registrar el ajuste del Banco.");
    });
  };

  const handleAjusteEfectivo = (payload: AjusteEfectivoPayload) => {
    setAjusteEfectivoErrorMsg("");
    startTransition(async () => {
      const res = await registrarAjusteEfectivo(payload);
      if (res.success) {
        setShowAjustarEfectivoModal(false);
        toast.success(
          userRole === "ADMINISTRADOR"
            ? "Ajuste de Efectivo registrado correctamente."
            : "Solicitud de ajuste de Efectivo enviada al administrador."
        );
        router.refresh();
        return;
      }
      setAjusteEfectivoErrorMsg(res.error || "Error al registrar el ajuste de Efectivo.");
    });
  };

  const handleAprobarApertura = async (cajaId: number) => {
    startTransition(async () => {
      const res = await aprobarSolicitudCaja(cajaId);
      if (res.error) {
        setErrorMsg(res.error);
      }
      router.refresh();
    });
  };

  const handleRechazarApertura = async (cajaId: number) => {
    startTransition(async () => {
      const res = await rechazarSolicitudCaja(cajaId);
      if (res.error) {
        setErrorMsg(res.error);
      }
      router.refresh();
    });
  };

  const confirmarCierre = (payload: CierreCajaPayload) => {
    if (!cajaActiva) return;
    setCierreErrorMsg("");
    startTransition(async () => {
      const res = await enviarCierreCaja(cerrarCaja, cajaActiva.id, payload);
      if (res.success) {
        setAperturaCompletada(false);
        setShowCerrarModal(false);
        router.refresh();
      } else {
        setCierreErrorMsg(res.error || "Error al cerrar la caja.");
      }
    });
  };

  const cerrarModalCierre = () => {
    if (isPending) return;
    setShowCerrarModal(false);
    setCierreErrorMsg("");
  };

  const handleGasto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarGastoCaja(formData);
      if (res.success) {
        setGastoDesc("");
        setGastoMonto("");
        setShowGastoModal(false);
        toast.success(
          userRole === "ADMINISTRADOR"
            ? "Gasto registrado correctamente."
            : "Solicitud de egreso enviada al administrador."
        );
        router.refresh();
      } else {
        setErrorMsg(res.error || "Error al registrar el gasto.");
      }
    });
  };

  const cerrarModalGasto = () => {
    if (isPending) return;
    setShowGastoModal(false);
    setErrorMsg("");
    setGastoDesc("");
    setGastoMonto("");
    setGastoMetodoPago("EFECTIVO");
  };

  // Proyectar ventas no efectivas como MovimientoInput para mezclar en el Libro Diario
  const movimientosCombinados = useMemo(() => {
    const fisicos: MovimientoInput[] = (cajaActiva?.movimientos ?? []).map((m) => ({
      ...m,
      venta: m.venta ?? null,
      impactaCaja: true,
      esNoEfectivo: false,
    }));

    const proyectados: MovimientoInput[] = (cajaActiva?.ventasNoEfectivas ?? []).map((v) => ({
      // IDs negativos evitan colisiones con MovimientoCaja.id reales
      id: -(v.id + 100_000),
      tipo: "INGRESO" as const,
      monto: v.total,
      descripcion: `Venta #${v.id} · ${labelMetodoPago(v.metodoPago ?? "")} — Total ${formatCurrency(v.total)}`,
      fecha: v.fecha,
      usuario: v.usuario ? { username: v.usuario.username, nombreCompleto: v.usuario.nombreCompleto } : { username: "unknown" },
      ventaId: v.id,
      venta: {
        id: v.id,
        total: v.total,
        fecha: v.fecha,
        metodoPago: v.metodoPago ?? null,
        descuentoTipo: v.descuentoTipo ?? null,
        montoDescuento: v.montoDescuento ?? null,
        tipoComprobante: v.tipoComprobante ?? null,
        cliente: v.cliente ?? null,
        usuario: v.usuario ?? null,
        detalles: v.detalles ?? [],
      },
      compraId: null,
      compra: null,
      esNoEfectivo: true,
      impactaCaja: false,
    }));

    return [...fisicos, ...proyectados];
  }, [cajaActiva]);

  const movimientosConSaldo = useMemo(
    () => enrichMovimientos(movimientosCombinados),
    [movimientosCombinados]
  );

  const movimientosFiltrados = useMemo(
    () =>
      filtrarMovimientos(movimientosConSaldo, {
        naturaleza: filtroNaturaleza,
        concepto: filtroConcepto,
        usuario: filtroUsuario,
        busqueda: filtroBusqueda,
      }),
    [movimientosConSaldo, filtroNaturaleza, filtroConcepto, filtroUsuario, filtroBusqueda]
  );

  const movimientosLibroDiario = useMemo(
    () => crearModeloImpresionLibroDiario(
      movimientosConSaldo,
      movimientosBanco,
      cajaActiva?.fechaApertura,
      resumenBancoPeriodo?.inicial ?? 0
    ),
    [movimientosConSaldo, movimientosBanco, cajaActiva?.fechaApertura, resumenBancoPeriodo?.inicial]
  );

  const movimientosLibroDiarioFiltrados = useMemo(
    () => filtrarMovimientos(movimientosLibroDiario, {
      naturaleza: filtroNaturaleza,
      concepto: filtroConcepto,
      usuario: filtroUsuario,
      busqueda: filtroBusqueda,
    }),
    [movimientosLibroDiario, filtroNaturaleza, filtroConcepto, filtroUsuario, filtroBusqueda]
  );

  const movimientosImpresion = movimientosLibroDiario;
  const movimientosImpresionFiltrados = movimientosLibroDiarioFiltrados;

  const filtrosActivos = [filtroNaturaleza, filtroConcepto, filtroUsuario, filtroBusqueda].filter(Boolean);
  const hayFiltrosActivos = filtrosActivos.length > 0;

  const limpiarFiltros = () => {
    setFiltroNaturaleza("");
    setFiltroConcepto("");
    setFiltroUsuario("");
    setFiltroBusqueda("");
  };

  const usuariosConNombre = useMemo(
    () => getUsuariosUnicos(movimientosConSaldo),
    [movimientosConSaldo]
  );

  const totalesTurno = useMemo(() => calcularTotales(movimientosConSaldo), [movimientosConSaldo]);
  const totalesFiltrado = useMemo(() => calcularTotales(movimientosFiltrados), [movimientosFiltrados]);

  const totalIngresosTurno = totalesTurno.totalIngresos;
  const totalEgresosTurno = totalesTurno.totalEgresos;
  const saldoFinalTurno = totalesTurno.saldoFinal;

  const gastoMontoNumero = useMemo(() => {
    const parsed = Number(gastoMonto);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [gastoMonto]);

  const saldoCajaActual = saldosFinancieros?.efectivoFisico ?? saldoFinalTurno;
  const saldoCajaResultante = gastoMontoNumero !== null ? saldoCajaActual - gastoMontoNumero : saldoCajaActual;

  const saldoFinalFiltrado = totalesFiltrado.saldoFinal;

  // "Ventas" = ingresos por ventas reales (excluye el saldo inicial de apertura)
  const totalVentasTurno = movimientosConSaldo
    .filter((m) => m.tipo === "INGRESO" && getConcepto(m) === "VENTA")
    .reduce((sum, m) => sum + m.monto, 0);
  const totalVentasFiltrado = movimientosFiltrados
    .filter((m) => m.tipo === "INGRESO" && getConcepto(m) === "VENTA")
    .reduce((sum, m) => sum + m.monto, 0);

  const totalReposicionesTurno = movimientosImpresion
    .filter((m) => m.tipo === "EGRESO" && m.compraId != null)
    .reduce((total, m) => total + crearFilaImpresionLibroDiario(m).importe, 0);
  const totalReposicionesFiltrado = movimientosImpresionFiltrados
    .filter((m) => m.tipo === "EGRESO" && m.compraId != null)
    .reduce((total, m) => total + crearFilaImpresionLibroDiario(m).importe, 0);
  const totalGastosTurno = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO" && m.descripcion.toLowerCase().startsWith("gasto:"))
    .reduce((sum, m) => sum + m.monto, 0);
  const totalGastosFiltrado = movimientosFiltrados
    .filter(m => m.tipo === "EGRESO" && m.descripcion.toLowerCase().startsWith("gasto:"))
    .reduce((sum, m) => sum + m.monto, 0);

  // ─── Totales de flujo por fondo (Parte 7.4 — impresión) ──────────
  const flujosTurno = useMemo(
    () => calcularFlujosImpresion(movimientosImpresion),
    [movimientosImpresion]
  );
  const flujosFiltrado = useMemo(
    () => calcularFlujosImpresion(movimientosImpresionFiltrados),
    [movimientosImpresionFiltrados]
  );

  const porAcreditarTurno = movimientosImpresion.reduce((total, mov) => {
    const fila = crearFilaImpresionLibroDiario(mov);
    return total + fila.ingresoPorAcreditar - fila.egresoPorAcreditar;
  }, 0);
  const porAcreditarFiltrado = movimientosImpresionFiltrados.reduce((total, mov) => {
    const fila = crearFilaImpresionLibroDiario(mov);
    return total + fila.ingresoPorAcreditar - fila.egresoPorAcreditar;
  }, 0);

  const resumenInferior = hayFiltrosActivos
    ? {
        movimientos: movimientosFiltrados.length,
        ventas: totalVentasFiltrado,
        reposiciones: totalReposicionesFiltrado,
        gastos: totalGastosFiltrado,
        cajaInicial: cajaActiva?.montoInicial ?? 0,
        cajaIngresos: flujosFiltrado.ingresosCaja,
        cajaEgresos: flujosFiltrado.egresosCaja,
        cajaSaldo: saldoFinalFiltrado,
        bancoInicial: resumenBancoPeriodo?.inicial ?? 0,
        bancoIngresos: flujosFiltrado.ingresosBanco,
        bancoEgresos: flujosFiltrado.egresosBanco,
        bancoSaldo:
          (resumenBancoPeriodo?.inicial ?? 0) +
          flujosFiltrado.ingresosBanco -
          flujosFiltrado.egresosBanco,
        porAcreditar: porAcreditarFiltrado,
      }
    : {
        movimientos: movimientosConSaldo.length,
        ventas: totalVentasTurno,
        reposiciones: totalReposicionesTurno,
        gastos: totalGastosTurno,
        cajaInicial: cajaActiva?.montoInicial ?? 0,
        cajaIngresos: flujosTurno.ingresosCaja,
        cajaEgresos: flujosTurno.egresosCaja,
        cajaSaldo: saldoFinalTurno,
        bancoInicial: resumenBancoPeriodo?.inicial ?? 0,
        bancoIngresos: resumenBancoPeriodo?.ingresos ?? flujosTurno.ingresosBanco,
        bancoEgresos: resumenBancoPeriodo?.egresos ?? flujosTurno.egresosBanco,
        bancoSaldo: resumenBancoPeriodo?.saldo ?? 0,
        porAcreditar: saldosFinancieros?.porAcreditar ?? porAcreditarTurno,
      };
  const totalDisponibleResumen = resumenInferior.cajaSaldo + resumenInferior.bancoSaldo;

  const handlePrint = () => {
    const report = document.getElementById("caja-print-report");
    if (!report) return;

    const old = document.getElementById("print-overlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "print-overlay";
    overlay.innerHTML = report.innerHTML;
    document.body.appendChild(overlay);

    document.body.classList.add("print-active");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("print-active");
      }, 500);
    }, 300);
  };

  const handleExportCSV = () => {
    if (!cajaActiva) return;

    const BOM = "\uFEFF";
    const lines: string[] = [];

    lines.push("CHOPPER REPUESTOS");
    lines.push("LIBRO DIARIO DE CAJA");
    lines.push("");
    lines.push(`Caja: #${cajaActiva.id.toString().padStart(4, "0")}`);
    lines.push(`Estado: ${cajaActiva.estado}`);
    lines.push(`Cajero: @${cajaActiva.usuario.username}`);
    lines.push(`Fecha de apertura: ${formatDate(cajaActiva.fechaApertura)}`);
    lines.push(`Fecha de emisión del reporte: ${formatDate(new Date())}`);
    lines.push("");

    if (hayFiltrosActivos) {
      lines.push("Filtros aplicados");
      if (filtroUsuario) lines.push(`Usuario: @${filtroUsuario}`);
      if (filtroNaturaleza) lines.push(`Naturaleza: ${filtroNaturaleza}`);
      if (filtroConcepto) lines.push(`Concepto: ${filtroConcepto}`);
      if (filtroBusqueda) lines.push(`Búsqueda: "${filtroBusqueda}"`);
      lines.push("");
    }

    // Header: 17 columnas — datos base + 3 Caja + 3 Banco + 3 Por Acreditar
    lines.push("N°;Fecha;Hora;Descripción;Tipo;Pago;Importe;Usuario;Ingreso Caja;Egreso Caja;Saldo Caja;Ingreso Banco;Egreso Banco;Saldo Banco;Ingreso Por Acreditar;Egreso Por Acreditar;Saldo Por Acreditar");

    const movimientos = movimientosLibroDiarioFiltrados;
    let saldoPorAcreditar = 0;
    for (const mov of movimientos) {
      const d = new Date(mov.fecha);
      const fechaStr = formatDateShort(d);
      const horaStr = formatTime24(d);
      const fila = crearFilaImpresionLibroDiario(mov);
      const desc = construirDescripcionImpresion(mov).replace(/"/g, '""');
      saldoPorAcreditar += fila.ingresoPorAcreditar - fila.egresoPorAcreditar;

      lines.push(
        `${mov.itemNumber};${fechaStr};${horaStr};"${desc}";${mov.tipo};${fila.pago};${fila.importe};@${mov.usuario.username};${fila.ingresoCaja};${fila.egresoCaja};${fila.saldoCaja};${fila.ingresoBanco};${fila.egresoBanco};${fila.saldoBanco};${fila.ingresoPorAcreditar};${fila.egresoPorAcreditar};${saldoPorAcreditar}`
      );
    }

    lines.push("");
    lines.push("RESUMEN");
    lines.push(`Movimientos: ${movimientos.length}`);
    lines.push(`Ventas: ${formatCurrency(resumenInferior.ventas)}`);
    lines.push(`Reposiciones: ${formatCurrency(resumenInferior.reposiciones)}`);
    lines.push(`Gastos: ${formatCurrency(resumenInferior.gastos)}`);
    lines.push(`Efectivo Inicial: ${formatCurrency(resumenInferior.cajaInicial)}`);
    lines.push(`Ingresos Caja: ${formatCurrency(resumenInferior.cajaIngresos)}`);
    lines.push(`Egresos Caja: ${formatCurrency(resumenInferior.cajaEgresos)}`);
    lines.push(`Efectivo Esperado: ${formatCurrency(resumenInferior.cajaSaldo)}`);
    lines.push(`Banco Inicial: ${formatCurrency(resumenInferior.bancoInicial)}`);
    lines.push(`Ingresos Banco: ${formatCurrency(resumenInferior.bancoIngresos)}`);
    lines.push(`Egresos Banco: ${formatCurrency(resumenInferior.bancoEgresos)}`);
    lines.push(`Banco Disponible: ${formatCurrency(resumenInferior.bancoSaldo)}`);
    lines.push(`Por Acreditar: ${formatCurrency(resumenInferior.porAcreditar)}`);
    lines.push(`Total Disponible: ${formatCurrency(totalDisponibleResumen)}`);
    if (hayFiltrosActivos) {
      lines.push("");
      lines.push("Totales correspondientes a los filtros aplicados.");
    }

    const csv = BOM + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const today = new Date().toISOString().split("T")[0];
    link.download = `Libro_Diario_Caja_${today}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (highlightedVentaId || highlightedMovId) {
      const targetId = highlightedVentaId
        ? `caja-row-venta-${highlightedVentaId}`
        : `caja-row-mov-${highlightedMovId}`;
      const timer = setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightedVentaId, highlightedMovId, movimientosLibroDiarioFiltrados]);

  const openDetalle = (mov: MovimientoEnriched) => {
    setHighlightedVentaId(null);
    setHighlightedMovId(null);
    setMovimientoSeleccionado(mov);
    setShowDetalleModal(true);
  };

  return (
    <>
    <style>{`#print-overlay .cj-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }`}</style>
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* ═══ SECCIÓN PRINCIPAL ═══ */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">

        {/* ── CASO A: Caja Cerrada ── */}
        {!cajaActiva ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-8 max-w-xl mx-auto text-center space-y-6 shadow-[var(--shadow-lg)]">
            <div className="inline-flex p-4 rounded-full bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20">
              <Lock size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">Caja Cerrada</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm mx-auto leading-relaxed">
                Actualmente no hay ninguna caja operativa abierta. Debe abrir la caja con un saldo inicial en efectivo para poder registrar cobros y reposiciones.
              </p>
            </div>

            {/* Approval banner for admins — from SolicitudCaja model */}
            {solicitudesPendientes.length > 0 && userRole === "ADMINISTRADOR" && (
              <div className="max-w-lg mx-auto rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-4 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-[var(--warning)]" />
                  <p className="text-sm font-bold text-[var(--warning)]">
                    {solicitudesPendientes.length} solicitud{solicitudesPendientes.length > 1 ? "es" : ""} de caja pendiente{solicitudesPendientes.length > 1 ? "s" : ""}
                  </p>
                </div>
                {solicitudesPendientes.map((sol) => {
                  const datos = sol.datosExtra as Record<string, unknown> | null;
                  const tipoLabel = sol.tipo === "APERTURA" ? "apertura"
                    : sol.tipo === "CIERRE" ? "cierre"
                    : sol.tipo === "AJUSTE_EFECTIVO" ? "ajuste de efectivo"
                    : "ajuste de Banco";
                  const montoInfo = sol.tipo === "APERTURA"
                    ? `efectivo $${Number(datos?.montoInicialEfectivo ?? sol.monto ?? 0).toLocaleString("es-AR")} y banco $${Number(datos?.saldoBanco ?? 0).toLocaleString("es-AR")}`
                    : sol.monto != null ? `$${sol.monto.toLocaleString("es-AR")}` : "";
                  return (
                    <div key={sol.id} className="flex items-center justify-between gap-2 text-xs">
                      <p className="text-[var(--text-secondary)]">
                        <strong>{sol.solicitante.nombreCompleto || sol.solicitante.username}</strong> pidió {tipoLabel} {montoInfo && <strong>{montoInfo}</strong>}
                      </p>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleAprobarApertura(sol.id)}
                          disabled={isPending}
                          leftIcon={<CheckCircle2 size={12} />}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRechazarApertura(sol.id)}
                          disabled={isPending}
                          leftIcon={<XCircle size={12} />}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending status for non-admin who submitted requests */}
            {solicitudesUsuario.length > 0 && userRole !== "ADMINISTRADOR" && (
              <div className="max-w-md mx-auto rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Clock size={18} className="text-[var(--warning)]" />
                  <p className="text-sm font-bold text-[var(--warning)]">
                    {solicitudesUsuario.length} solicitud{solicitudesUsuario.length > 1 ? "es" : ""} pendiente{solicitudesUsuario.length > 1 ? "s" : ""}
                  </p>
                </div>
                {solicitudesUsuario.map((sol) => {
                  const tipoLabel = sol.tipo === "APERTURA" ? "apertura"
                    : sol.tipo === "CIERRE" ? "cierre"
                    : sol.tipo === "AJUSTE_EFECTIVO" ? "ajuste de efectivo"
                    : "ajuste de Banco";
                  return (
                    <div key={sol.id} className="text-xs text-[var(--text-secondary)]">
                      <p>Tu solicitud de <strong>{tipoLabel}</strong> está esperando aprobación.</p>
                      {sol.motivoRechazo && (
                        <p className="text-[var(--danger)] mt-1">Rechazada: {sol.motivoRechazo}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {aperturaCompletada ? (
              <div className="space-y-3 max-w-xs mx-auto" aria-live="polite">
                <div className="p-3 bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--success)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center justify-center space-x-2">
                  <Unlock size={14} />
                  <span>Caja abierta correctamente. Actualizando estado...</span>
                </div>
              </div>
            ) : (
            <form onSubmit={handleAbrir} className="space-y-4 max-w-xs mx-auto">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block text-center">
                  Monto de Apertura (Efectivo)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={montoApertura}
                  onChange={e => setMontoApertura(e.target.value)}
                  className="w-full text-center px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] focus:outline-none focus:border-[var(--brand)] text-lg font-mono font-bold transition-colors"
                  required
                  disabled={isPending || aperturaCompletada}
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block text-center">
                  Saldo Bancario Disponible
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={montoAperturaBanco}
                  readOnly
                  className="w-full text-center px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-lg font-mono font-bold transition-colors cursor-not-allowed opacity-70"
                  tabIndex={-1}
                />
                <p className="text-[10px] text-[var(--text-muted)] text-center mt-0.5">
                  Se auto-completa del último saldo bancario. Para corregir, use &quot;Ajustar Banco&quot;.
                </p>
              </div>
              {errorMsg && (
                <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center justify-center space-x-2">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
              <Button type="submit" className="w-full py-3" disabled={isPending || aperturaCompletada} loading={isPending || aperturaCompletada} leftIcon={<Unlock size={16} />}>
                {isPending || aperturaCompletada ? "Abriendo..." : "Abrir Caja de Mostrador"}
              </Button>
            </form>
            )}
          </div>

        /* ── CASO B: Caja Abierta ── */
        ) : (
          <div className="animate-in fade-in duration-200 flex flex-1 flex-col min-h-0 gap-2">

            {/* Day-change warning */}
            {dayChanged && (
              <div className="bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-lg px-4 py-3 flex items-center gap-3 shrink-0">
                <AlertCircle size={20} className="text-[var(--warning)] shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--warning)]">Caja abierta de un día anterior</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    La caja fue abierta el {formatDate(cajaActiva.fechaApertura)} y aún no se ha cerrado. Debe cerrar antes de registrar nuevas operaciones.
                  </p>
                </div>
                <Button variant="warning" size="sm" onClick={handleCerrar} leftIcon={<Lock size={14} />}>
                  Cerrar Caja
                </Button>
              </div>
            )}

            {/* ═══ BARRA DE ESTADO REORGANIZADA ═══ */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm shadow-[var(--shadow-sm)] shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Calendar size={14} className="text-[var(--info)]" />
                  <span className="font-medium">Apertura: <strong className="text-[var(--text)]">{formatDate(cajaActiva.fechaApertura)}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <User size={14} className="text-[var(--info)]" />
                  <span className="font-medium">Caja abierta por <strong className="text-[var(--text)]">{cajaActiva.usuario.nombreCompleto || cajaActiva.usuario.username}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Clock size={14} className="text-[var(--warning)]" />
                  <span className="font-medium">{aperturaDesdeStr} <span className="text-[var(--text-secondary)]">({duracionStr})</span></span>
                </span>
                <Badge variant="success" size="sm" className="uppercase font-black tracking-wider">Abierta</Badge>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {saldosFinancieros && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setErrorMsg("");
                      setShowGastoModal(true);
                    }}
                    disabled={dayChanged || isPending}
                    leftIcon={<MinusCircle size={14} />}
                  >
                    Registrar Gasto
                  </Button>
                )}
                {saldosFinancieros && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAjusteBancoErrorMsg("");
                      setShowAjustarBancoModal(true);
                    }}
                    leftIcon={<Landmark size={14} />}
                  >
                    Ajustar Banco
                  </Button>
                )}
                {saldosFinancieros && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAjusteEfectivoErrorMsg("");
                      setShowAjustarEfectivoModal(true);
                    }}
                    leftIcon={<Banknote size={14} />}
                  >
                    Ajustar Efectivo
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handlePrint} leftIcon={<Printer size={14} />}>Imprimir</Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} leftIcon={<Download size={14} />}>CSV</Button>
                <Button variant="danger" size="sm" onClick={handleCerrar} disabled={isPending} leftIcon={<Lock size={14} />}>Cerrar Caja</Button>
              </div>
            </div>

            {/* ═══ RESUMEN FINANCIERO ═══ */}
            {saldosFinancieros && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
                {/* Efectivo disponible */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-[var(--shadow-sm)]">
                  <div className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider">Efectivo disponible</div>
                  <div className="text-sm font-black font-mono text-[var(--text)] mt-0.5">
                    {formatCurrency(saldosFinancieros.efectivoFisico)}
                  </div>
                </div>

                {/* Banco disponible */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-[var(--shadow-sm)]">
                  <div className="text-[10px] font-semibold text-[#38bdf8] uppercase tracking-wider">Banco disponible</div>
                  <div className="text-sm font-black font-mono text-[var(--text)] mt-0.5">
                    {formatCurrency(saldosFinancieros.banco)}
                  </div>
                </div>

                {/* Por acreditar */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-[var(--shadow-sm)]">
                  <div className="text-[10px] font-semibold text-[#c084fc] uppercase tracking-wider">Por acreditar</div>
                  <div className="text-sm font-black font-mono text-[var(--text)] mt-0.5">
                    {formatCurrency(saldosFinancieros.porAcreditar)}
                  </div>
                </div>

                {/* Total disponible */}
                <div className="bg-[var(--card)] border border-[var(--brand)]/30 rounded-lg px-3 py-2 shadow-[var(--shadow-sm)]">
                  <div className="text-[10px] font-semibold text-[var(--brand)] uppercase tracking-wider">Total disponible</div>
                  <div className="text-sm font-black font-mono text-[var(--text)] mt-0.5">
                    {formatCurrency(saldosFinancieros.totalDisponible)}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ BUSCADOR + FILTROS ═══ */}
            <div className="shrink-0 rounded-lg border border-[#2B303B] bg-[#1E2129]/90 p-2 shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                <div className="relative flex-1 xl:pr-2">
                    <label className={`${cajaSelectClassName.label} mb-1 block text-[10px] uppercase tracking-[0.14em]`}>
                      Búsqueda
                    </label>
                    <Input
                      placeholder="Buscar por descripción, factura, usuario o referencia..."
                      value={filtroBusqueda}
                      onChange={(e) => setFiltroBusqueda(e.target.value)}
                      leftIcon={<Search size={14} />}
                      className="h-[36px] rounded-[10px] border-[#2B303B] bg-[#101114] pr-3 text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] hover:border-[#3A414F] hover:bg-[#17191F] focus-visible:outline-brand"
                    />
                    {filtroBusqueda && (
                      <button
                        onClick={() => setFiltroBusqueda("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                </div>
                <div className="flex flex-wrap items-end gap-1.5 xl:flex-nowrap xl:justify-end">
                  <button
                    onClick={limpiarFiltros}
                    disabled={!hayFiltrosActivos}
                    className={`flex h-[36px] items-center justify-center gap-1.5 rounded-[10px] border px-2.5 text-[11px] font-semibold transition xl:min-w-[96px] ${
                      hayFiltrosActivos
                        ? "border-[var(--danger)]/30 bg-[var(--danger-light)] text-[var(--danger)] hover:bg-[var(--danger)]/10"
                        : "cursor-not-allowed border-[#2B303B] bg-[#101114] text-[#64748B]"
                    }`}
                  >
                    <RotateCcw size={13} />
                    Limpiar
                  </button>
                    <ToolbarSelect
                      label="Naturaleza"
                      value={filtroNaturaleza || "all"}
                      onValueChange={(v) => setFiltroNaturaleza(v === "all" ? "" : v)}
                      triggerIcon={Waves}
                      minWidth="w-full sm:min-w-[150px]"
                      tone={cajaSelectToneNaturaleza}
                      triggerClassName={cajaSelectClassName.trigger}
                      iconClassName={cajaSelectClassName.icon}
                      labelClassName={`${cajaSelectClassName.label} text-[10px] tracking-[0.12em] uppercase`}
                      contentClassName={cajaSelectClassName.content}
                      itemClassName={cajaSelectClassName.item}
                      options={[
                        { value: "all", label: "Todos", icon: ListFilter, iconClassName: "text-[#7890B2]", iconBoxClassName: "bg-[rgba(148,163,184,0.12)] text-[#7890B2]" },
                        { value: "INGRESO", label: "Ingresos", icon: ArrowDownLeft, iconClassName: "text-[#22C55E]", iconBoxClassName: "bg-[rgba(34,197,94,0.12)] text-[#22C55E]" },
                        { value: "EGRESO", label: "Egresos", icon: ArrowUpRight, iconClassName: "text-[#EF4444]", iconBoxClassName: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]" },
                      ]}
                    />
                    <ToolbarSelect
                      label="Concepto"
                      value={filtroConcepto || "all"}
                      onValueChange={(v) => setFiltroConcepto(v === "all" ? "" : v)}
                      triggerIcon={Tags}
                      minWidth="w-full sm:min-w-[172px]"
                      tone={cajaSelectToneConcepto}
                      triggerClassName={cajaSelectClassName.trigger}
                      iconClassName={cajaSelectClassName.icon}
                      labelClassName={`${cajaSelectClassName.label} text-[10px] tracking-[0.12em] uppercase`}
                      contentClassName={cajaSelectClassName.content}
                      itemClassName={cajaSelectClassName.item}
                      options={[
                        { value: "all", label: "Todos", icon: Tags, iconClassName: "text-[#7890B2]", iconBoxClassName: "bg-[rgba(148,163,184,0.12)] text-[#7890B2]" },
                        { value: "VENTA", label: "Ventas", icon: ShoppingCart, iconClassName: "text-[#22C55E]", iconBoxClassName: "bg-[rgba(34,197,94,0.12)] text-[#22C55E]" },
                        { value: "REPOSICION", label: "Reposiciones", icon: PackagePlus, iconClassName: "text-[#3B82F6]", iconBoxClassName: "bg-[rgba(59,130,246,0.12)] text-[#3B82F6]" },
                        { value: "AJUSTE", label: "Ajustes", icon: Waves, iconClassName: "text-[#A78BFA]", iconBoxClassName: "bg-[rgba(167,139,250,0.12)] text-[#A78BFA]" },
                        { value: "GASTO", label: "Gastos varios", icon: Receipt, iconClassName: "text-[#EF4444]", iconBoxClassName: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]" },
                        { value: "APERTURA", label: "Apertura", icon: FolderOpen, iconClassName: "text-[#22D3EE]", iconBoxClassName: "bg-[rgba(34,211,238,0.12)] text-[#22D3EE]" },
                      ]}
                    />
                    <ToolbarSelect
                      label="Usuario"
                      value={filtroUsuario || "all"}
                      onValueChange={(v) => setFiltroUsuario(v === "all" ? "" : v)}
                      triggerIcon={UserRound}
                      minWidth="w-full sm:min-w-[160px]"
                      tone={cajaSelectToneUsuario}
                      triggerClassName={cajaSelectClassName.trigger}
                      iconClassName={cajaSelectClassName.icon}
                      labelClassName={`${cajaSelectClassName.label} text-[10px] tracking-[0.12em] uppercase`}
                      contentClassName={cajaSelectClassName.content}
                      itemClassName={cajaSelectClassName.item}
                      options={[
                        { value: "all", label: "Todos", icon: UserRound },
                        ...usuariosConNombre.map((u) => ({
                          value: u.username,
                          label: u.nombreCompleto,
                          icon: UserRound,
                        })),
                      ]}
                    />
                </div>
              </div>
            </div>

            {/* ═══ LIBRO DIARIO ═══ */}
            <div className="flex flex-1 basis-0 flex-col min-h-0">
              <TableShell
                title="Libro Diario"
                isEmpty={movimientosLibroDiarioFiltrados.length === 0}
                emptyMessage={hayFiltrosActivos ? "No se encontraron movimientos con estos filtros." : "No se registran movimientos en este turno."}
                emptyIcon={<Activity size={32} className="opacity-40" />}
              >
                <table className="w-full min-w-[1720px] border-collapse text-sm text-left">
                    <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--panel)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] shadow-[0_1px_0_var(--border)]">
                      <tr>
                        <th className="w-[4%] bg-[var(--panel)] px-3 py-3 text-center">#</th>
                        <th className="w-[8%] bg-[var(--panel)] px-3 py-3">Fecha</th>
                        <th className="w-[6%] bg-[var(--panel)] px-3 py-3">Hora</th>
                        <th className="w-[24%] bg-[var(--panel)] px-3 py-3">Descripción</th>
                        <th className="w-[8%] bg-[var(--panel)] px-2 py-3 text-center whitespace-nowrap">Tipo</th>
                        <th className="w-[9%] bg-[var(--panel)] px-2 py-3 whitespace-nowrap">Pago</th>
                        <th className="w-[9%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Importe</th>
                        <th className="w-[8%] bg-[var(--panel)] px-2 py-3 whitespace-nowrap">Usuario</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Ing. Caja</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Egr. Caja</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Saldo Caja</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Ing. Banco</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Egr. Banco</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Saldo Banco</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Ing. Pend.</th>
                        <th className="w-[7%] bg-[var(--panel)] px-3 py-3 text-right whitespace-nowrap">Saldo Pend.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                      {movimientosLibroDiarioFiltrados.map((mov) => {
                        const d = new Date(mov.fecha);
                        const fechaStr = formatDateShort(d);
                        const horaStr = formatTime24(d);
                        const visual = getTipoVisual(mov);
                        const reposicionFila = mov.compra ? formatReposicionFila(mov.compra) : null;
                        const descTitle = mov.venta ? getVentaDescripcionClean(mov) : mov.compra ? (reposicionFila ? reposicionFila.principal : formatMovimientoDescripcion(mov.descripcion)) : formatMovimientoDescripcion(mov.descripcion);
                        const fila = crearFilaImpresionLibroDiario(mov);
                        const renderMoneyOrDash = (value: number, tone?: string) =>
                          value > 0 ? (
                            <span className={tone}>{formatCurrency(value)}</span>
                          ) : (
                            <span className="text-[var(--text-secondary)] opacity-50">{"\u2014"}</span>
                          );

                        const isHighlighted =
                          (highlightedVentaId != null && mov.ventaId === highlightedVentaId) ||
                          (highlightedMovId != null && mov.id === highlightedMovId);

                        return (
                          <tr
                            key={mov.id}
                            id={mov.ventaId ? `caja-row-venta-${mov.ventaId}` : `caja-row-mov-${mov.id}`}
                            onClick={() => openDetalle(mov)}
                            className={cn(
                              "cursor-pointer transition-colors relative",
                              isHighlighted
                                ? "bg-emerald-500/[0.14] ring-2 ring-inset ring-emerald-500/50 hover:bg-emerald-500/[0.20]"
                                : "hover:bg-[var(--brand)]/[0.03]"
                            )}
                          >
                            <td className="px-3 py-3.5 text-center font-semibold whitespace-nowrap text-[var(--text-secondary)] relative">
                              {isHighlighted && (
                                <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-emerald-400 rounded-r-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                              )}
                              {mov.itemNumber}
                            </td>
                            <td className="px-3 py-3.5 whitespace-nowrap text-[var(--text-muted)]">{fechaStr}</td>
                            <td className="px-3 py-3.5 whitespace-nowrap text-[var(--text-secondary)]">{horaStr}</td>
                            <td className="px-3 py-3.5 pr-2 font-sans leading-tight text-[var(--text)]" title={descTitle}>
                              {mov.venta ? (
                                <span className="block whitespace-normal break-words line-clamp-2">
                                  {getVentaDescripcionClean(mov)}
                                </span>
                              ) : mov.compra ? (
                                <span className="block whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 400 }}>
                                  {reposicionFila ? reposicionFila.principal : formatMovimientoDescripcion(mov.descripcion)}
                                </span>
                              ) : (
                                <span className="block whitespace-normal break-words line-clamp-2">
                                  {formatMovimientoDescripcion(mov.descripcion)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-3.5 text-center whitespace-nowrap">
                              <Badge variant={visual.variant} size="sm">
                                {visual.label}
                              </Badge>
                            </td>
                            <td className="px-2 py-3.5 whitespace-nowrap">{renderPagoBadge(fila.pago)}</td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--text)] whitespace-nowrap">
                              {formatCurrency(fila.importe)}
                            </td>
                            <td className="px-2 py-3.5 font-sans whitespace-nowrap text-[var(--text-muted)]" title={mov.usuario.nombreCompleto || undefined}>@{mov.usuario.username}</td>
                            <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">
                              {renderMoneyOrDash(fila.ingresoCaja, "text-[var(--success)]")}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">
                              {renderMoneyOrDash(fila.egresoCaja, "text-[var(--danger)]")}
                            </td>
                            <td className="px-3 py-3.5 text-right font-bold whitespace-nowrap text-[var(--text)]">
                              {formatCurrency(fila.saldoCaja)}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">
                              {renderMoneyOrDash(fila.ingresoBanco, "text-[#38bdf8]")}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">
                              {renderMoneyOrDash(fila.egresoBanco, "text-[#fb923c]")}
                            </td>
                            <td className="px-3 py-3.5 text-right font-bold whitespace-nowrap text-[#38bdf8]">
                              {formatCurrency(fila.saldoBanco)}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">
                              {renderMoneyOrDash(fila.ingresoPorAcreditar, "text-[#c084fc]")}
                            </td>
                            <td className="px-3 py-3.5 text-right font-bold whitespace-nowrap text-[#d8b4fe]">
                              {formatCurrency(fila.saldoPorAcreditar)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              </TableShell>
            </div>
          </div>
        )}
      </div>

      {cajaActiva && (
        <div className="pt-1">
          {/* ═══ RESUMEN INFERIOR ═══ */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 shadow-[var(--shadow-sm)] flex flex-col justify-end">
            {hayFiltrosActivos && (
              <p className="text-xs text-[var(--brand)] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                <Filter size={12} />
                Totales según filtros aplicados
              </p>
            )}
            <div className="grid gap-2 xl:grid-cols-5">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/45 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Operación económica</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Movimientos</span>
                    <span className="font-bold text-[var(--text)]">{resumenInferior.movimientos}{hayFiltrosActivos ? `/${movimientosConSaldo.length}` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Ventas</span>
                    <span className="font-mono font-bold text-[var(--success)]">{formatCurrency(resumenInferior.ventas)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Reposiciones</span>
                    <span className="font-mono font-bold text-[var(--warning)]">{formatCurrency(resumenInferior.reposiciones)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Gastos</span>
                    <span className="font-mono font-bold text-[var(--danger)]">{formatCurrency(resumenInferior.gastos)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[rgba(34,197,94,0.07)] p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4ade80]">Caja</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Inicial Caja</span>
                    <span className="font-mono font-bold text-[var(--info)]">{formatCurrency(resumenInferior.cajaInicial)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Ingresos Caja</span>
                    <span className="font-mono font-bold text-[var(--success)]">{formatCurrency(resumenInferior.cajaIngresos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Egresos Caja</span>
                    <span className="font-mono font-bold text-[var(--danger)]">{formatCurrency(resumenInferior.cajaEgresos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Saldo Caja</span>
                    <span className={`font-mono text-base font-black ${resumenInferior.cajaSaldo >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(resumenInferior.cajaSaldo)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[rgba(56,189,248,0.07)] p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#38bdf8]">Banco</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Inicial Banco</span>
                    <span className="font-mono font-bold text-[var(--info)]">{formatCurrency(resumenInferior.bancoInicial)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Ingresos Banco</span>
                    <span className="font-mono font-bold text-[#38bdf8]">{formatCurrency(resumenInferior.bancoIngresos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Egresos Banco</span>
                    <span className="font-mono font-bold text-[#fb923c]">{formatCurrency(resumenInferior.bancoEgresos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Saldo Banco</span>
                    <span className={`font-mono text-base font-black ${resumenInferior.bancoSaldo >= 0 ? "text-[#38bdf8]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(resumenInferior.bancoSaldo)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[rgba(168,85,247,0.08)] p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c084fc]">Pendiente</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Por acreditar</span>
                    <span className="font-mono text-base font-black text-[#c084fc]">{formatCurrency(resumenInferior.porAcreditar)}</span>
                  </div>
                  <p className="pt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    Crédito no entra en Banco hasta acreditarse.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-light)]/40 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Total</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Total disponible</span>
                    <span className="font-mono text-lg font-black text-[var(--brand)]">{formatCurrency(totalDisponibleResumen)}</span>
                  </div>
                  <p className="pt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    Caja + Banco. No incluye Por acreditar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Modales */}
    {cajaActiva && (
      <ConfirmarCierreModal
        open={showCerrarModal}
        onClose={cerrarModalCierre}
        onConfirm={confirmarCierre}
        isPending={isPending}
        errorMessage={cierreErrorMsg}
        montoInicial={cajaActiva.montoInicial}
        totalVentas={cajaActiva.totalVentas}
        totalIngresos={totalIngresosTurno}
        totalEgresos={totalEgresosTurno}
        fechaApertura={cajaActiva.fechaApertura}
        saldoFinal={saldoFinalTurno}
      />
    )}

    <MovimientoDetalleModal
      open={showDetalleModal}
      onClose={() => { setShowDetalleModal(false); setMovimientoSeleccionado(null); }}
      movimiento={movimientoSeleccionado}
    />

    {saldosFinancieros && (
      <AjustarBancoModal
        open={showAjustarBancoModal}
        onClose={() => {
          if (isPending) return;
          setShowAjustarBancoModal(false);
          setAjusteBancoErrorMsg("");
        }}
        onConfirm={handleAjusteBanco}
        isPending={isPending}
        saldoActual={saldosFinancieros.banco}
        errorMessage={ajusteBancoErrorMsg}
      />
    )}

    {saldosFinancieros && (
      <AjustarEfectivoModal
        open={showAjustarEfectivoModal}
        onClose={() => {
          if (isPending) return;
          setShowAjustarEfectivoModal(false);
          setAjusteEfectivoErrorMsg("");
        }}
        onConfirm={handleAjusteEfectivo}
        isPending={isPending}
        saldoActual={saldosFinancieros.efectivoFisico}
        errorMessage={ajusteEfectivoErrorMsg}
      />
    )}

    <Dialog open={showGastoModal} onOpenChange={(open) => !open && cerrarModalGasto()}>
      <DialogContent className="max-w-[28rem] border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-[var(--text)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--danger-light)] text-[var(--danger)] ring-1 ring-[var(--danger)]/20">
              <MinusCircle size={16} />
            </span>
            Registrar Gasto Diario
          </DialogTitle>
        </DialogHeader>

        {dayChanged ? (
          <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">
            Cierre pendiente del día anterior.
          </div>
        ) : (
          <form onSubmit={handleGasto} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9FB1CC]">
                Concepto del Gasto
              </label>
              <Input
                name="descripcion"
                placeholder="Ej: Artículos de limpieza, Viáticos..."
                value={gastoDesc}
                onChange={(e) => setGastoDesc(e.target.value)}
                required
                disabled={isPending}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9FB1CC]">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGastoMetodoPago("EFECTIVO")}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    gastoMetodoPago === "EFECTIVO"
                      ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)]"
                  }`}
                  disabled={isPending}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Banknote size={14} />
                    Efectivo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGastoMetodoPago("BANCO")}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    gastoMetodoPago === "BANCO"
                      ? "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-secondary)]"
                  }`}
                  disabled={isPending}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Landmark size={14} />
                    Transferencia / Banco
                  </span>
                </button>
              </div>
              <input type="hidden" name="metodoPago" value={gastoMetodoPago} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9FB1CC]">
                Monto ($)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-[var(--text-secondary)]">
                  $
                </span>
                <Input
                  name="monto"
                  type="number"
                  placeholder="0.00"
                  value={gastoMonto}
                  onChange={(e) => setGastoMonto(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-10 pl-8 font-mono font-bold text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Resumen
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-secondary)]">
                    {gastoMetodoPago === "EFECTIVO" ? "Saldo Caja actual" : "Saldo Banco actual"}
                  </span>
                  <span className="font-mono font-bold text-[var(--text)]">
                    {formatCurrency(gastoMetodoPago === "EFECTIVO" ? saldoCajaActual : (saldosFinancieros?.banco ?? 0))}
                  </span>
                </div>
                {gastoMontoNumero !== null && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--text-secondary)]">Gasto</span>
                      <span className="font-mono font-bold text-[var(--danger)]">
                        -{formatCurrency(gastoMontoNumero)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
                      <span className="text-[var(--text-secondary)]">Saldo resultante</span>
                      <span className={`font-mono text-base font-black ${
                        (gastoMetodoPago === "EFECTIVO" ? saldoCajaResultante : ((saldosFinancieros?.banco ?? 0) - gastoMontoNumero)) >= 0
                          ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}>
                        {formatCurrency(
                          gastoMetodoPago === "EFECTIVO"
                            ? saldoCajaResultante
                            : ((saldosFinancieros?.banco ?? 0) - gastoMontoNumero)
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {errorMsg && (
              <div className="flex items-center justify-center space-x-1.5 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={cerrarModalGasto} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" className="h-10 min-w-[168px]" disabled={isPending} loading={isPending} leftIcon={<PlusCircle size={15} />}>
                {isPending ? "Registrando..." : "Registrar Egreso"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

    {/* ═══ REPORTE DE IMPRESIÓN (OCULTO EN PANTALLA) ═══ */}
    {cajaActiva && (
    <div id="caja-print-report" className="caja-print-source">
      <div className="cj-header">
        {/* eslint-disable-next-line @next/next/no-img-element -- El HTML clonado para impresión necesita una ruta directa. */}
        <img src="/logo.png" alt="Logo de Chopper Repuestos" className="cj-logo" />
        <div className="cj-header-center">
          <div className="cj-title">Libro Diario de Caja</div>
        </div>
      </div>

      <div className="cj-meta">
        <div className="cj-meta-item">
          <div className="cj-meta-label">Caja</div>
          <div className="cj-meta-value">#{cajaActiva.id.toString().padStart(4, "0")}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Apertura</div>
          <div className="cj-meta-value">{formatDate(cajaActiva.fechaApertura)}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Cajero</div>
          <div className="cj-meta-value">{cajaActiva.usuario.nombreCompleto || cajaActiva.usuario.username}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Estado</div>
          <div className="cj-meta-value">{cajaActiva.estado}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Saldo Inicial</div>
          <div className="cj-meta-value">{formatCurrency(cajaActiva.montoInicial)}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Duración Turno</div>
          <div className="cj-meta-value">{duracionStr}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Movimientos</div>
          <div className="cj-meta-value">{movimientosImpresionFiltrados.length}{hayFiltrosActivos ? ` / ${movimientosImpresion.length}` : ""}</div>
        </div>
        <div className="cj-meta-item">
          <div className="cj-meta-label">Emisión</div>
          <div className="cj-meta-value">{formatDate(new Date())}</div>
        </div>
      </div>

      {hayFiltrosActivos && (
        <div className="cj-filters">
          <strong>Filtros aplicados:</strong>{" "}
          {filtroNaturaleza && `Naturaleza: ${filtroNaturaleza}`}
          {filtroConcepto && ` | Concepto: ${filtroConcepto}`}
          {filtroUsuario && ` | Usuario: ${usuariosConNombre.find((u) => u.username === filtroUsuario)?.nombreCompleto || filtroUsuario}`}
          {filtroBusqueda && ` | Búsqueda: "${filtroBusqueda}"`}
        </div>
      )}

      {/* ═══ TABLA LIBRO DIARIO ═══ */}
      <table className="cj-table">
        <thead>
          <tr>
            <th className="col-num">#</th>
            <th className="col-fecha">Fecha</th>
            <th className="col-hora">Hora</th>
            <th className="col-desc">Descripción</th>
            <th className="col-tipo">Tipo</th>
            <th className="col-pago">Pago</th>
            <th className="col-importe">Importe</th>
            <th className="col-user">Usuario</th>
            <th className="col-ing-caja">Ing. Caja</th>
            <th className="col-egr-caja">Egr. Caja</th>
            <th className="col-saldo-caja">Saldo Caja</th>
            <th className="col-ing-banco">Ing. Banco</th>
            <th className="col-egr-banco">Egr. Banco</th>
            <th className="col-saldo-banco">Saldo Banco</th>
          </tr>
        </thead>
        <tbody>
          {movimientosImpresionFiltrados.map((mov) => {
            const d = new Date(mov.fecha);
            const fechaStr = formatDateShort(d);
            const horaStr = formatTime24(d);
            const visual = getTipoVisual(mov);
            const badgeClass = visual.variant === "success" ? "badge-success" : visual.variant === "danger" ? "badge-danger" : visual.variant === "warning" ? "badge-warning" : visual.variant === "info" ? "badge-info" : "badge-default";

            const filaImpresion = crearFilaImpresionLibroDiario(mov);

            // Helpers para mostrar "—" cuando el valor es 0
            const fmtCajaIn = filaImpresion.ingresoCaja > 0 ? formatCurrency(filaImpresion.ingresoCaja) : "—";
            const fmtCajaEgr = filaImpresion.egresoCaja > 0 ? formatCurrency(filaImpresion.egresoCaja) : "—";
            const fmtBancoIn = filaImpresion.ingresoBanco > 0 ? formatCurrency(filaImpresion.ingresoBanco) : "—";
            const fmtBancoEgr = filaImpresion.egresoBanco > 0 ? formatCurrency(filaImpresion.egresoBanco) : "—";

            return (
              <tr key={mov.id}>
                <td className="col-num text-center">{mov.itemNumber}</td>
                <td className="col-fecha">{fechaStr}</td>
                <td className="col-hora">{horaStr}</td>
                <td className="col-desc">{construirDescripcionImpresion(mov)}</td>
                <td className="col-tipo text-center"><span className={`badge ${badgeClass}`}>{visual.label}</span></td>
                <td className="col-pago text-center">{filaImpresion.pago}</td>
                <td className="col-importe text-right font-bold">{formatCurrency(filaImpresion.importe)}</td>
                <td className="col-user">{mov.usuario.nombreCompleto || mov.usuario.username}</td>
                <td className="col-ing-caja text-right font-bold text-green">{fmtCajaIn}</td>
                <td className="col-egr-caja text-right font-bold text-red">{fmtCajaEgr}</td>
                <td className="col-saldo-caja text-right font-bold">{formatCurrency(filaImpresion.saldoCaja)}</td>
                <td className="col-ing-banco text-right font-bold text-banco">{fmtBancoIn}</td>
                <td className="col-egr-banco text-right font-bold text-banco-egr">{fmtBancoEgr}</td>
                <td className="col-saldo-banco text-right font-bold text-banco">{formatCurrency(filaImpresion.saldoBanco)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ═══ RESUMEN DEL TURNO (IMPRESO) ═══ */}
      <div className="cj-summary">
        <div className="cj-summary-title">Resumen del Turno</div>
        <div className="cj-summary-grid">
          <div className="cj-summary-item">
            <div className="cj-summary-label">Movimientos</div>
            <div className="cj-summary-value">{movimientosImpresionFiltrados.length}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Ventas</div>
            <div className="cj-summary-value" style={{color:"#16a34a"}}>{formatCurrency(resumenInferior.ventas)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Reposiciones</div>
            <div className="cj-summary-value" style={{color:"#d97706"}}>{formatCurrency(resumenInferior.reposiciones)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Gastos</div>
            <div className="cj-summary-value" style={{color:"#dc2626"}}>{formatCurrency(resumenInferior.gastos)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Ingresos Caja</div>
            <div className="cj-summary-value" style={{color:"#16a34a"}}>{formatCurrency(resumenInferior.cajaIngresos)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Egresos Caja</div>
            <div className="cj-summary-value" style={{color:"#dc2626"}}>{formatCurrency(resumenInferior.cajaEgresos)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Ingresos Banco</div>
            <div className="cj-summary-value" style={{color:"#38bdf8"}}>{formatCurrency(resumenInferior.bancoIngresos)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Egresos Banco</div>
            <div className="cj-summary-value" style={{color:"#f97316"}}>{formatCurrency(resumenInferior.bancoEgresos)}</div>
          </div>
          <div className="cj-summary-item">
            <div className="cj-summary-label">Por Acreditar</div>
            <div className="cj-summary-value" style={{color:"#c084fc"}}>{formatCurrency(resumenInferior.porAcreditar)}</div>
          </div>
        </div>
      </div>

      {/* ═══ RESUMEN FINANCIERO INFERIOR ═══ */}
      <div className="cj-financial-summary cj-financial-bottom">
          <div className="cj-financial-row">
            <div className="cj-financial-item">
              <div className="cj-financial-label">Efectivo Inicial</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.cajaInicial)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Efectivo Esperado</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.cajaSaldo)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Banco Inicial</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.bancoInicial)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Ingresos Banco</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.bancoIngresos)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Egresos Banco</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.bancoEgresos)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Banco Disponible</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.bancoSaldo)}</div>
            </div>
            <div className="cj-financial-item">
              <div className="cj-financial-label">Por Acreditar</div>
              <div className="cj-financial-value">{formatCurrency(resumenInferior.porAcreditar)}</div>
            </div>
            <div className="cj-financial-item cj-financial-total">
              <div className="cj-financial-label">Total Disponible</div>
              <div className="cj-financial-value">{formatCurrency(totalDisponibleResumen)}</div>
            </div>
          </div>
          {cajaActiva.estado === "CERRADA" && cajaActiva.totalContado !== null && (
            <div className="cj-financial-row cj-closing-row">
              <div className="cj-financial-item">
                <div className="cj-financial-label">Efectivo Contado</div>
                <div className="cj-financial-value">{formatCurrency(cajaActiva.totalContado)}</div>
              </div>
              <div className="cj-financial-item">
                <div className="cj-financial-label">Diferencia</div>
                <div className="cj-financial-value" style={{color: (cajaActiva.totalContado - saldoFinalTurno) >= 0 ? "#16a34a" : "#dc2626"}}>
                  {formatCurrency(cajaActiva.totalContado - saldoFinalTurno)}
                  {(cajaActiva.totalContado - saldoFinalTurno) === 0 ? " (Balanceada)" : (cajaActiva.totalContado - saldoFinalTurno) > 0 ? " (Sobrante)" : " (Faltante)"}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="cj-page-footer">
          <span>Generado el {formatDate(new Date())} {formatTime24(new Date())} por {cajaActiva.usuario.nombreCompleto || cajaActiva.usuario.username}</span>
        </div>
      </div>
    )}
    </>

  );
}
