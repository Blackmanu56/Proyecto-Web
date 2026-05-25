"use client";

import React, { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState("");

  const [state, formAction, isPending] = useActionState(loginAction, {});

  useEffect(() => {
    if (state.success) {
      router.push(from);
      router.refresh();
    }
  }, [state.success, router, from]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError("");
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (!username || username.trim().length < 3) {
      e.preventDefault();
      setClientError("El usuario debe tener al menos 3 caracteres.");
      return;
    }

    if (!password || password.length < 4) {
      e.preventDefault();
      setClientError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-hidden font-sans">
      {/* Círculos de Gradiente Traseros para Estética Premium */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-800/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md px-6 z-10">
        {/* Cabecera del Panel */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 animate-bounce">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            SGI-Repuestos
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Sistema Integral para Chopper Repuestos
          </p>
        </div>

        {/* Formulario de Login (Glassmorphism) */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            Iniciar Sesión
          </h2>

          <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Usuario */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Ingrese su nombre de usuario"
                className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200 text-sm"
                required
                disabled={isPending}
              />
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña"
                  className="w-full pl-4 pr-12 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200 text-sm"
                  required
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition duration-150"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Mensajes de Error */}
            {(clientError || state.error) && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium animate-pulse">
                {clientError || state.error}
              </div>
            )}

            {/* Botón Ingresar */}
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-600 hover:border-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/15 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition duration-200 flex items-center justify-center text-sm disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Ingresando...
                </>
              ) : (
                "Ingresar al Panel"
              )}
            </button>
          </form>
        </div>

        {/* Pie de Página */}
        <div className="text-center mt-8 text-xs text-slate-600">
          Desarrollado para Tesis de Grado &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
