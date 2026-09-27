import type { Assignment, DeskState, PendingGap, Station, Tanker } from "./types";

/** 保供等级权重：等级越高越先排车 */
export const GRADE_WEIGHT: Record<Station["grade"], number> = {
  重点保供: 3,
  常规保供: 2,
  一般保供: 1
};

export const roundTons = (value: number) => Math.round(value * 10) / 10;

/** 缺口：补满一个班所需的最少油量 */
export function gapTons(station: Station): number {
  return roundTons(Math.max(0, station.shiftSalesTons - station.inventoryTons));
}

/** 可撑班次：库存 ÷ 班均销量 */
export function shiftsLeft(station: Station): number {
  if (station.shiftSalesTons <= 0) return Number.POSITIVE_INFINITY;
  return station.inventoryTons / station.shiftSalesTons;
}

/** 告急判定：撑不到下一班 */
export function isUrgent(station: Station): boolean {
  return shiftsLeft(station) < 1;
}

/** 时段重叠判定（字符串 HH:mm 可直接比较） */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isActive(a: Assignment): boolean {
  return a.status === "已确认" || a.status === "已发车";
}

/** 罐车当前在排（已确认/已发车）的任务 */
export function tankerHolds(state: DeskState, tankerId: string): Assignment[] {
  return state.assignments.filter((a) => a.tankerId === tankerId && isActive(a));
}

export function hasTimeConflict(state: DeskState, tankerId: string, windowStart: string, windowEnd: string): boolean {
  return tankerHolds(state, tankerId).some((a) => overlaps(a.windowStart, a.windowEnd, windowStart, windowEnd));
}

/**
 * 可确认排车的罐车：片区可走、载重够缺口、不在检修、到站时段不冲突。
 */
export function eligibleTankers(state: DeskState, station: Station, needTons: number): Tanker[] {
  return state.tankers.filter((tanker) => {
    if (tanker.inMaintenance) return false;
    if (!tanker.zones.includes(station.zone)) return false;
    if (tanker.capacityTons < needTons) return false;
    if (hasTimeConflict(state, tanker.id, station.windowStart, station.windowEnd)) return false;
    return true;
  });
}

/**
 * 接力车判定：解封后路网恢复，不再限片区，但仍要求非检修、载重够缺口、时段不冲突。
 */
export function eligibleRelayTankers(state: DeskState, assignment: Assignment): Tanker[] {
  return state.tankers.filter(
    (tanker) =>
      !tanker.inMaintenance &&
      tanker.capacityTons >= assignment.gapTons &&
      !hasTimeConflict(state, tanker.id, assignment.windowStart, assignment.windowEnd)
  );
}

/** 排不下时写清原因，供留待派区展示 */
export function blockReasons(state: DeskState, station: Station, needTons: number): string[] {
  const reasons: string[] = [];
  const available = state.tankers.filter((t) => !t.inMaintenance);
  if (available.length === 0) {
    return ["罐车全部检修中"];
  }
  const zoned = available.filter((t) => t.zones.includes(station.zone));
  if (zoned.length === 0) {
    reasons.push(`无可走「${station.zone}」的罐车`);
  }
  if (zoned.length > 0 && !zoned.some((t) => t.capacityTons >= needTons)) {
    reasons.push(`可走罐车载重均不足缺口 ${needTons} 吨`);
  }
  const fit = zoned.filter((t) => t.capacityTons >= needTons);
  if (fit.length > 0 && fit.every((t) => hasTimeConflict(state, t.id, station.windowStart, station.windowEnd))) {
    reasons.push(`到站时段 ${station.windowStart}-${station.windowEnd} 与在排任务冲突`);
  }
  if (reasons.length === 0) reasons.push("暂无可用罐车");
  return reasons;
}

/** 同条件下选载重最贴近缺口的罐车，减少大车小用 */
export function pickBestFit(candidates: Tanker[], needTons: number): Tanker | undefined {
  return [...candidates].sort(
    (a, b) => a.capacityTons - b.capacityTons || a.plate.localeCompare(b.plate, "zh-Hans-CN")
  )[0];
}

export interface PlanResult {
  assignments: Assignment[];
  pendings: PendingGap[];
}

/**
 * 自动排车：撑不到下一班的站优先（保供等级 → 可撑班次 → 站名），
 * 逐站找可确认罐车；排不下的留待派区并写清缺口与原因。
 */
export function planAssignments(state: DeskState, stations: Station[], now: string): PlanResult {
  const urgent = stations
    .filter((s) => isUrgent(s) && gapTons(s) > 0)
    .sort(
      (a, b) =>
        GRADE_WEIGHT[b.grade] - GRADE_WEIGHT[a.grade] ||
        shiftsLeft(a) - shiftsLeft(b) ||
        a.name.localeCompare(b.name, "zh-Hans-CN")
    );
  const assignments: Assignment[] = [];
  const pendings: PendingGap[] = [];
  // 在副本上累积占位，保证同轮排车的时段冲突判定生效
  const scratch: DeskState = { ...state, assignments: [...state.assignments] };
  for (const station of urgent) {
    const need = gapTons(station);
    const best = pickBestFit(eligibleTankers(scratch, station, need), need);
    if (best) {
      const assignment: Assignment = {
        id: crypto.randomUUID(),
        stationId: station.id,
        tankerId: best.id,
        gapTons: need,
        windowStart: station.windowStart,
        windowEnd: station.windowEnd,
        status: "已确认",
        createdAt: now
      };
      assignments.push(assignment);
      scratch.assignments.push(assignment);
    } else {
      pendings.push({
        id: crypto.randomUUID(),
        stationId: station.id,
        gapTons: need,
        reasons: blockReasons(scratch, station, need),
        createdAt: now
      });
    }
  }
  return { assignments, pendings };
}
