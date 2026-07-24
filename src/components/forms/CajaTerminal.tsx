"use client";

import {
abrirCaja,
cerrarCaja,
registrarGastoCaja
} from "@/actions/caja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmarCierreModal from "@/components/ui/ConfirmarCierreModal";
import { Input } from "@/components/ui/input";
import MovimientoDetalleModal from "@/components/ui/MovimientoDetalleModal";
import { TableShell } from "@/components/ui/table-shell";
import {
calcularTotales,
enrichMovimientos,
filtrarMovimientos,
getTipoVisual,
getUsuariosUnicos,
type MovimientoEnriched
} from "@/lib/caja-filters";
import { formatCurrency,formatDate,formatDateShort,formatTime24 } from "@/lib/utils";
import { isSameDay } from "date-fns";
import {
Activity,
AlertCircle,
AlertTriangle,
Calendar,
Clock,
Download,
Filter,
History,
Lock,
MinusCircle,
PlusCircle,
Printer,
RotateCcw,
Search,
Unlock,
User,
X
} from "lucide-react";
import { useRouter } from "next/navigation";
import React,{ useEffect,useMemo,useState,useTransition } from "react";

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date;
  usuario: { username: string; nombreCompleto?: string };
  ventaId?: number | null;
  compraId?: number | null;
}

interface CajaActiva {
  id: number;
  montoInicial: number;
  totalVentas: number;
  fechaApertura: Date;
  estado: string;
  usuario: { username: string; nombreCompleto?: string };
  movimientos: Movimiento[];
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
}

export default function CajaTerminal({
  cajaActiva,
  historialCajas,
  user,
}: CajaTerminalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [montoApertura, setMontoApertura] = useState("");
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [aperturaCompletada, setAperturaCompletada] = useState(false);

  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<MovimientoEnriched | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [cierreErrorMsg, setCierreErrorMsg] = useState("");

  const [filtroNaturaleza, setFiltroNaturaleza] = useState("");
  const [filtroConcepto, setFiltroConcepto] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!cajaActiva) return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [cajaActiva]);

  const dayChanged = useMemo(() => {
    if (!cajaActiva) return false;
    return !isSameDay(new Date(cajaActiva.fechaApertura), now);
  }, [cajaActiva, now]);

  const fechaApertura = cajaActiva ? new Date(cajaActiva.fechaApertura) : null;
  const duracionMins = fechaApertura ? Math.max(0, Math.floor((now.getTime() - fechaApertura.getTime()) / 60000)) : 0;
  const duracionHoras = Math.floor(duracionMins / 60);
  const duracionMinutos = duracionMins % 60;
  const duracionStr = `${String(duracionHoras).padStart(2, "0")}h ${String(duracionMinutos).padStart(2, "0")}m`;

  const handleAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setAperturaCompletada(false);
    const monto = Number(montoApertura);
    if (isNaN(monto) || monto < 0) {
      setErrorMsg("Ingrese un monto inicial válido.");
      return;
    }
    startTransition(async () => {
      const res = await abrirCaja(monto);
      if (res.success) {
        setMontoApertura("");
        setAperturaCompletada(true);
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

  const confirmarCierre = () => {
    if (!cajaActiva) return;
    setCierreErrorMsg("");
    startTransition(async () => {
      const res = await cerrarCaja(cajaActiva.id);
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
      if (res.success) { setGastoDesc(""); setGastoMonto(""); router.refresh(); }
      else { setErrorMsg(res.error || "Error al registrar el gasto."); }
    });
  };

  const movimientosConSaldo = useMemo(
    () => enrichMovimientos(cajaActiva?.movimientos ?? null),
    [cajaActiva]
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

  const totalIngresosFiltrado = totalesFiltrado.totalIngresos;
  const totalEgresosFiltrado = totalesFiltrado.totalEgresos;
  const saldoFinalFiltrado = totalesFiltrado.saldoFinal;

  const totalReposiciones = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO" && ((m.descripcion || "").toLowerCase().includes("reposici") || (m.descripcion || "").toLowerCase().includes("stock inicial") || m.compraId))
    .reduce((sum, m) => sum + m.monto, 0);
  const totalGastos = movimientosConSaldo
    .filter(m => m.tipo === "EGRESO" && m.descripcion.toLowerCase().startsWith("gasto:"))
    .reduce((sum, m) => sum + m.monto, 0);

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

    lines.push("N°;Fecha;Hora;Descripción;Tipo;Usuario;Ingreso;Egreso;Saldo");

    const movimientos = movimientosFiltrados;
    for (const mov of movimientos) {
      const d = new Date(mov.fecha);
      const fechaStr = formatDateShort(d);
      const horaStr = formatTime24(d);
      const isIncome = mov.tipo === "INGRESO";
      const ingreso = isIncome ? formatCurrency(mov.monto) : "";
      const egreso = !isIncome ? formatCurrency(mov.monto) : "";
      const saldo = formatCurrency(mov.saldoAcumulado);
      const desc = mov.descripcion.replace(/"/g, '""');

      lines.push(`${mov.itemNumber};${fechaStr};${horaStr};"${desc}";${mov.tipo};@${mov.usuario.username};${ingreso};${egreso};${saldo}`);
    }

    lines.push("");
    lines.push("RESUMEN");
    lines.push(`Movimientos: ${movimientos.length}`);
    lines.push(`Saldo Inicial: ${formatCurrency(cajaActiva.montoInicial)}`);
    lines.push(`Ventas: ${formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}`);
    lines.push(`Reposiciones: ${formatCurrency(totalReposiciones)}`);
    lines.push(`Gastos: ${formatCurrency(totalGastos)}`);
    lines.push(`Ingresos: ${formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}`);
    lines.push(`Egresos: ${formatCurrency(hayFiltrosActivos ? totalEgresosFiltrado : totalEgresosTurno)}`);
    lines.push(`Saldo Final: ${formatCurrency(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno)}`);
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

  const openDetalle = (mov: MovimientoEnriched) => {
    setMovimientoSeleccionado(mov);
    setShowDetalleModal(true);
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch h-full min-h-0">
      {/* ═══ SECCIÓN PRINCIPAL ═══ */}
      <div className={`${cajaActiva ? "lg:col-span-9" : "lg:col-span-12"} flex flex-col min-h-0 overflow-hidden`}>

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
          <div className="animate-in fade-in duration-200 flex flex-col min-h-0 gap-2">

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
                  <span className="font-medium">Sesión: <strong className="text-[var(--text)]">{user?.nombreCompleto || user?.username || cajaActiva.usuario.nombreCompleto || cajaActiva.usuario.username}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Clock size={14} className="text-[var(--warning)]" />
                  <span className="font-medium">Abierta hace <span className="font-mono">{duracionStr}</span></span>
                </span>
                <Badge variant="success" size="sm" className="uppercase font-black tracking-wider">Abierta</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={handlePrint} leftIcon={<Printer size={14} />}>Imprimir</Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} leftIcon={<Download size={14} />}>CSV</Button>
                <Button variant="danger" size="sm" onClick={handleCerrar} disabled={isPending} leftIcon={<Lock size={14} />}>Cerrar Caja</Button>
              </div>
            </div>

            {/* ═══ BUSCADOR + FILTROS ═══ */}
            <div className="shrink-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Buscar por descripción, factura, usuario o referencia..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition"
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
                <button
                  onClick={() => setShowFiltros(!showFiltros)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold transition flex-shrink-0 ${
                    hayFiltrosActivos
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--brand)]"
                  }`}
                >
                  <Filter size={14} />
                  Filtros
                  {hayFiltrosActivos && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-black bg-white/20 rounded-full leading-none">
                      {filtrosActivos.length}
                    </span>
                  )}
                </button>
                {hayFiltrosActivos && (
                  <button
                    onClick={limpiarFiltros}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-light)] text-[var(--danger)] text-sm font-semibold transition flex-shrink-0 hover:bg-[var(--danger)]/10"
                  >
                    <RotateCcw size={14} />
                    Limpiar
                  </button>
                )}
              </div>

              {showFiltros && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Naturaleza */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Naturaleza</label>
                      <select
                        value={filtroNaturaleza}
                        onChange={(e) => setFiltroNaturaleza(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        <option value="INGRESO">Ingresos</option>
                        <option value="EGRESO">Egresos</option>
                      </select>
                    </div>

                    {/* Concepto */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Concepto</label>
                      <select
                        value={filtroConcepto}
                        onChange={(e) => setFiltroConcepto(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        <option value="VENTA">Ventas</option>
                        <option value="REPOSICION">Reposiciones</option>
                        <option value="GASTO">Gastos varios</option>
                        <option value="APERTURA">Apertura</option>
                      </select>
                    </div>

                    {/* Usuario */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Usuario</label>
                      <select
                        value={filtroUsuario}
                        onChange={(e) => setFiltroUsuario(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        {usuariosConNombre.map((u) => (
                          <option key={u.username} value={u.username}>{u.nombreCompleto}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]/50">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {movimientosFiltrados.length} de {movimientosConSaldo.length} movimientos
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ LIBRO DIARIO + RESUMEN ═══ */}
            <div className="flex flex-col min-h-0 flex-1">
              <TableShell
                title="Libro Diario"
                isEmpty={movimientosFiltrados.length === 0}
                emptyMessage={hayFiltrosActivos ? "No se encontraron movimientos con estos filtros." : "No se registran movimientos en este turno."}
                emptyIcon={<Activity size={32} className="opacity-40" />}
              >
                <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                    <thead className="bg-[var(--panel)] text-[var(--text-secondary)] uppercase font-semibold text-xs tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3 text-center w-[4%]">#</th>
                        <th className="py-3 px-3 w-[10%]">Fecha</th>
                        <th className="py-3 px-3 w-[8%]">Hora</th>
                        <th className="py-3 px-3 w-[28%]">Descripción</th>
                        <th className="py-3 px-3 text-center w-[10%]">Tipo</th>
                        <th className="py-3 px-3 w-[10%]">Usuario</th>
                        <th className="py-3 px-3 text-right w-[10%]">Ingreso</th>
                        <th className="py-3 px-3 text-right w-[10%]">Egreso</th>
                        <th className="py-3 px-3 text-right w-[10%]">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                      {movimientosFiltrados.map((mov) => {
                        const isIncome = mov.tipo === "INGRESO";
                        const d = new Date(mov.fecha);
                        const fechaStr = formatDateShort(d);
                        const horaStr = formatTime24(d);
                        const visual = getTipoVisual(mov);

                        return (
                          <tr key={mov.id} onClick={() => openDetalle(mov)} className="hover:bg-[var(--brand)]/[0.03] transition-colors cursor-pointer">
                            <td className="py-3 px-3 text-center text-[var(--text-secondary)] font-semibold">{mov.itemNumber}</td>
                            <td className="py-3 px-3 text-[var(--text-muted)]">{fechaStr}</td>
                            <td className="py-3 px-3 text-[var(--text-secondary)]">{horaStr}</td>
                            <td className="py-3 px-3 text-[var(--text)] font-sans whitespace-normal break-words pr-2 leading-tight line-clamp-2" title={mov.descripcion}>{mov.descripcion}</td>
                            <td className="py-3 px-3 text-center">
                              <Badge variant={visual.variant} size="sm">
                                {visual.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-[var(--text-muted)] font-sans" title={mov.usuario.nombreCompleto || undefined}>@{mov.usuario.username}</td>
                            <td className="py-3 px-3 text-right text-[var(--success)] font-semibold whitespace-nowrap">
                              {isIncome ? formatCurrency(mov.monto) : "\u2014"}
                            </td>
                            <td className="py-3 px-3 text-right text-[var(--danger)] font-semibold whitespace-nowrap">
                              {!isIncome ? formatCurrency(mov.monto) : "\u2014"}
                            </td>
                            <td className="py-3 px-3 text-right text-[var(--text)] font-bold whitespace-nowrap">
                              {formatCurrency(mov.saldoAcumulado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              </TableShell>

              {/* ═══ RESUMEN INFERIOR ═══ */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-[var(--shadow-sm)] shrink-0 mt-2">
                {hayFiltrosActivos && (
                  <p className="text-xs text-[var(--brand)] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Filter size={12} />
                    Totales según filtros aplicados
                  </p>
                )}
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Movimientos</span>
                    <span className="text-sm font-bold text-[var(--text)]">{movimientosFiltrados.length}{hayFiltrosActivos ? `/${movimientosConSaldo.length}` : ""}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Inicial</span>
                    <span className="text-sm font-bold text-[var(--info)] font-mono">{formatCurrency(cajaActiva.montoInicial)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Ventas</span>
                    <span className="text-sm font-bold text-[var(--success)] font-mono">{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Reposic.</span>
                    <span className="text-sm font-bold text-[var(--warning)] font-mono">{formatCurrency(totalReposiciones)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Gastos</span>
                    <span className="text-sm font-bold text-[var(--danger)] font-mono">{formatCurrency(totalGastos)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Ingresos</span>
                    <span className="text-sm font-bold text-[var(--success)] font-mono">{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider block">Egresos</span>
                    <span className="text-sm font-bold text-[var(--danger)] font-mono">{formatCurrency(hayFiltrosActivos ? totalEgresosFiltrado : totalEgresosTurno)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--brand)] font-bold uppercase tracking-wider block">Saldo Final</span>
                    <span className={`text-lg font-black font-mono ${(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ═══ COLUMNA DERECHA ═══ */}
      {cajaActiva && (
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0">
          {/* Panel Gasto Manual */}
          <div className={`bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-[var(--shadow-sm)] flex flex-col shrink-0 ${dayChanged ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center space-x-2.5 text-[var(--brand)] border-b border-[var(--border)] pb-3 mb-3">
              <MinusCircle size={18} />
              <h2 className="text-sm font-bold text-[var(--text)]">Registrar Gasto Diario</h2>
            </div>
            {dayChanged ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-[var(--text-secondary)] text-center">Cierre pendiente del día anterior</p>
              </div>
            ) : (
            <form onSubmit={handleGasto} className="flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Concepto del Gasto</label>
                  <Input name="descripcion" placeholder="Ej: Artículos de limpieza, Viáticos..." value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} required disabled={isPending} className="w-full text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Monto ($)</label>
                  <Input name="monto" type="number" placeholder="0.00" value={gastoMonto} onChange={e => setGastoMonto(e.target.value)} className="font-mono font-bold text-sm" required disabled={isPending} />
                </div>
                {errorMsg && (
                  <div className="p-2.5 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5">
                    <AlertTriangle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
              <Button type="submit" variant="danger" className="w-full py-3" disabled={isPending} loading={isPending} leftIcon={<PlusCircle size={16} />}>
                {isPending ? "Registrando..." : "Registrar Egreso"}
              </Button>
            </form>
            )}
          </div>

          {/* Historial de Arqueos */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-[var(--shadow-sm)] flex-1 min-h-[160px] max-h-[calc(100vh-34rem)] flex flex-col">
            <div className="flex items-center space-x-2.5 text-[var(--brand)] border-b border-[var(--border)] pb-3 mb-3">
              <History size={18} />
              <h2 className="text-sm font-bold text-[var(--text)]">Historial de Arqueos</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-hide">
              {historialCajas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <History size={24} className="text-[var(--text-secondary)] opacity-40 mb-1" />
                  <p className="text-xs text-[var(--text-secondary)]">No hay registros de arqueos.</p>
                </div>
              ) : (
                historialCajas.map(hc => {
                  const totalCaja = hc.montoInicial + hc.totalVentas;
                  return (
                    <div key={hc.id} className="p-3 bg-[var(--panel)]/50 border border-[var(--border)] rounded-xl space-y-2 hover:border-[var(--border-hover)] transition-all">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-[var(--text)]">Caja #{hc.id.toString().padStart(4, "0")}</span>
                        <Badge variant={hc.estado === "ABIERTA" ? "success" : "default"} size="sm">{hc.estado}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-[var(--text-muted)]">
                        <div>
                          <span className="text-[10px] text-[var(--text-secondary)] block">Cierre</span>
                          <span className="font-semibold text-[var(--text)]">{hc.fechaCierre ? formatDate(hc.fechaCierre) : "N/D"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-secondary)] block">Cajero</span>
                          <span className="font-semibold text-[var(--text)]">{hc.usuario.nombreCompleto || hc.usuario.username}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]/60 flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)] font-semibold">Saldo al cierre:</span>
                        <span className="font-mono font-bold text-[var(--success)]">{formatCurrency(totalCaja)}</span>
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

    {/* ═══ REPORTE OCULTO PARA IMPRESIÓN ═══ */}
    {cajaActiva && (
      <div id="caja-print-report" className="caja-print-source">

        <div className="cj-header">
          {/* eslint-disable-next-line @next/next/no-img-element -- Logo de reporte imprimible: el HTML de impresion necesita la ruta directa sin wrapper de next/image. */}
          <img src="/logo.png" alt="Logo de Chopper Repuestos" className="cj-logo" />
          <div className="cj-header-center">
            <div className="cj-title">Libro Diario de Caja</div>
            <div className="cj-subtitle">Chopper Repuestos — Sistema de Gestión Integral</div>
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
            <div className="cj-meta-value">{cajaActiva.usuario.nombreCompleto || cajaActiva.usuario.username} (@{cajaActiva.usuario.username})</div>
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
            <div className="cj-meta-value">{movimientosFiltrados.length}{hayFiltrosActivos ? ` / ${movimientosConSaldo.length}` : ""}</div>
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
            {filtroUsuario && ` | Usuario: @${filtroUsuario}`}
            {filtroBusqueda && ` | Búsqueda: "${filtroBusqueda}"`}
          </div>
        )}

        <table className="cj-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-fecha">Fecha</th>
              <th className="col-hora">Hora</th>
              <th className="col-desc">Descripción</th>
              <th className="col-tipo">Tipo</th>
              <th className="col-user">Usuario</th>
              <th className="col-ing">Ingreso</th>
              <th className="col-egr">Egreso</th>
              <th className="col-saldo">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.map((mov) => {
              const isIncome = mov.tipo === "INGRESO";
              const d = new Date(mov.fecha);
              const fechaStr = formatDateShort(d);
              const horaStr = formatTime24(d);
              const visual = getTipoVisual(mov);
              const badgeClass = visual.variant === "success" ? "badge-success" : visual.variant === "danger" ? "badge-danger" : visual.variant === "warning" ? "badge-warning" : visual.variant === "info" ? "badge-info" : "badge-default";

              return (
                <tr key={mov.id}>
                  <td className="col-num text-center">{mov.itemNumber}</td>
                  <td className="col-fecha">{fechaStr}</td>
                  <td className="col-hora">{horaStr}</td>
                  <td className="col-desc">{mov.descripcion}</td>
                  <td className="col-tipo text-center"><span className={`badge ${badgeClass}`}>{visual.label}</span></td>
                  <td className="col-user">@{mov.usuario.username}</td>
                  <td className="col-ing text-right font-bold text-green">{isIncome ? formatCurrency(mov.monto) : "—"}</td>
                  <td className="col-egr text-right font-bold text-red">{!isIncome ? formatCurrency(mov.monto) : "—"}</td>
                  <td className="col-saldo text-right font-bold">{formatCurrency(mov.saldoAcumulado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="cj-summary">
          <div className="cj-summary-title">Resumen del Turno</div>
          <div className="cj-summary-grid">
            <div className="cj-summary-item">
              <div className="cj-summary-label">Movimientos</div>
              <div className="cj-summary-value">{movimientosFiltrados.length}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Saldo Inicial</div>
              <div className="cj-summary-value" style={{color:"#0369a1"}}>{formatCurrency(cajaActiva.montoInicial)}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Ventas</div>
              <div className="cj-summary-value" style={{color:"#16a34a"}}>{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Reposiciones</div>
              <div className="cj-summary-value" style={{color:"#d97706"}}>{formatCurrency(totalReposiciones)}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Gastos</div>
              <div className="cj-summary-value" style={{color:"#dc2626"}}>{formatCurrency(totalGastos)}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Ingresos</div>
              <div className="cj-summary-value" style={{color:"#16a34a"}}>{formatCurrency(hayFiltrosActivos ? totalIngresosFiltrado : totalIngresosTurno)}</div>
            </div>
            <div className="cj-summary-item">
              <div className="cj-summary-label">Egresos</div>
              <div className="cj-summary-value" style={{color:"#dc2626"}}>{formatCurrency(hayFiltrosActivos ? totalEgresosFiltrado : totalEgresosTurno)}</div>
            </div>
            <div className="cj-summary-item" style={{borderColor:"#000", borderWidth:"2px"}}>
              <div className="cj-summary-label">Saldo Final</div>
              <div className="cj-summary-value" style={{color:(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno) >= 0 ? "#16a34a" : "#dc2626", fontSize:"13px"}}>{formatCurrency(hayFiltrosActivos ? saldoFinalFiltrado : saldoFinalTurno)}</div>
            </div>
          </div>
        </div>

        <div className="cj-footer">
          Chopper Repuestos — Sistema de Gestión Integral | Generado el {formatDate(new Date())}
        </div>
      </div>
    )}
    </>
  );
}
