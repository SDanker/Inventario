import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export type MaintenanceUnit = "days" | "weeks" | "months" | "quarters" | "years";

/**
 * Calcula la próxima mantención.
 * Regla: la fecha de inicio es la PRIMERA mantención (programada o ya realizada).
 * La próxima = inicio + N*intervalo, con N el menor entero ≥ 1 que dé una fecha ≥ hoy.
 * Devuelve null si faltan datos o son inválidos.
 */
export function computeNextMaintenance(
  start: Date | string | null | undefined,
  value: number | null | undefined,
  unit: string | null | undefined,
): Date | null {
  if (!start || !value || !unit || value <= 0) return null;
  const startDate = typeof start === "string" ? new Date(start) : new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const advance = (d: Date) => {
    switch (unit) {
      case "days": d.setDate(d.getDate() + value); return true;
      case "weeks": d.setDate(d.getDate() + value * 7); return true;
      case "months": d.setMonth(d.getMonth() + value); return true;
      case "quarters": d.setMonth(d.getMonth() + value * 3); return true;
      case "years": d.setFullYear(d.getFullYear() + value); return true;
      default: return false;
    }
  };

  const next = new Date(startDate);
  if (!advance(next)) return null; // N=1
  for (let i = 0; i < 10000; i++) {
    if (next.getTime() >= today.getTime()) return next;
    if (!advance(next)) return null;
  }
  return null;
}
