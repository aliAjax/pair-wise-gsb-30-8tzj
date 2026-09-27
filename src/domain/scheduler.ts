import type { Assignment, PendingItem, Station, SupplyLevel, Tanker, TimeWindow } from "./types";

/** 仍占用罐车载重 / 时段的占位状态 */
export const ACTIVE_STATUSES: Assignment["status"][] = ["已确认", "已发车", "已接力"];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 可撑班次 = 库存 / 班均销量 */
export function shiftsLeft(station: Station): number {
  if (station.shiftSales <= 0) return Number.POSITIVE_INFINITY;
  return station.inventory / station.shiftSales;
}

/** 撑不到下一班：可撑班次 < 1 */
export function isUrgent(station: Station): boolean {
  return shiftsLeft(station) < 1;
}

/** 缺口 = 班均销量 × 2 − 当前库存（补到能撑两班） */
export function deficitOf(station: Station): number {
  return Math.max(0, r1(station.shiftSales * 2 - station.inventory));
}

const LEVEL_WEIGHT: Record<SupplyLevel, number> = {
  重点保供: 0,
  常规保供: 1,
  一般保供: 2,
};

/** 排车优先级：保供等级高的优先，同级按可撑班次少的优先 */
export function compareUrgency(a: Station, b: Station): number {
  return LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level] || shiftsLeft(a) - shiftsLeft(b);
}

export function usedTons(tankerId: string, assignments: Assignment[]): number {
  return assignments
    .filter((a) => a.tankerId === tankerId && ACTIVE_STATUSES.includes(a.status))
    .reduce((sum, a) => sum + a.tons, 0);
}

/** 罐车剩余载重 = 载重 − 在途占位 */
export function remainingCapacity(tanker: Tanker, assignments: Assignment[]): number {
  return Math.max(0, r1(tanker.capacity - usedTons(tanker.id, assignments)));
}

/** 罐车已被占用的到站时段 */
export function busyWindows(tankerId: string, assignments: Assignment[]): TimeWindow[] {
  return assignments
    .filter((a) => a.tankerId === tankerId && ACTIVE_STATUSES.includes(a.status))
    .map((a) => a.window);
}

export function hasActiveAssignment(stationId: string, assignments: Assignment[]): boolean {
  return assignments.some((a) => a.stationId === stationId && ACTIVE_STATUSES.includes(a.status));
}

export interface DraftAssignment {
  stationId: string;
  tankerId: string;
  tons: number;
  window: TimeWindow;
}

export interface PlanResult {
  drafts: DraftAssignment[];
  pending: PendingItem[];
}

/**
 * 一键排车判定：
 * 1. 只处理撑不到下一班且尚未占位的站，按保供等级 + 可撑班次排序；
 * 2. 罐车需在役、可走该站片区、剩余载重够缺口，且到站时段不与在途任务冲突；
 * 3. 满足多车时取“剩余载重够缺口的最小车”，时段取该站可接的最早空闲时段；
 * 4. 排不下的留待派区，写清缺口与原因。
 */
export function planAssignments(
  stations: Station[],
  tankers: Tanker[],
  assignments: Assignment[],
  now: string
): PlanResult {
  const drafts: DraftAssignment[] = [];
  const pending: PendingItem[] = [];
  // 已确认/已发车/已接力 + 本轮新排，逐站模拟占用
  const simulated: Assignment[] = [...assignments];

  const urgent = stations
    .filter((s) => isUrgent(s) && !hasActiveAssignment(s.id, assignments))
    .sort(compareUrgency);

  for (const station of urgent) {
    const deficit = deficitOf(station);
    if (deficit <= 0) continue;

    const zoneTankers = tankers.filter((t) => t.zones.includes(station.zone));
    const usable = zoneTankers.filter((t) => t.status === "在役");

    let reason = "";
    let chosen: { tanker: Tanker; window: TimeWindow } | null = null;

    if (zoneTankers.length === 0) {
      reason = `没有登记可走${station.zone}的罐车`;
    } else if (usable.length === 0) {
      reason = `可走${station.zone}的罐车全部检修停运`;
    } else if (station.windows.length === 0) {
      reason = "该站未登记可接油的到站时段";
    } else {
      const fits = usable
        .map((tanker) => {
          const busy = busyWindows(tanker.id, simulated);
          return {
            tanker,
            rest: remainingCapacity(tanker, simulated),
            free: station.windows.filter((w) => !busy.includes(w)),
          };
        })
        .filter((x) => x.rest >= deficit && x.free.length > 0)
        .sort((a, b) => a.rest - b.rest);

      if (fits.length > 0) {
        chosen = { tanker: fits[0].tanker, window: fits[0].free[0] };
      } else {
        const anyCapacity = usable.some((t) => remainingCapacity(t, simulated) >= deficit);
        const anyWindow = usable.some((t) =>
          station.windows.some((w) => !busyWindows(t.id, simulated).includes(w))
        );
        if (!anyCapacity) reason = `在役罐车剩余载重不足，缺口 ${deficit} 吨`;
        else if (!anyWindow) reason = "在役罐车到站时段均已冲突";
        else reason = "载重够的车时段冲突，时段空的车载重不足";
      }
    }

    if (chosen) {
      const draft: DraftAssignment = {
        stationId: station.id,
        tankerId: chosen.tanker.id,
        tons: deficit,
        window: chosen.window,
      };
      drafts.push(draft);
      simulated.push({ ...draft, id: `sim-${station.id}`, status: "已确认", createdAt: now });
    } else {
      pending.push({ stationId: station.id, deficit, reason, at: now });
    }
  }

  return { drafts, pending };
}

/** 手动排车校验：返回 null 表示可确认，否则为失败原因 */
export function validateManual(
  station: Station,
  tanker: Tanker,
  window: TimeWindow,
  tons: number,
  assignments: Assignment[]
): string | null {
  if (tanker.status !== "在役") return `${tanker.plate} 正在检修，不能排车`;
  if (!tanker.zones.includes(station.zone)) return `${tanker.plate} 不可走${station.zone}`;
  if (!station.windows.includes(window)) return `${station.name} 未登记 ${window} 到站时段`;
  if (!(tons > 0)) return "排车吨数必须大于 0";
  if (remainingCapacity(tanker, assignments) < tons)
    return `${tanker.plate} 剩余载重 ${remainingCapacity(tanker, assignments)} 吨，不够 ${tons} 吨`;
  if (busyWindows(tanker.id, assignments).includes(window))
    return `${tanker.plate} 在 ${window} 已有任务，时段冲突`;
  if (hasActiveAssignment(station.id, assignments)) return `${station.name} 已有在途占位`;
  return null;
}
