import type { EventKind, LedgerEvent } from "../domain/types";

export function makeEvent(kind: EventKind, message: string): LedgerEvent {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), kind, message };
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
