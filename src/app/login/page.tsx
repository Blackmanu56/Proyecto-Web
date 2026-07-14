"use client";

import React, { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Gauge,
  Layers,
  ArrowRight,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Animation Keyframes ─── */
const keyframes = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes expandIn {
    from { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
    to { opacity: 1; max-height: 80px; padding-top: 12px; padding-bottom: 12px; }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(214,40,40,0.3), 0 0 40px rgba(214,40,40,0.1); }
    50% { box-shadow: 0 0 30px rgba(214,40,40,0.5), 0 0 60px rgba(214,40,40,0.2); }
  }
  @keyframes staggerIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .password-mask {
    -webkit-text-security: disc;
  }
  .password-visible {
    -webkit-text-security: none;
  }
`;

/* Force dark mode for autocomplete dropdowns */
const globalStyles = `
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 30px #1E2129 inset !important;
    -webkit-text-fill-color: #F1F5F9 !important;
    caret-color: #F1F5F9 !important;
    transition: background-color 5000s ease-in-out 0s;
  }
  /* Hide browser's native password reveal button */
  input[type="password"]::-webkit-credentials-autofill-button,
  input::-webkit-credentials-autofill-button {
    display: none !important;
  }
`;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [clientError, setClientError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(loginAction, {});

  const handleClearForm = () => {
    if (usernameRef.current) usernameRef.current.value = "";
    if (passwordRef.current) passwordRef.current.value = "";
  };

  // Load remembered username on mount
  useEffect(() => {
    const remembered = localStorage.getItem("chopper_remembered_user");
    if (remembered && usernameRef.current) {
      usernameRef.current.value = remembered;
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (state.success) {
      // Save or clear remembered username
      if (rememberMe && usernameRef.current) {
        localStorage.setItem("chopper_remembered_user", usernameRef.current.value);
      } else {
        localStorage.removeItem("chopper_remembered_user");
      }
      router.push(from);
      router.refresh();
    }
  }, [state.success, router, from, rememberMe]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError("");
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

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
    <>
      <style>{keyframes}</style>
      <style>{globalStyles}</style>

      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: "#101114", colorScheme: "dark" }}
      >
        {/* ── Background: Subtle Grid ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.02,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* ── Background: Center radial ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "45%",
            left: "50%",
            width: "900px",
            height: "900px",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(214,40,40,0.06) 0%, transparent 60%)",
            filter: "blur(100px)",
          }}
        />

        {/* ── Background: Top-left glow ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-20%",
            left: "-15%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(214,40,40,0.08) 0%, transparent 55%)",
            filter: "blur(120px)",
          }}
        />

        {/* ── Background: Bottom-right glow ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "-20%",
            right: "-15%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(214,40,40,0.06) 0%, transparent 55%)",
            filter: "blur(120px)",
          }}
        />

        {/* ── Background: Vignette ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
          }}
        />

        {/* ═══════════════════════════════════════
            MAIN CARD
            ═══════════════════════════════════════ */}
        <div
          className="relative z-10 w-full max-w-6xl mx-4 md:mx-6"
          style={{
            animation: "fadeIn 400ms ease forwards",
          }}
        >
          <div
            className="overflow-hidden"
            style={{
              background: "#1E2129",
              border: "1px solid #2A2E38",
              borderRadius: "20px",
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px rgba(214,40,40,0.04)",
            }}
          >
            <div
              className="flex flex-col md:flex-row"
              style={{ minHeight: "620px" }}
            >
              {/* ═══════════════════════════════════════
                  LEFT PANEL — Company Presentation
                  ═══════════════════════════════════════ */}
              <div
                className="md:w-1/2 relative flex flex-col"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(214,40,40,0.2) 0%, rgba(214,40,40,0.08) 30%, #111318 70%, #0d0f13 100%)",
                  borderRight: "1px solid #2A2E38",
                  animation: "slideInLeft 500ms ease 100ms both",
                }}
              >
                {/* Dark atmospheric overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)",
                  }}
                />

                {/* Strong red glow — left edge */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: "0%",
                    left: "-15%",
                    width: "400px",
                    height: "100%",
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse at left, rgba(214,40,40,0.18) 0%, transparent 60%)",
                    filter: "blur(60px)",
                  }}
                />

                {/* Subtle mechanical texture overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    opacity: 0.03,
                    backgroundImage:
                      "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                />

                {/* Branding + Features */}
                <div
                  className="relative z-10 flex flex-col items-center h-full"
                  style={{ minHeight: "620px" }}
                >
                  {/* Logo Section — 55% of panel */}
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ flex: "1 1 55%", minHeight: "340px" }}
                  >
                    <img
                      src="/logo.png"
                      alt="Chopper Repuestos"
                      style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "drop-shadow(0 4px 30px rgba(214,40,40,0.15))",
                      }}
                    />
                  </div>

                  {/* Three Feature Blocks — 45% of panel, solid dark bg */}
                  <div
                    className="flex flex-col justify-center gap-6 w-full px-8 py-8"
                    style={{
                      flex: "1 1 45%",
                      minHeight: "280px",
                      background: "#0d0f13",
                    }}
                  >
                    {[
                      {
                        icon: Shield,
                        title: "Confiable",
                        desc: "Gestión segura y protegida",
                      },
                      {
                        icon: Gauge,
                        title: "Eficiente",
                        desc: "Accedé rápido a toda la información",
                      },
                      {
                        icon: Layers,
                        title: "Integral",
                        desc: "Gestioná todo desde un solo lugar",
                      },
                    ].map((feature, i) => (
                      <div
                        key={feature.title}
                        className="flex items-center gap-4"
                        style={{
                          animation: `staggerIn 400ms ease ${400 + i * 100}ms both`,
                        }}
                      >
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-xl"
                          style={{
                            width: "48px",
                            height: "48px",
                            background: "rgba(214,40,40,0.1)",
                            border: "1px solid rgba(214,40,40,0.2)",
                          }}
                        >
                          <feature.icon
                            size={24}
                            style={{ color: "#D62828" }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-semibold"
                            style={{
                              fontSize: "0.95rem",
                              color: "#F1F5F9",
                            }}
                          >
                            {feature.title}
                          </span>
                          <span
                            className="text-sm"
                            style={{
                              color: "#64748B",
                              lineHeight: "1.4",
                            }}
                          >
                            {feature.desc}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════
                  RIGHT PANEL — Login Form
                  ═══════════════════════════════════════ */}
              <div
                className="md:w-1/2 flex flex-col items-center justify-center"
                style={{
                  padding: "48px 48px 32px",
                  animation: "fadeInUp 500ms ease 200ms both",
                }}
              >
                {/* User Icon with Glow */}
                <div
                  className="flex items-center justify-center rounded-full mb-5"
                  style={{
                    width: "64px",
                    height: "64px",
                    background:
                      "linear-gradient(135deg, rgba(214,40,40,0.15), rgba(214,40,40,0.05))",
                    border: "1.5px solid rgba(214,40,40,0.3)",
                    animation:
                      "fadeIn 400ms ease 300ms both, pulseGlow 3s ease-in-out infinite",
                  }}
                >
                  <User size={28} style={{ color: "#D62828" }} />
                </div>

                {/* Title */}
                <h1
                  className="font-bold text-center"
                  style={{
                    fontSize: "var(--text-3xl)",
                    color: "#F1F5F9",
                    marginBottom: "6px",
                    animation: "fadeInUp 400ms ease 300ms both",
                  }}
                >
                  Iniciar
                  <span style={{ color: "#D62828" }}> sesión</span>
                </h1>

                {/* Subtitle */}
                <p
                  className="text-center"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "#94A3B8",
                    marginBottom: "28px",
                    animation: "fadeInUp 400ms ease 350ms both",
                  }}
                >
                  Ingresá tus credenciales para acceder al sistema.
                </p>

                {/* Form */}
                <form
                  action={formAction}
                  onSubmit={handleSubmit}
                  className="flex flex-col items-center w-full"
                  style={{ gap: "18px" }}
                >
                  {/* Username field */}
                  <div
                    className="w-full group"
                    style={{
                      animation: "staggerIn 400ms ease 420ms both",
                    }}
                  >
                    <div
                      className="relative flex items-center rounded-xl transition-all duration-200"
                      style={{
                        background: "#1E2129",
                        border: "1px solid #2A2E38",
                      }}
                    >
                      <div
                        className="absolute left-3.5 pointer-events-none transition-colors duration-200"
                        style={{ color: "#64748B" }}
                      >
                        <User size={16} />
                      </div>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="Usuario"
                        required
                        disabled={isPending}
                        ref={usernameRef}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-[#64748B] text-[#F1F5F9]"
                        style={{
                          padding: "12px 14px 12px 42px",
                          borderRadius: "12px",
                        }}
                        onFocus={(e) => {
                          const wrapper = e.currentTarget.parentElement!;
                          wrapper.style.borderColor = "#D62828";
                          wrapper.style.boxShadow =
                            "0 0 0 3px rgba(214,40,40,0.12)";
                          const icon = wrapper.querySelector(
                            ".input-icon"
                          ) as HTMLElement;
                          if (icon) icon.style.color = "#D62828";
                        }}
                        onBlur={(e) => {
                          const wrapper = e.currentTarget.parentElement!;
                          wrapper.style.borderColor = "#2A2E38";
                          wrapper.style.boxShadow = "none";
                          const icon = wrapper.querySelector(
                            ".input-icon"
                          ) as HTMLElement;
                          if (icon) icon.style.color = "#64748B";
                        }}
                      />
                    </div>
                  </div>

                  {/* Password field */}
                  <div
                    className="w-full"
                    style={{
                      animation: "staggerIn 400ms ease 490ms both",
                    }}
                  >
                    <div
                      className="relative flex items-center rounded-xl transition-all duration-200"
                      style={{
                        background: "#1E2129",
                        border: "1px solid #2A2E38",
                      }}
                    >
                      <div
                        className="absolute left-3.5 pointer-events-none transition-colors duration-200"
                        style={{ color: "#64748B" }}
                      >
                        <Lock size={16} />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type="text"
                        placeholder="Contraseña"
                        required
                        disabled={isPending}
                        ref={passwordRef}
                        autoComplete="off"
                        className={`w-full bg-transparent text-sm outline-none placeholder:text-[#64748B] text-[#F1F5F9] ${showPassword ? "password-visible" : "password-mask"}`}
                        style={{
                          padding: "12px 44px 12px 42px",
                          borderRadius: "12px",
                        }}
                        onFocus={(e) => {
                          const wrapper = e.currentTarget.parentElement!;
                          wrapper.style.borderColor = "#D62828";
                          wrapper.style.boxShadow =
                            "0 0 0 3px rgba(214,40,40,0.12)";
                          const icon = wrapper.querySelector(
                            ".input-icon"
                          ) as HTMLElement;
                          if (icon) icon.style.color = "#D62828";
                        }}
                        onBlur={(e) => {
                          const wrapper = e.currentTarget.parentElement!;
                          wrapper.style.borderColor = "#2A2E38";
                          wrapper.style.boxShadow = "none";
                          const icon = wrapper.querySelector(
                            ".input-icon"
                          ) as HTMLElement;
                          if (icon) icon.style.color = "#64748B";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 flex items-center justify-center transition-colors duration-200"
                        style={{
                          color: "#64748B",
                          background: "none",
                          border: "none",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                        tabIndex={-1}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#F1F5F9")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#64748B")
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {(clientError || state.error) && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl w-full"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.15)",
                        animation: "fadeIn 200ms ease",
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#EF4444" }}
                      />
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#EF4444" }}
                      >
                        {clientError || state.error}
                      </p>
                    </div>
                  )}

                  {/* Checkbox row: Recordarme + ¿Olvidaste tu contraseña? */}
                  <div
                    className="flex items-center justify-between w-full"
                    style={{
                      animation: "staggerIn 400ms ease 560ms both",
                    }}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        className="relative flex items-center justify-center rounded transition-all duration-200"
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "1.5px solid #3A3F4C",
                          background: "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <div
                          className="absolute inset-0 rounded opacity-0 peer-checked:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                          style={{ background: "#D62828" }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2.5 6L5 8.5L9.5 3.5"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                      <span
                        className="text-sm"
                        style={{ color: "#94A3B8" }}
                      >
                        Recordarme
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowRecovery(!showRecovery)}
                      className="text-sm transition-colors duration-200 cursor-pointer"
                      style={{
                        color: "#64748B",
                        background: "none",
                        border: "none",
                        padding: "2px 0",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#D62828")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#64748B")
                      }
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Password recovery message */}
                  {showRecovery && (
                    <div
                      className="text-center text-sm w-full rounded-xl overflow-hidden"
                      style={{
                        color: "#94A3B8",
                        background: "rgba(214,40,40,0.06)",
                        border: "1px solid rgba(214,40,40,0.12)",
                        padding: "12px 16px",
                        animation: "expandIn 300ms ease forwards",
                      }}
                    >
                      Contactá con un administrador presencialmente.
                    </div>
                  )}

                  {/* Main submit button — INSIDE form */}
                  <div
                    className="w-full"
                    style={{
                      marginTop: "10px",
                      animation: "staggerIn 400ms ease 630ms both",
                    }}
                  >
                    <Button
                      type="submit"
                      variant="default"
                      size="lg"
                      loading={isPending}
                      className="w-full group"
                      style={{
                        height: "48px",
                        fontSize: "var(--text-base)",
                        fontWeight: "var(--font-semibold)",
                        letterSpacing: "0.01em",
                        background:
                          "linear-gradient(135deg, #D62828 0%, #B91C1C 100%)",
                        border: "none",
                        boxShadow:
                          "0 4px 14px rgba(214,40,40,0.3)",
                        transition: "all 200ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.filter =
                            "brightness(1.15)";
                          e.currentTarget.style.transform =
                            "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 25px rgba(214,40,40,0.4)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.filter = "brightness(1)";
                          e.currentTarget.style.transform =
                            "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 4px 14px rgba(214,40,40,0.3)";
                        }
                      }}
                      onMouseDown={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.transform =
                            "translateY(0) scale(0.98)";
                        }
                      }}
                      onMouseUp={(e) => {
                        if (!isPending) {
                          e.currentTarget.style.transform =
                            "translateY(-2px)";
                        }
                      }}
                    >
                      {isPending ? "Ingresando..." : "Ingresar"}
                      {!isPending && (
                        <ArrowRight
                          size={18}
                          style={{ marginLeft: "8px" }}
                          className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                        />
                      )}
                    </Button>
                  </div>

                </form>

                {/* ── Divider "ó" ── */}
                <div
                  className="flex items-center gap-3 w-full"
                  style={{
                    marginTop: "16px",
                    animation: "staggerIn 400ms ease 660ms both",
                  }}
                >
                  <div
                    className="flex-1 h-px"
                    style={{ background: "#2A2E38" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "#64748B" }}
                  >
                    ó
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "#2A2E38" }}
                  />
                </div>

                {/* Secondary button — Limpiar (icon only) */}
                <div
                  className="w-full mt-3"
                  style={{
                    animation: "staggerIn 400ms ease 700ms both",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="inline-flex items-center justify-center gap-2 w-full rounded-[var(--radius-lg)] text-sm font-medium transition-all duration-200"
                    style={{
                      height: "48px",
                      padding: "0 24px",
                      background: "transparent",
                      border: "1px solid #2A2E38",
                      color: "#94A3B8",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#3A3F4C";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)";
                      e.currentTarget.style.color = "#F1F5F9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2A2E38";
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#94A3B8";
                    }}
                  >
                    <Eraser size={18} />
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Footer — outside card, centered */}
          <div
            className="flex items-center justify-center gap-1.5 mt-6"
            style={{
              animation: "fadeIn 600ms ease 800ms both",
            }}
          >
            <Shield
              size={12}
              style={{ color: "#475569" }}
            />
            <span
              className="text-xs"
              style={{ color: "#475569" }}
            >
              © 2024 Chopper Repuestos. Todos los derechos reservados.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
