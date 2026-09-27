import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  blockReasons,
  eligibleTankers,
  gapTons,
  GRADE_WEIGHT,
  hasTimeConflict,
  isActive,
  isUrgent,
  pickBestFit,
  planAssignments,
  shiftsLeft
} from "../domain/rules";
import { seedState, SEED_ZONES } from "../domain/seed";
import type { Assignment, DeskState, EventKind, LedgerEvent, Station, Tanker } from "../domain/types";
import { clearState, loadState, saveState } from "../persistence/storage";
import { makeEvent } from "../ledger/ledger";

/** 首次进入：铺演示数据并立即跑一轮自动排车，让台面上有排车与缺口可看 */
function buildSeed(): DeskState {
  const state = seedState();
  const events: LedgerEvent[] = [];
  const urgent = state.stations.filter((s) => isUrgent(s));
  events.push(makeEvent("判定", `暴雨封路，保供台启动：${urgent.length} 座油站撑不到下一班，按保供等级与可撑班次优先排车`));
  const plan = planAssignments(state, state.stations, new Date().toISOString());
  state.assignments = plan.assignments;
  state.pendings = plan.pendings;
  for (const a of plan.assignments) {
    const s = state.stations.find((x) => x.id === a.stationId);
    const t = state.tankers.find((x) => x.id === a.tankerId);
    events.push(makeEvent("排车", `${s?.name} 缺口 ${a.gapTons} 吨 → ${t?.plate}（${a.windowStart}-${a.windowEnd}）已确认`));
  }
  for (const p of plan.pendings) {
    const s = state.stations.find((x) => x.id === p.stationId);
    events.push(makeEvent("判定", `${s?.name} 留待派区：缺口 ${p.gapTons} 吨，${p.reasons.join("；")}`));
  }
  state.ledger = events.reverse();
  saveState(state);
  return state;
}

function bootstrap(): DeskState {
  return loadState() ?? buildSeed();
}

export const useDeskStore = defineStore("desk", () => {
  const state = ref<DeskState>(bootstrap());

  const zones = computed(() => {
    const set = new Set<string>(SEED_ZONES);
    for (const s of state.value.stations) set.add(s.zone);
    for (const t of state.value.tankers) for (const z of t.zones) set.add(z);
    return [...set];
  });

  const stationById = computed(() => new Map(state.value.stations.map((s) => [s.id, s] as const)));
  const tankerById = computed(() => new Map(state.value.tankers.map((t) => [t.id, t] as const)));

  /** 告急站：撑不到下一班，按优先级排序 */
  const urgentStations = computed(() =>
    state.value.stations
      .filter((s) => isUrgent(s))
      .sort(
        (a, b) =>
          GRADE_WEIGHT[b.grade] - GRADE_WEIGHT[a.grade] ||
          shiftsLeft(a) - shiftsLeft(b) ||
          a.name.localeCompare(b.name, "zh-Hans-CN")
      )
  );

  const calmStations = computed(() => state.value.stations.filter((s) => !isUrgent(s)));

  const activeAssignments = computed(() =>
    state.value.assignments
      .filter(isActive)
      .slice()
      .sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === "已确认" ? -1 : 1))
  );

  function stationStatus(stationId: string): "已排车" | "待派区" | "待判定" {
    if (state.value.assignments.some((a) => a.stationId === stationId && isActive(a))) return "已排车";
    if (state.value.pendings.some((p) => p.stationId === stationId)) return "待派区";
    return "待判定";
  }

  function persist() {
    saveState(state.value);
  }

  function log(kind: EventKind, message: string) {
    state.value.ledger.unshift(makeEvent(kind, message));
  }

  // ---------- 油站登记 ----------

  function addStation(input: Omit<Station, "id">) {
    state.value.stations.push({ ...input, id: crypto.randomUUID() });
    log("登记", `油站登记：${input.name}（${input.zone}，库存 ${input.inventoryTons} 吨，班均 ${input.shiftSalesTons} 吨，${input.grade}，到站时段 ${input.windowStart}-${input.windowEnd}）`);
    persist();
  }

  function updateStation(id: string, input: Omit<Station, "id">) {
    const index = state.value.stations.findIndex((s) => s.id === id);
    if (index < 0) throw new Error("油站不存在");
    state.value.stations[index] = { ...input, id };
    log("登记", `油站修改：${input.name}（库存 ${input.inventoryTons} 吨，班均 ${input.shiftSalesTons} 吨，${input.grade}，到站时段 ${input.windowStart}-${input.windowEnd}）`);
    persist();
  }

  function removeStation(id: string) {
    const station = stationById.value.get(id);
    if (!station) return;
    if (state.value.assignments.some((a) => a.stationId === id && isActive(a))) throw new Error("该油站有在排任务，不能删除");
    if (state.value.pendings.some((p) => p.stationId === id)) throw new Error("该油站有待派缺口，请先在留待派区办结");
    state.value.stations = state.value.stations.filter((s) => s.id !== id);
    log("登记", `油站删除：${station.name}`);
    persist();
  }

  // ---------- 罐车登记 ----------

  function addTanker(input: Omit<Tanker, "id">) {
    state.value.tankers.push({ ...input, id: crypto.randomUUID() });
    log("登记", `罐车登记：${input.plate}（载重 ${input.capacityTons} 吨，可走 ${input.zones.join("/")}${input.inMaintenance ? "，检修中" : ""}）`);
    persist();
  }

  function updateTanker(id: string, input: Omit<Tanker, "id">) {
    const index = state.value.tankers.findIndex((t) => t.id === id);
    if (index < 0) throw new Error("罐车不存在");
    const holds = state.value.assignments.filter((a) => a.tankerId === id && isActive(a));
    if (input.inMaintenance && holds.length > 0) throw new Error("该罐车有在排任务，不能转为检修");
    const maxGap = Math.max(0, ...holds.map((a) => a.gapTons));
    if (input.capacityTons < maxGap) throw new Error(`载重不能小于在排任务缺口 ${maxGap} 吨`);
    state.value.tankers[index] = { ...input, id };
    log("登记", `罐车修改：${input.plate}（载重 ${input.capacityTons} 吨，可走 ${input.zones.join("/")}${input.inMaintenance ? "，检修中" : ""}）`);
    persist();
  }

  function setMaintenance(id: string, value: boolean) {
    const tanker = tankerById.value.get(id);
    if (!tanker) return;
    if (value && state.value.assignments.some((a) => a.tankerId === id && isActive(a))) {
      throw new Error("该罐车有在排任务，不能转入检修");
    }
    tanker.inMaintenance = value;
    log("登记", value ? `罐车 ${tanker.plate} 转入检修` : `罐车 ${tanker.plate} 检修完成，恢复可用`);
    persist();
  }

  function removeTanker(id: string) {
    const tanker = tankerById.value.get(id);
    if (!tanker) return;
    if (state.value.assignments.some((a) => a.tankerId === id && isActive(a))) throw new Error("该罐车有在排任务，不能删除");
    state.value.tankers = state.value.tankers.filter((t) => t.id !== id);
    log("登记", `罐车删除：${tanker.plate}`);
    persist();
  }

  // ---------- 判定与排车 ----------

  /** 一键排车：对所有尚无在排任务的告急站自动判定 */
  function autoDispatch() {
    if (!state.value.roadClosed) throw new Error("道路已解封，不再新排车");
    const covered = new Set(state.value.assignments.filter(isActive).map((a) => a.stationId));
    const targets = state.value.stations.filter((s) => isUrgent(s) && !covered.has(s.id));
    if (targets.length === 0) {
      log("判定", "一键排车：没有新的告急油站");
      persist();
      return { assigned: 0, pending: 0 };
    }
    const plan = planAssignments(state.value, targets, new Date().toISOString());
    state.value.assignments.push(...plan.assignments);
    const targetIds = new Set(targets.map((t) => t.id));
    state.value.pendings = state.value.pendings.filter((p) => !targetIds.has(p.stationId));
    state.value.pendings.push(...plan.pendings);
    for (const a of plan.assignments) {
      const s = stationById.value.get(a.stationId);
      const t = tankerById.value.get(a.tankerId);
      log("排车", `${s?.name} 缺口 ${a.gapTons} 吨 → ${t?.plate}（${a.windowStart}-${a.windowEnd}）已确认`);
    }
    for (const p of plan.pendings) {
      const s = stationById.value.get(p.stationId);
      log("判定", `${s?.name} 留待派区：缺口 ${p.gapTons} 吨，${p.reasons.join("；")}`);
    }
    persist();
    return { assigned: plan.assignments.length, pending: plan.pendings.length };
  }

  /** 人工确认：片区可走、载重够缺口、时段不冲突才放行 */
  function confirmAssignment(stationId: string, tankerId: string) {
    if (!state.value.roadClosed) throw new Error("道路已解封，不能确认新排车");
    const station = stationById.value.get(stationId);
    const tanker = tankerById.value.get(tankerId);
    if (!station || !tanker) throw new Error("油站或罐车不存在");
    if (state.value.assignments.some((a) => a.stationId === stationId && isActive(a))) throw new Error("该油站已有在排任务");
    const need = gapTons(station);
    if (need <= 0) throw new Error("该油站暂无缺口");
    if (tanker.inMaintenance) throw new Error(`罐车 ${tanker.plate} 检修中`);
    if (!tanker.zones.includes(station.zone)) throw new Error(`罐车 ${tanker.plate} 不走「${station.zone}」`);
    if (tanker.capacityTons < need) throw new Error(`载重 ${tanker.capacityTons} 吨小于缺口 ${need} 吨`);
    if (hasTimeConflict(state.value, tankerId, station.windowStart, station.windowEnd)) throw new Error("到站时段与该罐车在排任务冲突");
    const assignment: Assignment = {
      id: crypto.randomUUID(),
      stationId,
      tankerId,
      gapTons: need,
      windowStart: station.windowStart,
      windowEnd: station.windowEnd,
      status: "已确认",
      createdAt: new Date().toISOString()
    };
    state.value.assignments.push(assignment);
    state.value.pendings = state.value.pendings.filter((p) => p.stationId !== stationId);
    log("排车", `${station.name} 缺口 ${need} 吨 → ${tanker.plate}（${assignment.windowStart}-${assignment.windowEnd}）已确认（人工）`);
    persist();
  }

  function dispatchAssignment(id: string) {
    if (!state.value.roadClosed) throw new Error("道路已解封，未发车的占位已释放");
    const a = state.value.assignments.find((x) => x.id === id);
    if (!a || a.status !== "已确认") return;
    a.status = "已发车";
    a.dispatchedAt = new Date().toISOString();
    const s = stationById.value.get(a.stationId);
    const t = tankerById.value.get(a.tankerId);
    log("发车", `${s?.name} ← ${t?.plate} 已发车（${a.gapTons} 吨，${a.windowStart}-${a.windowEnd}）`);
    persist();
  }

  /** 留待派区重试：条件凑齐则确认排车，否则刷新原因 */
  function retryPending(id: string) {
    if (!state.value.roadClosed) throw new Error("道路已解封，不再新排车");
    const pending = state.value.pendings.find((p) => p.id === id);
    if (!pending) return;
    const station = stationById.value.get(pending.stationId);
    if (!station) {
      state.value.pendings = state.value.pendings.filter((p) => p.id !== id);
      persist();
      return;
    }
    const need = gapTons(station);
    const best = pickBestFit(eligibleTankers(state.value, station, need), need);
    if (!best) {
      pending.gapTons = need;
      pending.reasons = blockReasons(state.value, station, need);
      log("判定", `${station.name} 重试仍待派：缺口 ${need} 吨，${pending.reasons.join("；")}`);
      persist();
      return;
    }
    const assignment: Assignment = {
      id: crypto.randomUUID(),
      stationId: station.id,
      tankerId: best.id,
      gapTons: need,
      windowStart: station.windowStart,
      windowEnd: station.windowEnd,
      status: "已确认",
      createdAt: new Date().toISOString()
    };
    state.value.assignments.push(assignment);
    state.value.pendings = state.value.pendings.filter((p) => p.id !== id);
    log("排车", `${station.name} 缺口 ${need} 吨 → ${best.plate}（${assignment.windowStart}-${assignment.windowEnd}）已确认（待派重试）`);
    persist();
  }

  function dropPending(id: string) {
    const pending = state.value.pendings.find((p) => p.id === id);
    if (!pending) return;
    const s = stationById.value.get(pending.stationId);
    state.value.pendings = state.value.pendings.filter((p) => p.id !== id);
    log("清理", `待派缺口办结：${s?.name ?? "未知油站"}（缺口 ${pending.gapTons} 吨）`);
    persist();
  }

  // ---------- 解封与接力 ----------

  /** 解封：释放未发车的原占位，已发车任务保留，仅可登记接力车 */
  function reopenRoads() {
    if (!state.value.roadClosed) return;
    state.value.roadClosed = false;
    const released = state.value.assignments.filter((a) => a.status === "已确认").length;
    state.value.assignments = state.value.assignments.filter((a) => a.status === "已发车");
    log("解封", `道路解封：释放 ${released} 个原占位，已发车 ${state.value.assignments.length} 车保留，仅可登记接力车和原因`);
    persist();
  }

  function registerRelay(assignmentId: string, tankerId: string, reason: string) {
    if (state.value.roadClosed) throw new Error("道路未解封，无需接力");
    const original = state.value.assignments.find((a) => a.id === assignmentId);
    if (!original || original.status !== "已发车") throw new Error("只能为已发车的任务登记接力车");
    if (!reason.trim()) throw new Error("请填写接力原因");
    const tanker = tankerById.value.get(tankerId);
    if (!tanker) throw new Error("罐车不存在");
    if (tanker.inMaintenance) throw new Error(`罐车 ${tanker.plate} 检修中`);
    if (tanker.capacityTons < original.gapTons) throw new Error(`载重 ${tanker.capacityTons} 吨小于缺口 ${original.gapTons} 吨`);
    if (hasTimeConflict(state.value, tankerId, original.windowStart, original.windowEnd)) throw new Error("到站时段与该罐车在排任务冲突");
    const now = new Date().toISOString();
    const relay: Assignment = {
      id: crypto.randomUUID(),
      stationId: original.stationId,
      tankerId,
      gapTons: original.gapTons,
      windowStart: original.windowStart,
      windowEnd: original.windowEnd,
      status: "已发车",
      createdAt: now,
      dispatchedAt: now,
      isRelay: true,
      relayReason: reason.trim(),
      relayForId: original.id
    };
    state.value.assignments.push(relay);
    const s = stationById.value.get(original.stationId);
    const from = tankerById.value.get(original.tankerId);
    log("接力", `${s?.name} 接力车 ${tanker.plate} 已发车（原车 ${from?.plate}）：${reason.trim()}`);
    persist();
  }

  function resetAll() {
    clearState();
    state.value = buildSeed();
  }

  return {
    state,
    zones,
    stationById,
    tankerById,
    urgentStations,
    calmStations,
    activeAssignments,
    stationStatus,
    addStation,
    updateStation,
    removeStation,
    addTanker,
    updateTanker,
    setMaintenance,
    removeTanker,
    autoDispatch,
    confirmAssignment,
    dispatchAssignment,
    retryPending,
    dropPending,
    reopenRoads,
    registerRelay,
    resetAll
  };
});
