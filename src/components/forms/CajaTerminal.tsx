"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCaja,
  cerrarCaja,
  registrarGastoCaja
} from "@/actions/caja";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  ShoppingBag
} from "lucide-react";

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: Date;
  usuario: { username: string };
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

  const handleCerrar = async () => {
    if (!cajaActiva) return;
    const saldoActual = cajaActiva.montoInicial + cajaActiva.totalVentas;
    
    if (
      !confirm(
        `¿Seguro que desea cerrar la caja?\n\n` +
        `Monto inicial: ${formatCurrency(cajaActiva.montoInicial)}\n` +
        `Movimientos netos: ${formatCurrency(cajaActiva.totalVentas)}\n` +
        `Saldo total en caja: ${formatCurrency(saldoActual)}`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await cerrarCaja(cajaActiva.id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* SECCIÓN CAJA ACTIVA (7 COLS si está abierta, o 12 COLS si está cerrada) */}
      <div className={`${cajaActiva ? "lg:col-span-8" : "lg:col-span-12"} space-y-6`}>
        
        {/* CASO A: Caja Cerrada -> Formulario Apertura */}
        {!cajaActiva ? (
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center space-y-6 shadow-2xl">
            <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              <Lock size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Caja Cerrada</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Actualmente no hay ninguna caja operativa abierta. Debe abrir la caja con un saldo inicial en efectivo para poder registrar cobros y reposiciones.
              </p>
            </div>

            <form onSubmit={handleAbrir} className="space-y-4 max-w-xs mx-auto">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                  Monto de Apertura (Efectivo)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={montoApertura}
                  onChange={e => setMontoApertura(e.target.value)}
                  className="w-full text-center px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-lg font-mono font-bold"
                  required
                  disabled={isPending}
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-600 hover:border-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 focus:outline-none transition flex items-center justify-center space-x-2 text-sm"
                disabled={isPending}
              >
                <Unlock size={16} />
                <span>Abrir Caja de Mostrador</span>
              </button>
            </form>
          </div>
        ) : (
          /* CASO B: Caja Abierta -> Panel Operativo */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Tarjetas de Resumen Financiero */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Saldo Inicial */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Apertura (Inicial)</p>
                  <p className="text-lg font-extrabold text-white mt-1 font-mono">
                    {formatCurrency(cajaActiva.montoInicial)}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-800 rounded-xl text-slate-400">
                  <Coins size={18} />
                </div>
              </div>

              {/* Movimientos Netos */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Flujo de Caja (Neto)</p>
                  <p className={`text-lg font-extrabold mt-1 font-mono ${
                    cajaActiva.totalVentas >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {cajaActiva.totalVentas >= 0 ? "+" : ""}{formatCurrency(cajaActiva.totalVentas)}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${
                  cajaActiva.totalVentas >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {cajaActiva.totalVentas >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                </div>
              </div>

              {/* Saldo Total */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/20 p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-500/5">
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Saldo Total Efectivo</p>
                  <p className="text-xl font-black text-emerald-400 mt-1 font-mono">
                    {formatCurrency(saldoActual)}
                  </p>
                </div>
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10">
                  <TrendingUp size={18} />
                </div>
              </div>
            </div>

            {/* 2. Metadata Caja Abierta */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <Calendar size={14} className="text-indigo-400" />
                  <span>Apertura: {formatDate(cajaActiva.fechaApertura)}</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <User size={14} className="text-indigo-400" />
                  <span>Cajero: {cajaActiva.usuario.username}</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <Activity size={14} className="text-indigo-400" />
                  <span>Estado: <strong className="text-emerald-400 uppercase">Abierta</strong></span>
                </span>
              </div>
              <button
                onClick={handleCerrar}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs transition duration-150 flex items-center justify-center space-x-1.5"
                disabled={isPending}
              >
                <Lock size={12} />
                <span>Cerrar Caja</span>
              </button>
            </div>

            {/* 3. Feed de Movimientos Recientes */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Activity size={18} />
                  <h3 className="text-sm font-bold text-white">Libro Diario (Movimientos del Turno)</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">{cajaActiva.movimientos.length} operaciones</span>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-96 pr-1">
                {cajaActiva.movimientos.length === 0 ? (
                  <p className="text-center py-12 text-xs text-slate-600">No se registran movimientos en este turno.</p>
                ) : (
                  cajaActiva.movimientos.map(mov => {
                    const isIncome = mov.tipo === "INGRESO";
                    return (
                      <div
                        key={mov.id}
                        className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-3 max-w-[70%]">
                          <div className={`p-2 rounded-lg ${
                            isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {isIncome ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                          </div>
                          <div>
                            <p className="font-semibold text-white truncate">{mov.descripcion}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {formatDate(mov.fecha)} · Por {mov.usuario.username}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold font-mono ${
                            isIncome ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {isIncome ? "+" : "-"}{formatCurrency(mov.monto)}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-0.5 font-semibold uppercase">{mov.tipo}</p>
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

      {/* SECCIÓN DERECHA: Registrar Egresos Manuales (Solo si Caja está abierta, 5 COLS) */}
      {cajaActiva && (
        <div className="lg:col-span-4 space-y-6">
          {/* Panel Gasto Manual */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-400 border-b border-slate-800/80 pb-3">
              <MinusCircle size={18} />
              <h2 className="text-sm font-bold text-white">Registrar Gasto Diario</h2>
            </div>

            <form onSubmit={handleGasto} className="space-y-4">
              {/* Campo Descripción */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Concepto del Gasto
                </label>
                <input
                  name="descripcion"
                  type="text"
                  placeholder="Ej: Artículos de limpieza, Viáticos..."
                  value={gastoDesc}
                  onChange={e => setGastoDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                  required
                  disabled={isPending}
                />
              </div>

              {/* Campo Monto */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Monto ($)
                </label>
                <input
                  name="monto"
                  type="number"
                  placeholder="0"
                  value={gastoMonto}
                  onChange={e => setGastoMonto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs font-mono font-bold"
                  required
                  disabled={isPending}
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl flex items-center space-x-2">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white font-bold rounded-xl transition duration-150 flex items-center justify-center space-x-1.5 text-xs shadow-md"
                disabled={isPending}
              >
                <PlusCircle size={14} />
                <span>{isPending ? "Registrando..." : "Registrar Egreso"}</span>
              </button>
            </form>
          </div>

          {/* Historial de Cajas Cerradas */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-400 border-b border-slate-800/80 pb-3">
              <History size={16} />
              <h2 className="text-xs font-bold text-white">Historial de Arqueos</h2>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-48 pr-1">
              {historialCajas.length === 0 ? (
                <p className="text-center py-6 text-[10px] text-slate-600">No hay registros de caja cerrados.</p>
              ) : (
                historialCajas.map(hc => (
                  <div key={hc.id} className="p-2.5 bg-slate-950/20 border border-slate-850 rounded-xl space-y-1.5 text-[10px]">
                    <div className="flex justify-between font-semibold text-white">
                      <span>Caja #{hc.id.toString().padStart(4, "0")}</span>
                      <span className="font-mono text-emerald-400">
                        {formatCurrency(hc.montoInicial + hc.totalVentas)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[9px]">
                      <span>Cerrada: {hc.fechaCierre ? formatDate(hc.fechaCierre).split(" ")[0] : "N/D"}</span>
                      <span>Por: {hc.usuario.username}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
