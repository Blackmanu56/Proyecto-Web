"use client";

import React, { useState, useTransition } from "react";
import { getReporteEmpleados } from "@/actions/informes";
import { formatCurrency } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import {
  Search,
  Calendar,
  RefreshCw,
  Users,
  TrendingUp,
  Wallet,
  Printer,
  Star,
} from "lucide-react";

interface Props {
  initialData: any[];
  userRole: string;
}

export default function EmpleadosReport({ initialData, userRole }: Props) {
  const [data, setData] = useState(initialData);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getReporteEmpleados(
        fechaDesde || undefined,
        fechaHasta || undefined
      );
      setData(result);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const totalVentas = data.reduce((sum: number, e: any) => sum + e.ventasCount, 0);
  const totalVendido = data.reduce((sum: number, e: any) => sum + e.totalVendido, 0);
  const topEmpleado = data.reduce(
    (best: any, e: any) => (e.totalVendido > (best?.totalVendido || 0) ? e : best),
    null
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="print:hidden bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Search size={14} />
          Filtros
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Print header */}
      <div className="hidden print:block text-center mb-6">
        <h2 className="text-xl font-black uppercase">CHOPPER REPUESTOS</h2>
        <p className="text-sm">Informe de Rendimiento de Empleados</p>
        <p className="text-xs text-gray-500">{fechaDesde} al {fechaHasta}</p>
        <hr className="my-2 border-gray-300" />
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
            <Users size={12} /> Empleados
          </p>
          <p className="text-2xl font-black text-white print:text-black mt-1">{data.length}</p>
        </div>
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
            <TrendingUp size={12} /> Total Ventas
          </p>
          <p className="text-2xl font-black text-white print:text-black mt-1">{totalVentas}</p>
        </div>
        <div className="bg-slate-900/50 print:bg-gray-100 border border-slate-800 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 print:text-gray-600 flex items-center gap-1">
            <Wallet size={12} /> Total Vendido
          </p>
          <p className="text-2xl font-black text-emerald-400 print:text-green-700 mt-1">{formatCurrency(totalVendido)}</p>
        </div>
      </div>

      {/* Top Empleado */}
      {topEmpleado && topEmpleado.totalVendido > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/5 to-sky-500/5 print:bg-gray-100 border border-emerald-500/20 print:border-gray-300 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-400 print:text-green-700 uppercase tracking-wider flex items-center gap-1.5">
            <Star size={12} /> Mejor Vendedor
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Avatar
              fotoUrl={topEmpleado.fotoUrl}
              nombreCompleto={topEmpleado.nombreCompleto}
              size="lg"
              activo={true}
            />
            <div>
              <p className="text-lg font-black text-white print:text-black">{topEmpleado.nombreCompleto}</p>
              <div className="flex gap-4 mt-1 text-sm text-slate-400 print:text-gray-600">
                <span>{topEmpleado.ventasCount} ventas</span>
                <span className="text-emerald-400 print:text-green-700 font-bold">{formatCurrency(topEmpleado.totalVendido)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-slate-900/50 print:bg-white border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-900/80 print:bg-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Rol</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Ventas</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Total Vendido</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 print:text-gray-600 uppercase">Cierres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 print:text-gray-400">
                    No se encontraron empleados activos.
                  </td>
                </tr>
              ) : (
                data.map((emp: any) => (
                  <tr key={emp.usuarioId} className="hover:bg-slate-800/30 print:hover:bg-white transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          fotoUrl={emp.fotoUrl}
                          nombreCompleto={emp.nombreCompleto}
                          size="md"
                          activo={true}
                        />
                        <span className="font-semibold text-white print:text-black">{emp.nombreCompleto}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 print:text-gray-600">@{emp.username}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-800 print:bg-gray-200 px-2 py-0.5 rounded-full text-slate-300 print:text-gray-700">
                        {emp.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{emp.ventasCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 print:text-green-700">
                      {formatCurrency(emp.totalVendido)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 print:text-gray-700">{emp.cierresCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
