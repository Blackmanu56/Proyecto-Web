"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCaja,
  cerrarCaja,
  registrarGastoCaja
} from "@/actions/caja";
import ConfirmarCierreModal from "@/components/ui/ConfirmarCierreModal";
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
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  History,
  TrendingUp,
  Receipt,
  ShoppingBag,
  TrendingDown,
  Wallet
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

  // Estados del Formulario
  const [montoApertura, setMontoApertura] = useState("");
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");

  const [showCerrarModal, setShowCerrarModal] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  // Acciones
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
      if (res.success) {
        setMontoApertura("");
        router.refresh();
      } else {
        setErrorMsg(res.error || "Ocurrió un error al abrir la caja.");
      }
    });
  };

  const handleCerrar = () => {
    if (!cajaActiva) return;
    setShowCerrarModal(true);
  };

  const confirmarCierre = () => {
    if (!cajaActiva) return;

    startTransition(async () => {
      const res = await cerrarCaja(cajaActiva.id);
      if (res.success) {
        router.refresh();
      } else {
        setErrorMsg(res.error || "Error al cerrar la caja.");
        setShowCerrarModal(false);
      }
    });
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
        router.refresh();
      } else {
        setErrorMsg(res.error || "Error al registrar el gasto.");
      }
    });
  };

  const saldoActual = cajaActiva
    ? cajaActiva.montoInicial + cajaActiva.totalVentas
    : 0;

  // ─── Libro Diario Table Calculations ────────────────────────────
  const movimientosOrdenados = cajaActiva
    ? [...cajaActiva.movimientos].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      )
    : [];

  let runningSaldo = 0;
  const movimientosConSaldo = movimientosOrdenados.map((mov, idx) => {
    if (mov.tipo === "INGRESO") {
      runningSaldo += mov.monto;
    } else {
      runningSaldo -= mov.monto;
    }
    return {
      ...mov,
      itemNumber: idx + 1,
      saldoAcumulado: runningSaldo,
    };
  });

  // Calculate totals for the footer
  const totalIngresos = movimientosOrdenados
    .filter((m) => m.tipo === "INGRESO")
    .reduce((sum, m) => sum + m.monto, 0);

  const totalEgresos = movimientosOrdenados
    .filter((m) => m.tipo === "EGRESO")
    .reduce((sum, m) => sum + m.monto, 0);

  const saldoFinalCalculado = totalIngresos - totalEgresos;

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
      {/* SECCIÓN CAJA ACTIVA (9 COLS si está abierta, o 12 COLS si está cerrada) */}
      <div className={`${cajaActiva ? "lg:col-span-9" : "lg:col-span-12"} space-y-6 md:space-y-8`}>
        
        {/* CASO A: Caja Cerrada -> Formulario Apertura */}
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

              <Button
                type="submit"
                className="w-full py-3"
                disabled={isPending}
                loading={isPending}
                leftIcon={<Unlock size={16} />}
              >
                Abrir Caja de Mostrador
              </Button>
            </form>
          </div>
        ) : (
          /* CASO B: Caja Abierta -> Panel Operativo */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Tarjetas de Resumen Financiero */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              {/* Ingresos */}
              <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:-translate-y-1 hover:shadow-md hover:border-[var(--success)]/30 transition-all duration-300">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total Ingresos</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-[var(--success)] font-mono tracking-tight">
                    {formatCurrency(totalIngresos)}
                  </p>
                </div>
                <div className="p-3 bg-[var(--success-light)] rounded-xl text-[var(--success)]">
                  <TrendingUp size={20} />
                </div>
              </div>

              {/* Egresos */}
              <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl flex items-center justify-between shadow-[var(--shadow-sm)] hover:-translate-y-1 hover:shadow-md hover:border-[var(--danger)]/30 transition-all duration-300">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total Egresos</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-[var(--danger)] font-mono tracking-tight">
                    {formatCurrency(totalEgresos)}
                  </p>
                </div>
                <div className="p-3 bg-[var(--danger-light)] rounded-xl text-[var(--danger)]">
                  <TrendingDown size={20} />
                </div>
              </div>

              {/* Balance */}
              <div className="bg-gradient-to-br from-[var(--info)]/10 to-[var(--card)] border border-[var(--info)]/20 p-6 rounded-2xl flex items-center justify-between shadow-[var(--shadow-md)] hover:-translate-y-1 hover:shadow-lg hover:border-[var(--info)]/40 transition-all duration-300">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--info)] font-bold uppercase tracking-wider">Balance en Caja</p>
                  <p className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
                    saldoFinalCalculado >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}>
                    {formatCurrency(saldoFinalCalculado)}
                  </p>
                </div>
                <div className="p-3 bg-[var(--info-light)] rounded-xl text-[var(--info)]">
                  <Wallet size={20} />
                </div>
              </div>
            </div>

            {/* 2. Metadata Caja Abierta */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 md:py-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sm shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-[var(--text-muted)]">
                <span className="flex items-center space-x-2 bg-[var(--panel)] px-3 py-2 rounded-xl border border-[var(--border)]">
                  <Calendar size={16} className="text-[var(--info)]" />
                  <span className="font-medium text-xs">Apertura: <strong className="text-[var(--text)]">{formatDate(cajaActiva.fechaApertura)}</strong></span>
                </span>
                <span className="flex items-center space-x-2 bg-[var(--panel)] px-3 py-2 rounded-xl border border-[var(--border)]">
                  <User size={16} className="text-[var(--info)]" />
                  <span className="font-medium text-xs">Cajero: <strong className="text-[var(--text)]">@{cajaActiva.usuario.username}</strong></span>
                </span>
                <span className="flex items-center space-x-2 bg-[var(--panel)] px-3 py-2 rounded-xl border border-[var(--border)]">
                  <Activity size={16} className="text-[var(--success)] animate-pulse" />
                  <span className="font-medium text-xs">Estado: <span className="ml-1 px-2.5 py-0.5 text-[10px] font-black tracking-wider bg-[var(--success-light)] text-[var(--success)] rounded-full uppercase border border-[var(--success)]/20 shadow-[0_0_8px_rgba(34,197,94,0.15)]">Abierta</span></span>
                </span>
              </div>
              <Button
                variant="danger"
                size="md"
                onClick={handleCerrar}
                disabled={isPending}
                leftIcon={<Lock size={14} />}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(239,68,68,0.25)] flex items-center justify-center space-x-2"
              >
                Cerrar Caja
              </Button>
            </div>

            {/* 3. Libro Diario - Control de Caja */}
            <TableShell
              title="Libro Diario (Movimientos del Turno)"
              isEmpty={cajaActiva.movimientos.length === 0}
              emptyMessage="No se registran movimientos en este turno."
              emptyIcon={<Activity size={40} className="opacity-40" />}
            >
              <div className="space-y-6">
                {/* Table Container - sin scroll horizontal y con altura extendida */}
                <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] max-h-[520px] overflow-y-auto shadow-inner">
                  <table className="w-full text-xs text-left border-collapse table-fixed min-w-[700px]">
                    <thead className="bg-[var(--panel)] text-[var(--text-secondary)] uppercase font-bold text-[9px] tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-2 text-center w-[5%]">ID</th>
                        <th className="py-3 px-2 w-[11%]">Fecha</th>
                        <th className="py-3 px-2 w-[9%]">Hora</th>
                        <th className="py-3 px-2 w-[30%]">Descripción</th>
                        <th className="py-3 px-2 text-center w-[12%]">Tipo</th>
                        <th className="py-3 px-2 w-[9%]">Usuario</th>
                        <th className="py-3 px-2 text-right w-[11%]">Ingreso</th>
                        <th className="py-3 px-2 text-right w-[11%]">Egreso</th>
                        <th className="py-3 px-2 text-right w-[12%]">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60 font-mono text-[11px]">
                      {movimientosConSaldo.map((mov) => {
                        const isIncome = mov.tipo === "INGRESO";
                        const d = new Date(mov.fecha);
                        const fechaStr = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
                        const horaStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
 
                        // Determinar el tipo de operación y su estilo (únicamente visual)
                        let tipoOperacion = "VENTA";
                        let badgeVariant: "success" | "danger" | "info" | "warning" | "default" = "success";
 
                        const descLower = mov.descripcion.toLowerCase();
 
                        if (descLower.startsWith("saldo inicial de apertura")) {
                          tipoOperacion = "APERTURA";
                          badgeVariant = "info";
                        } else if (descLower.startsWith("cierre de caja") || descLower.includes("cierre")) {
                          tipoOperacion = "CIERRE";
                          badgeVariant = "info";
                        } else if (descLower.startsWith("gasto:") || mov.descripcion.startsWith("Gasto:")) {
                          tipoOperacion = "EGRESO";
                          badgeVariant = "danger";
                        } else if (descLower.startsWith("stock inicial") || descLower.includes("stock inicial")) {
                          tipoOperacion = "REPOSICIÓN";
                          badgeVariant = "warning";
                        } else if (descLower.startsWith("reposición") || mov.compraId) {
                          tipoOperacion = "REPOSICIÓN";
                          badgeVariant = "warning";
                        } else if (descLower.startsWith("ajuste") || descLower.includes("ajuste")) {
                          tipoOperacion = "AJUSTE";
                          badgeVariant = "default";
                        } else if (mov.tipo === "EGRESO") {
                          tipoOperacion = "EGRESO";
                          badgeVariant = "danger";
                        } else if (mov.tipo === "INGRESO") {
                          tipoOperacion = "VENTA";
                          badgeVariant = "success";
                        }
 
                        return (
                          <tr key={mov.id} className="hover:bg-[var(--card)]/40 transition-colors">
                            <td className="py-2.5 px-2 text-center text-[var(--text-secondary)] font-semibold">{mov.itemNumber}</td>
                            <td className="py-2.5 px-2 text-[var(--text-muted)]">{fechaStr}</td>
                            <td className="py-2.5 px-2 text-[var(--text-secondary)]">{horaStr}</td>
                            <td className="py-2.5 px-2 text-[var(--text)] font-sans whitespace-normal break-words pr-2 leading-relaxed" title={mov.descripcion}>{mov.descripcion}</td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant={badgeVariant} size="sm" className="px-2 py-0.5 rounded-md font-bold tracking-wide text-[9px] uppercase">
                                {tipoOperacion}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-2 text-[var(--text-muted)] font-sans">@{mov.usuario.username}</td>
                            <td className="py-2.5 px-2 text-right text-[var(--success)] font-semibold whitespace-nowrap">
                              {isIncome ? formatCurrency(mov.monto) : "-"}
                            </td>
                            <td className="py-2.5 px-2 text-right text-[var(--danger)] font-semibold whitespace-nowrap">
                              {!isIncome ? formatCurrency(mov.monto) : "-"}
                            </td>
                            <td className="py-2.5 px-2 text-right text-[var(--text)] font-bold whitespace-nowrap">
                              {formatCurrency(mov.saldoAcumulado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
 
                {/* Summary Pie de Tabla */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs shadow-[var(--shadow-sm)]">
                  <div className="space-y-0.5 border-r border-[var(--border)]/60 pr-2">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Movimientos</span>
                    <span className="text-sm font-bold text-[var(--text)]">{movimientosOrdenados.length} Registrados</span>
                  </div>
                  <div className="space-y-0.5 border-r border-[var(--border)]/60 pr-2">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Total Ingresos</span>
                    <span className="text-sm font-extrabold text-[var(--success)] font-mono">
                      {formatCurrency(totalIngresos)}
                    </span>
                  </div>
                  <div className="space-y-0.5 border-r border-[var(--border)]/60 pr-2">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Total Egresos</span>
                    <span className="text-sm font-extrabold text-[var(--danger)] font-mono">
                      {formatCurrency(totalEgresos)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Saldo Final Turno</span>
                    <span className={`text-sm font-black font-mono ${
                      saldoFinalCalculado >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}>
                      {formatCurrency(saldoFinalCalculado)}
                    </span>
                  </div>
                </div>
              </div>
            </TableShell>
          </div>
        )}
      </div>

      {/* SECCIÓN DERECHA: Registrar Egresos Manuales (Solo si Caja está abierta, 3 COLS) */}
      {cajaActiva && (
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          {/* Panel Gasto Manual */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] h-[320px] flex flex-col justify-between hover:border-[var(--border-hover)] transition-all duration-300">
            <div className="flex items-center space-x-2 text-[var(--brand)] border-b border-[var(--border)] pb-3">
              <MinusCircle size={18} />
              <h2 className="text-xs font-bold text-[var(--text)]">Registrar Gasto Diario</h2>
            </div>

            <form onSubmit={handleGasto} className="flex-1 flex flex-col justify-between mt-3 space-y-3">
              <div className="space-y-3">
                {/* Campo Descripción */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Concepto del Gasto
                  </label>
                  <Input
                    name="descripcion"
                    placeholder="Ej: Artículos de limpieza, Viáticos..."
                    value={gastoDesc}
                    onChange={e => setGastoDesc(e.target.value)}
                    required
                    disabled={isPending}
                    className="w-full text-xs"
                  />
                </div>

                {/* Campo Monto */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Monto ($)
                  </label>
                  <Input
                    name="monto"
                    type="number"
                    placeholder="0.00"
                    value={gastoMonto}
                    onChange={e => setGastoMonto(e.target.value)}
                    className="font-mono font-bold text-xs"
                    required
                    disabled={isPending}
                  />
                </div>

                {errorMsg && (
                  <div className="p-2 bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-[10px] font-semibold rounded-lg flex items-center justify-center space-x-1.5">
                    <AlertTriangle size={12} />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="danger"
                className="w-full py-2.5 bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(239,68,68,0.2)] flex items-center justify-center space-x-2 text-xs"
                disabled={isPending}
                loading={isPending}
                leftIcon={<PlusCircle size={14} />}
              >
                {isPending ? "Registrando..." : "Registrar Egreso"}
              </Button>
            </form>
          </div>

          {/* Historial de Cajas Cerradas */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] h-[320px] flex flex-col justify-between hover:border-[var(--border-hover)] transition-all duration-300">
            <div className="flex items-center space-x-2 text-[var(--brand)] border-b border-[var(--border)] pb-3">
              <History size={16} />
              <h2 className="text-xs font-bold text-[var(--text)]">Historial de Arqueos</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1 scrollbar-hide">
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
                        <span className="px-2 py-0.5 text-[8px] font-extrabold bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/10 rounded-full uppercase">
                          {hc.estado}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-[var(--text-muted)]">
                        <div>
                          <span className="text-[9px] text-[var(--text-secondary)] block">Fecha de Cierre</span>
                          <span className="font-semibold text-[var(--text)]">{hc.fechaCierre ? formatDate(hc.fechaCierre).split(" ")[0] : "N/D"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--text-secondary)] block">Cajero</span>
                          <span className="font-semibold text-[var(--text)]">@{hc.usuario.username}</span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-[var(--border)]/60 flex justify-between items-center text-[10px]">
                        <span className="text-[var(--text-secondary)] font-semibold">Total Arqueo:</span>
                        <span className="font-mono font-bold text-[var(--success)] text-xs">
                          {formatCurrency(totalCaja)}
                        </span>
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

      {cajaActiva && (
        <ConfirmarCierreModal
          open={showCerrarModal}
          onClose={() => !isPending && setShowCerrarModal(false)}
          onConfirm={confirmarCierre}
          isPending={isPending}
          montoInicial={cajaActiva.montoInicial}
          totalVentas={cajaActiva.totalVentas}
          totalIngresos={totalIngresos}
          totalEgresos={totalEgresos}
        />
      )}
    </>
  );
}
