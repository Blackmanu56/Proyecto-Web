import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value);
}

export function formatTime24(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy");
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm");
}

export function formatShiftDuration(fechaApertura: Date | string): string {
  const start = typeof fechaApertura === "string" ? new Date(fechaApertura) : fechaApertura;
  const diffMins = differenceInMinutes(new Date(), start);
  if (diffMins < 0) return "0h 0m";
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}
