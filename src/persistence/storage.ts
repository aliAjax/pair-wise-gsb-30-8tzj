import type { DeskState } from "../domain/types";

const STORAGE_KEY = "hxwlfront-19-supply-desk";

/** 重开页面时恢复排车与缺口 */
export function loadState(): DeskState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeskState;
    if (!Array.isArray(parsed.stations) || !Array.isArray(parsed.tankers)) return null;
    return {
      stations: parsed.stations,
      tankers: parsed.tankers,
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      pendings: Array.isArray(parsed.pendings) ? parsed.pendings : [],
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
      roadClosed: parsed.roadClosed !== false
    };
  } catch {
    return null;
  }
}

export function saveState(state: DeskState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
