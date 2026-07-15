"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCaja,
  cerrarCaja,
  registrarGastoCaja
} from "@/actions/caja";
import ConfirmarCierreModal from "@/components/ui/ConfirmarCierreModal";
import MovimientoDetalleModal from "@/components/ui/MovimientoDetalleModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Coins,
  Lock,
  Unlock,
  PlusCircle,
  MinusCircle,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  Filter,
  X,
  Printer,
  Download,
  Clock,
  Receipt,
  ShoppingBag
} from "lucide-react";

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date;
  usuario: { username: string };
  ventaId?: number | null;
  compraId?: number | null;
}

interface CajaActiva {
  id: number;
  montoInicial: number;
  totalVentas: number;
  fechaApertura: Date;
  estado: string;
  usuario: { username: string };
  movimientos: Movimiento[];
}

interface CajaHistorial {
  id: number;
  montoInicial: number;
  totalVentas: number;
  fechaApertura: Date;
  fechaCierre: Date | null;
  estado: string;
  usuario: { username: string };
}

interface CajaTerminalProps {
  cajaActiva: CajaActiva | null;
  historialCajas: CajaHistorial[];
  userRole: string;
}

export default function CajaTerminal({
  cajaActiva,
  historialCajas,
  userRole
}: CajaTerminalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [montoApertura, setMontoApertura] = useState("");
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");

  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  // Filtros del Libro Diario
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────
  const handleAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const monto = Number(montoApertura);
    if (isNaN(monto) || monto < 0) {
      setErrorMsg("Ingrese un monto inicial válido.");
      return;
    }
    startTransition(async () => {
      const res = await abrirCaja(monto);
      if (res.success) { setMontoApertura(""); router.refresh(); }
      else { setErrorMsg(res.error || "Ocurrió un error al abrir la caja."); }
    });
  };

  const handleCerrar = () => {
    if (!cajaActiva) return;
    setShowCerrarModal(true);
  };

  const confirmarCierre = (observacion?: string) => {
    if (!cajaActiva) return;
    startTransition(async () => {
      const res = await cerrarCaja(cajaActiva.id);
      if (res.success) { router.refresh(); }
      else { setErrorMsg(res.error || "Error al cerrar la caja."); setShowCerrarModal(false); }
    });
  };

  const handleGasto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarGastoCaja(formData);
      if (res.success) { setGastoDesc(""); setGastoMonto(""); router.refresh(); }
      else { setErrorMsg(res.error || "Error al registrar el gasto."); }
    });
  };

  // ─── Movimientos ordenados + saldo acumulado ───────────────
  const movimientosOrdenados = cajaActiva
    ? [...cajaActiva.movimientos].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      )
    : [];

  let runningSaldo = 0;
  const movimientosConSaldo = movimientosOrdenados.map((mov, idx) => {
    runningSaldo += mov.tipo === "INGRESO" ? mov.monto : -mov.monto;
    return { ...mov, itemNumber: idx + 1, saldoAcumulado: runningSaldo };
  });

  // ─── Filtros aplicados ──────────────────────────────────────
  const movimientosFiltrados = useMemo(() => {
    return movimientosConSaldo.filter((mov) => {
      const fechaMov = new Date(mov.fecha);
      const fechaLocal = fechaMov.toISOString().split("T")[0];

      // Fecha desde
      if (filtroFechaDesde && fechaLocal < filtroFechaDesde) return false;
      // Fecha hasta
      if (filtroFechaHasta && fechaLocal > filtroFechaHasta) return false;

      // Tipo: INGRESO o EGRESO (los dos tipos que existen en DB)
      if (filtroTipo && mov.tipo !== filtroTipo) return false;

      // Usuario
      if (filtroUsuario && mov.usuario.username !== filtroUsuario) return false;

      // Búsqueda por texto (descripción, usuario, ID, referencia)
      if (filtroBusqueda) {
        const s = filtroBusqueda.toLowerCase();
        const matchDesc = mov.descripcion.toLowerCase().includes(s);
        const matchUser = mov.usuario.username.toLowerCase().includes(s);
        const matchId = mov.id.toString().includes(s);
        const matchVenta = mov.ventaId?.toString().includes(s) ?? false;
        const matchCompra = mov.compraId?.toString().includes(s) ?? false;
        if (!matchDesc && !matchUser && !matchId && !matchVenta && !matchCompra) return false;
      }

      return true;
    });
  }, [movimientosConSaldo, filtroFechaDesde, filtroFechaHasta, filtroTipo, filtroUsuario, filtroBusqueda]);

  const filtrosActivos = [filtroFechaDesde, filtroFechaHasta, filtroTipo, filtroUsuario, filtroBusqueda].filter(Boolean);
  const hayFiltrosActivos = filtrosActivos.length > 0;

  const limpiarFiltros = () => {
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroTipo("");
    setFiltroUsuario("");
    setFiltroBusqueda("");
  };

  // Usuarios únicos para el select
  const usuariosUnicos = useMemo(() => {
    const users = new Set(movimientosConSaldo.map(m => m.usuario.username));
    return Array.from(users).sort();
  }, [movimientosConSaldo]);

  // ─── Totales (SIEMPRE de movimientosConSaldo para el turno completo) ──
  const totalIngresosTurno = movimientosConSaldo
    .filter(m => m.tipo === "INGRESO")
    .reduce((sum, m) => sum + m.monto, 0);
  const totalEgresosTurno = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO")
    .reduce((sum, m) => sum + m.monto, 0);
  const saldoFinalTurno = totalIngresosTurno - totalEgresosTurno;

  // Totales filtrados (cuando hay filtros activos)
  const totalIngresosFiltrado = movimientosFiltrados
    .filter(m => m.tipo === "INGRESO")
    .reduce((sum, m) => sum + m.monto, 0);
  const totalEgresosFiltrado = movimientosFiltrados
    .filter(m => m.tipo === "EGRESO")
    .reduce((sum, m) => sum + m.monto, 0);
  const saldoFinalFiltrado = totalIngresosFiltrado - totalEgresosFiltrado;

  // Subtotales del turno (para el resumen)
  const totalReposiciones = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO" && (m.descripcion.toLowerCase().includes("reposici") || m.descripcion.toLowerCase().includes("stock inicial") || m.compraId))
    .reduce((sum, m) => sum + m.monto, 0);
  const totalGastos = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO" && m.descripcion.toLowerCase().startsWith("gasto:"))
    .reduce((sum, m) => sum + m.monto, 0);

  // ─── Tiempo de turno ────────────────────────────────────────
  const fechaApertura = cajaActiva ? new Date(cajaActiva.fechaApertura) : null;
  const now = new Date();
  const duracionMs = fechaApertura ? now.getTime() - fechaApertura.getTime() : 0;
  const duracionHoras = Math.floor(duracionMs / (1000 * 60 * 60));
  const duracionMinutos = Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60));

  // ─── Exportación ────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Fecha", "Hora", "Descripción", "Tipo", "Usuario", "Ingreso", "Egreso", "Saldo"];
    const rows = movimientosFiltrados.map((mov) => {
      const d = new Date(mov.fecha);
      const fechaStr = d.toLocaleDateString("es-AR");
      const horaStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      const isIncome = mov.tipo === "INGRESO";
      return [
        mov.itemNumber,
        fechaStr,
        horaStr,
        `"${mov.descripcion.replace(/"/g, '""')}"`,
        mov.tipo,
        mov.usuario.username,
        isIncome ? mov.monto.toFixed(2) : "",
        !isIncome ? mov.monto.toFixed(2) : "",
        mov.saldoAcumulado.toFixed(2)
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `libro-diario-caja-${cajaActiva?.id || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── Detalle de Movimiento ──────────────────────────────────
  const openDetalle = (mov: Movimiento & { itemNumber?: number; saldoAcumulado?: number }) => {
    setMovimientoSeleccionado(mov);
    setShowDetalleModal(true);
  };

  // ─── Helper: detectar tipo visual del movimiento ────────────
  const getTipoVisual = (mov: Movimiento) => {
    const descLower = mov.descripcion.toLowerCase();
    if (descLower.startsWith("saldo inicial de apertura")) return { label: "APERTURA", variant: "info" as const };
    if (descLower.startsWith("cierre de caja") || descLower.includes("cierre")) return { label: "CIERRE", variant: "info" as const };
    if (descLower.startsWith("gasto:") || mov.descripcion.startsWith("Gasto:")) return { label: "EGRESO", variant: "danger" as const };
    if (descLower.startsWith("stock inicial") || descLower.includes("stock inicial")) return { label: "REPOSICIÓN", variant: "warning" as const };
    if (descLower.startsWith("reposición") || mov.compraId) return { label: "REPOSICIÓN", variant: "warning" as const };
    if (descLower.startsWith("ajuste") || descLower.includes("ajuste")) return { label: "AJUSTE", variant: "default" as const };
    if (mov.tipo === "EGRESO") return { label: "EGRESO", variant: "danger" as const };
    return { label: "VENTA", variant: "success" as const };
  };

  return (
    <>
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .caja-print-area, .caja-print-area * { visibility: visible !important; }
        .caja-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `}</style>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch h-full min-h-0">
      {/* ═══ SECCIÓN PRINCIPAL (9 cols abierta, 12 cerrada) ═══ */}
      <div className={`${cajaActiva ? "lg:col-span-9" : "lg:col-span-12"} flex flex-col min-h-0 overflow-hidden`}>

        {/* ── CASO A: Caja Cerrada ── */}
        {!cajaActiva ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-8 max-w-xl mx-auto text-center space-y-6 shadow-[var(--shadow-lg)]">
            <div className="inline-flex p-4 rounded-full bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20">
              <Lock size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">Caja Cerrada</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto leading-relaxed">
                Actualmente no hay ninguna caja operativa abierta. Debe abrir la caja con un saldo inicial en efectivo para poder registrar cobros y reposiciones.
              </p>
            </div>
            <form onSubmit={handleAbrir} className="space-y-4 max-w-xs mx-auto">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block text-center">
                  Monto de Apertura (Efectivo)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={montoApertura}
                  onChange={e => setMontoApertura(e.target.value)}
                  className="w-full text-center px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] focus:outline-none focus:border-[var(--brand)] text-lg font-mono font-bold transition-colors"
                  required
                  disabled={isPending}
                />
              </div>
              {errorMsg && (
                <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-[var(--radius-md)] flex items-center justify-center space-x-2">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
              <Button type="submit" className="w-full py-3" disabled={isPending} loading={isPending} leftIcon={<Unlock size={16} />}>
                Abrir Caja de Mostrador
              </Button>
            </form>
          </div>

        /* ── CASO B: Caja Abierta ── */
        ) : (
          <div className="animate-in fade-in duration-200 flex flex-col min-h-0 gap-2">

            {/* ═══ BARRA DE ESTADO ═══ */}
            <div className="no-print bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 flex flex-col items-center gap-1.5 text-xs shadow-[var(--shadow-sm)] shrink-0">
              <div className="flex flex-wrap items-center justify-center gap-2 text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--border)]">
                  <Calendar size={12} className="text-[var(--info)]" />
                  <span className="font-medium text-[11px]">Apertura: <strong className="text-[var(--text)]">{formatDate(cajaActiva.fechaApertura)}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--border)]">
                  <User size={12} className="text-[var(--info)]" />
                  <span className="font-medium text-[11px]">Cajero: <strong className="text-[var(--text)]">@{cajaActiva.usuario.username}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--border)]">
                  <Clock size={12} className="text-[var(--warning)]" />
                  <span className="font-medium text-[11px]">Turno: <strong className="text-[var(--text)]">{duracionHoras}h {duracionMinutos}min</strong></span>
                </span>
                <span className="flex items-center gap-1.5 bg-[var(--panel)] px-2 py-1 rounded border border-[var(--border)]">
                  <Activity size={12} className="text-[var(--success)] animate-pulse" />
                  <span className="font-medium text-[11px]">Estado: <span className="ml-1 px-2 py-0.5 text-[9px] font-black tracking-wider bg-[var(--success-light)] text-[var(--success)] rounded-full uppercase border border-[var(--success)]/20">Abierta</span></span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={handlePrint} leftIcon={<Printer size={12} />} className="px-2.5 py-1 text-[10px] font-semibold">Imprimir</Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} leftIcon={<Download size={12} />} className="px-2.5 py-1 text-[10px] font-semibold">CSV</Button>
                <Button variant="danger" size="sm" onClick={handleCerrar} disabled={isPending} leftIcon={<Lock size={12} />} className="px-4 py-1 text-[10px] font-bold">Cerrar Caja</Button>
              </div>
            </div>

            {/* ═══ BUSCADOR + FILTROS ═══ */}
            <div className="no-print shrink-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Buscar por descripción, factura, usuario o referencia..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition"
                  />
                </div>
                <button
                  onClick={() => setShowFiltros(!showFiltros)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition flex-shrink-0 ${
                    hayFiltrosActivos
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--brand)]"
                  }`}
                >
                  <Filter size={12} />
                  Filtros
                  {hayFiltrosActivos && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[8px] font-black bg-white/20 rounded-full leading-none">
                      {filtrosActivos.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Panel de filtros expandido */}
              {showFiltros && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Fecha Desde</label>
                      <input
                        type="date"
                        value={filtroFechaDesde}
                        onChange={(e) => setFiltroFechaDesde(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Fecha Hasta</label>
                      <input
                        type="date"
                        value={filtroFechaHasta}
                        onChange={(e) => setFiltroFechaHasta(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Tipo</label>
                      <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        <option value="INGRESO">Ingresos</option>
                        <option value="EGRESO">Egresos</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Usuario</label>
                      <select
                        value={filtroUsuario}
                        onChange={(e) => setFiltroUsuario(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        {usuariosUnicos.map((u) => (
                          <option key={u} value={u}>@{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]/50">
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {movimientosFiltrados.length} de {movimientosConSaldo.length} movimientos
                    </span>
                    {hayFiltrosActivos && (
                      <button
                        onClick={limpiarFiltros}
                        className="flex items-center gap-1 text-[10px] text-[var(--danger)] font-semibold hover:underline"
                      >
                        <X size={10} />
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ LIBRO DIARIO + RESUMEN (área de impresión) ═══ */}
            <div className="caja-print-area flex flex-col min-h-0 flex-1">
              <TableShell
                title="Libro Diario"
                isEmpty={movimientosFiltrados.length === 0}
                emptyMessage={hayFiltrosActivos ? "No se encontraron movimientos con estos filtros." : "No se registran movimientos en este turno."}
                emptyIcon={<Activity size={32} className="opacity-40" />}
              >
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                    <thead className="bg-[var(--panel)] text-[var(--text-secondary)] uppercase font-bold text-[10px] tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
                      <tr>
                        <th className="py-1.5 px-2 text-center w-[4%]">#</th>
                        <th className="py-1.5 px-2 w-[10%]">Fecha</th>
                        <th className="py-1.5 px-2 w-[8%]">Hora</th>
                        <th className="py-1.5 px-2 w-[28%]">Descripción</th>
                        <th className="py-1.5 px-2 text-center w-[10%]">Tipo</th>
                        <th className="py-1.5 px-2 w-[10%]">Usuario</th>
                        <th className="py-1.5 px-2 text-right w-[10%]">Ingreso</th>
                        <th className="py-1.5 px-2 text-right w-[10%]">Egreso</th>
                        <th className="py-1.5 px-2 text-right w-[10%]">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60 font-mono text-[11px]">
                      {movimientosFiltrados.map((mov) => {
                        const isIncome = mov.tipo === "INGRESO";
                        const d = new Date(mov.fecha);
                        const fechaStr = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
                        const horaStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                        const visual = getTipoVisual(mov);

                        return (
                          <tr key={mov.id} onClick={() => openDetalle(mov)} className="hover:bg-[var(--brand)]/[0.03] transition-colors cursor-pointer">
                            <td className="py-1 px-2 text-center text-[var(--text-secondary)] font-semibold">{mov.itemNumber}</td>
                            <td className="py-1 px-2 text-[var(--text-muted)]">{fechaStr}</td>
                            <td className="py-1 px-2 text-[var(--text-secondary)]">{horaStr}</td>
                            <td className="py-1 px-2 text-[var(--text)] font-sans whitespace-normal break-words pr-2 leading-tight line-clamp-2" title={mov.descripcion}>{mov.descripcion}</td>
                            <td className="py-1 px-2 text-center">
                              <Badge variant={visual.variant} size="sm" className="px-2 py-0.5 rounded-md font-bold tracking-wide text-[10px] uppercase">
                                {visual.label}
                              </Badge>
                            </td>
                            <td className="py-1 px-2 text-[var(--text-muted)] font-sans">@{mov.usuario.username}</td>
                            <td className="py-1 px-2 text-right text-[var(--success)] font-semibold whitespace-nowrap">
                              {isIncome ? formatCurrency(mov.monto) : "\u2014"}
                            </td>
                            <td className="py-1 px-2 text-right text-[var(--danger)] font-semibold whitespace-nowrap">
                              {!isIncome ? formatCurrency(mov.monto) : "\u2014"}
                            </td>
                            <td className="py-1 px-2 text-right text-[var(--text)] font-bold whitespace-nowrap">
                              {formatCurrency(mov.saldoAcumulado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              </TableShell>

              {/* ═══ RESUMEN INFERIOR ═══ */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 shadow-[var(--shadow-sm)] shrink-0 mt-1">
                {hayFiltrosActivos && (
                  <p className="text-[9px] text-[var(--brand)] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Filter size={9} />
                    Totales según filtros aplicados
                  </p>
                )}
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Movimientos</span>
                    <span className="text-xs font-bold text-[var(--text)]">{movimientosFiltrados.length}{hayFiltrosActivos ? `/${movimientosConSaldo.length}` : ""}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Inicial</span>
                    <span className="text-xs font-extrabold text-[var(--info)] font-mono">{formatCurrency(cajaActiva.montoInicial)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Ventas</span>
                    <span className="text-xs font-extrabold text-[var(--success)] font-mono">{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Reposic.</span>
                    <span className="text-xs font-extrabold text-[var(--warning)] font-mono">{formatCurrency(totalReposiciones)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Gastos</span>
                    <span className="text-xs font-extrabold text-[var(--danger)] font-mono">{formatCurrency(totalGastos)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Ingresos</span>
                    <span className="text-xs font-extrabold text-[var(--success)] font-mono">{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Egresos</span>
                    <span className="text-xs font-extrabold text-[var(--danger)] font-mono">{formatCurrency(hayFiltrosActivos ? totalEgresosFiltrado : totalEgresosTurno)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Saldo Final</span>
                    <span className={`text-xs font-black font-mono ${(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ═══ COLUMNA DERECHA (3 cols) ═══ */}
      {cajaActiva && (
        <div className="no-print lg:col-span-3 flex flex-col gap-2 min-h-0">
          {/* Panel Gasto Manual */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-[var(--shadow-sm)] flex flex-col shrink-0">
            <div className="flex items-center space-x-2 text-[var(--brand)] border-b border-[var(--border)] pb-3">
              <MinusCircle size={16} />
              <h2 className="text-xs font-bold text-[var(--text)]">Registrar Gasto Diario</h2>
            </div>
            <form onSubmit={handleGasto} className="flex-1 flex flex-col justify-between mt-3 space-y-3">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Concepto del Gasto</label>
                  <Input name="descripcion" placeholder="Ej: Artículos de limpieza, Viáticos..." value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} required disabled={isPending} className="w-full text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Monto ($)</label>
                  <Input name="monto" type="number" placeholder="0.00" value={gastoMonto} onChange={e => setGastoMonto(e.target.value)} className="font-mono font-bold text-xs" required disabled={isPending} />
                </div>
                {errorMsg && (
                  <div className="p-2 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-[10px] font-semibold rounded-lg flex items-center justify-center space-x-1.5">
                    <AlertTriangle size={12} />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
              <Button type="submit" variant="danger" className="w-full py-2.5 bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(239,68,68,0.2)] flex items-center justify-center space-x-2 text-xs" disabled={isPending} loading={isPending} leftIcon={<PlusCircle size={14} />}>
                {isPending ? "Registrando..." : "Registrar Egreso"}
              </Button>
            </form>
          </div>

          {/* Historial de Arqueos */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-[var(--shadow-sm)] flex-1 min-h-[160px] max-h-[calc(100vh-34rem)] flex flex-col">
            <div className="flex items-center space-x-2 text-[var(--brand)] border-b border-[var(--border)] pb-3">
              <History size={16} />
              <h2 className="text-xs font-bold text-[var(--text)]">Historial de Arqueos</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1 scrollbar-hide">
              {historialCajas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <History size={24} className="text-[var(--text-secondary)] opacity-40 mb-1" />
                  <p className="text-[10px] text-[var(--text-secondary)]">No hay registros de arqueos.</p>
                </div>
              ) : (
                historialCajas.map(hc => {
                  const totalCaja = hc.montoInicial + hc.totalVentas;
                  return (
                    <div key={hc.id} className="p-3 bg-[var(--panel)]/50 border border-[var(--border)] rounded-xl space-y-2 hover:border-[var(--border-hover)] transition-all">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-[var(--text)]">Caja #{hc.id.toString().padStart(4, "0")}</span>
                        <span className="px-2 py-0.5 text-[8px] font-extrabold bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/10 rounded-full uppercase">{hc.estado}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-[var(--text-muted)]">
                        <div>
                          <span className="text-[9px] text-[var(--text-secondary)] block">Cierre</span>
                          <span className="font-semibold text-[var(--text)]">{hc.fechaCierre ? formatDate(hc.fechaCierre).split(" ")[0] : "N/D"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--text-secondary)] block">Cajero</span>
                          <span className="font-semibold text-[var(--text)]">@{hc.usuario.username}</span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-[var(--border)]/60 flex justify-between items-center text-[10px]">
                        <span className="text-[var(--text-secondary)] font-semibold">Total Arqueo:</span>
                        <span className="font-mono font-bold text-[var(--success)] text-xs">{formatCurrency(totalCaja)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Modales */}
    {cajaActiva && (
      <ConfirmarCierreModal
        open={showCerrarModal}
        onClose={() => !isPending && setShowCerrarModal(false)}
        onConfirm={confirmarCierre}
        isPending={isPending}
        montoInicial={cajaActiva.montoInicial}
        totalVentas={cajaActiva.totalVentas}
        totalIngresos={totalIngresosTurno}
        totalEgresos={totalEgresosTurno}
      />
    )}

    <MovimientoDetalleModal
      open={showDetalleModal}
      onClose={() => { setShowDetalleModal(false); setMovimientoSeleccionado(null); }}
      movimiento={movimientoSeleccionado}
    />
    </>
  );
}
