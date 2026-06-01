"use client";

import React, { useState, useTransition } from "react";
import { getReporteCierres, getDetalleCierre } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  Calendar,
  User,
  RefreshCw,
  Wallet,
  Eye,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Printer,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Props {
  initialData: any[];
  usuarios: { id: number; username: string; nombreCompleto: string }[];
  userRole: string;
}

export default function CierresReport({ initialData, usuarios, userRole }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [detalleCajaId, setDetalleCajaId] = useState<number | null>(null);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getReporteCierres(
        fechaDesde || undefined,
        fechaHasta || undefined,
        usuarioId
      );
      setData(result);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const cierresAbiertos = data.filter((c: any) => c.estado === "ABIERTA").length;

  return (
    <div className="space-y-4">
      {/* Filtros — hidden on print */}
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Search size={14} />
          Filtros
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Calendar size={12} /> Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Calendar size={12} /> Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} /> Usuario
            </label>
            <select
              value={usuarioId || ""}
              onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombreCompleto || u.username}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
            {isPending ? "Buscando..." : "Buscar"}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition"
          >
            <Printer size={14} />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Encabezado impresión */}
      <div className="hidden print:block text-center mb-6">
        <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
        <p className="text-sm">Informe de Cierres de Caja</p>
        <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
        <hr className="my-2 border-gray-300" />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Total Cierres</p>
          <p className="text-2xl font-black text-white print:text-black mt-1">{data.length}</p>
        </div>
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Abiertos</p>
          <p className="text-2xl font-black text-amber-400 print:text-amber-700 mt-1">{cierresAbiertos}</p>
        </div>
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600">Cerrados</p>
          <p className="text-2xl font-black text-emerald-400 print:text-green-700 mt-1">{data.length - cierresAbiertos}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Apertura</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Cierre</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Usuario</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Inicial</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Ventas</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Esperado</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase print:hidden">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 print:text-gray-400">
                    No se encontraron cierres en el período seleccionado.
                  </td>
                </tr>
              ) : (
                data.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 print:hover:bg-white transition-colors">
                    <td className="px-4 py-3 font-bold text-white print:text-black">#{c.id}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 print:text-gray-700">{c.fechaApertura}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 print:text-gray-700">{c.fechaCierre || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 print:text-gray-600">{c.usuario}</td>
                    <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{formatCurrency(c.montoInicial)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">{formatCurrency(c.totalVentas)}</td>
                    <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{formatCurrency(c.totalEsperado)}</td>
                    <td className="px-4 py-3 text-center">
                      {c.estado === "ABIERTA" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 print:bg-amber-100 print:text-amber-800 rounded-full text-[10px] font-bold">
                          <XCircle size={10} />
                          ABIERTA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 print:bg-green-100 print:text-green-800 rounded-full text-[10px] font-bold">
                          <CheckCircle size={10} />
                          CERRADA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <button
                        onClick={() => setDetalleCajaId(c.id)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition"
                        title="Ver detalle completo del cierre"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Cierre */}
      {detalleCajaId && (
        <DetalleCierreModal cajaId={detalleCajaId} onClose={() => setDetalleCajaId(null)} />
      )}
    </div>
  );
}

// ─── Modal Detalle de Cierre (enhanced) ──────────────────────────
function DetalleCierreModal({ cajaId, onClose }: { cajaId: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    getDetalleCierre(cajaId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [cajaId]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet size={18} className="text-sky-400" />
            Cierre de Caja #{cajaId}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : data ? (
            <>
              {/* Fechas y Usuario */}
              <div className="grid grid-cols-2 gap-3 bg-slate-800/50 rounded-xl p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Fecha Apertura</p>
                  <p className="text-white font-bold">{data.fechaApertura}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Fecha Cierre</p>
                  <p className="text-white font-bold">{data.fechaCierre || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Usuario</p>
                  <p className="text-white font-bold">{data.usuario}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado</p>
                  <span className={data.estado === "ABIERTA" ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {data.estado}
                  </span>
                </div>
              </div>

              {/* Montos */}
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400">Inicial</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(data.montoInicial)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400">Total Vendido</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(data.totalVentas)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400">Esperado</p>
                  <p className="text-sm font-bold text-sky-400">{formatCurrency(data.totalEsperado)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400">Contado</p>
                  <p className="text-sm font-bold text-white">
                    {data.totalContado !== null ? formatCurrency(data.totalContado) : "—"}
                  </p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400">Diferencia</p>
                  {data.diferencia !== null ? (
                    <p className={`text-sm font-bold ${data.diferencia >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {data.diferencia >= 0 ? "+" : ""}{formatCurrency(data.diferencia)}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-500 italic">—</p>
                  )}
                </div>
              </div>

              {/* Ingresos / Egresos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <TrendingUp size={12} /> Ingresos
                  </p>
                  <p className="text-lg font-black text-emerald-400">{formatCurrency(data.ingresos)}</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-red-400 flex items-center gap-1">
                    <TrendingDown size={12} /> Egresos
                  </p>
                  <p className="text-lg font-black text-red-400">{formatCurrency(data.egresos)}</p>
                </div>
              </div>

              {/* Movimientos */}
              {data.movimientos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">
                    Detalle de lo que se cerró ({data.movimientos.length} movimientos)
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {data.movimientos.map((m: any) => (
                      <div key={m.id} className="flex justify-between items-center bg-slate-800/20 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-400">{m.fecha}</p>
                          <p className="text-white font-medium truncate">{m.descripcion || m.tipo}</p>
                          <p className="text-xs text-slate-500">{m.usuario}</p>
                        </div>
                        <p className={`font-bold ml-2 ${m.tipo === "EGRESO" ? "text-red-400" : "text-emerald-400"}`}>
                          {m.tipo === "EGRESO" ? "-" : "+"}{formatCurrency(m.monto)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}


            </>
          ) : (
            <p className="text-center text-red-400 py-8">Error al cargar el detalle.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
