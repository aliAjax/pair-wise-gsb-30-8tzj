import type { Station } from "./types";

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

export function fmtShifts(station: Station): string {
  if (station.shiftSales <= 0) return "—";
  return `${(station.inventory / station.shiftSales).toFixed(1)} 班`;
}
