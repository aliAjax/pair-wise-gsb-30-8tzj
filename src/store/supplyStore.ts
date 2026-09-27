import { defineStore } from "pinia";
import type {
  Assignment,
  LogKind,
  PendingItem,
  Station,
  SupplyLevel,
  SupplyState,
  Tanker,
  TankerStatus,
  TimeWindow,
  Zone,
} from "../domain/types";
import { seedState } from "../domain/seed";
import {
  ACTIVE_STATUSES,
  compareUrgency,
  deficitOf,
  isUrgent,
  planAssignments,
  remainingCapacity,
  validateManual,
} from "../domain/scheduler";

const STORAGE_KEY = "hxwlfront-19-supply-guard-v1";

function loadState(): SupplyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SupplyState;
      if (
        parsed &&
        Array.isArray(parsed.stations) &&
        Array.isArray(parsed.tankers) &&
        Array.isArray(parsed.assignments) &&
        Array.isArray(parsed.pending) &&
        Array.isArray(parsed.logs)
      ) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回退到种子数据
  }
  return seedState();
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const r1 = (n: number) => Math.round(n * 10) / 10;

export const useSupplyStore = defineStore("supplyGuard", {
  state: (): SupplyState => loadState(),
  getters: {
    /** 撑不到下一班的站，按保供等级 + 可撑班次排序 */
    urgentStations(state): Station[] {
      return state.stations.filter(isUrgent).sort(compareUrgency);
    },
    activeAssignments(state): Assignment[] {
      return state.assignments.filter((a) => ACTIVE_STATUSES.includes(a.status));
    },
    releasedAssignments(state): Assignment[] {
      return state.assignments.filter((a) => a.status === "已释放");
    },
    reservedTons(state): number {
      return r1(
        state.assignments
          .filter((a) => ACTIVE_STATUSES.includes(a.status))
          .reduce((sum, a) => sum + a.tons, 0)
      );
    },
    pendingDeficit(state): number {
      return r1(state.pending.reduce((sum, p) => sum + p.deficit, 0));
    },
    availableTankers(state): Tanker[] {
      return state.tankers.filter((t) => t.status === "在役");
    },
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
    },
    log(kind: LogKind, text: string) {
      this.logs.unshift({ id: uid(), at: now(), kind, text });
    },
    stationName(id: string) {
      return this.stations.find((s) => s.id === id)?.name ?? "未知油站";
    },
    tankerPlate(id: string) {
      return this.tankers.find((t) => t.id === id)?.plate ?? "未知罐车";
    },
    remainingOf(tankerId: string) {
      const tanker = this.tankers.find((t) => t.id === tankerId);
      return tanker ? remainingCapacity(tanker, this.assignments) : 0;
    },

    // ---------- 油站登记 ----------
    addStation(input: {
      name: string;
      zone: Zone;
      inventory: number;
      shiftSales: number;
      level: SupplyLevel;
      windows: TimeWindow[];
    }) {
      const station: Station = { id: uid(), ...input };
      this.stations.push(station);
      this.log(
        "登记",
        `油站 ${station.name}（${station.zone}）登记：库存 ${station.inventory} 吨，班均 ${station.shiftSales} 吨，${station.level}，到站时段 ${station.windows.join("、")}`
      );
      this.persist();
    },
    updateInventory(stationId: string, inventory: number) {
      const station = this.stations.find((s) => s.id === stationId);
      if (!station || inventory < 0) return;
      station.inventory = r1(inventory);
      this.log("登记", `${station.name} 库存更新为 ${station.inventory} 吨（班均 ${station.shiftSales} 吨）`);
      this.persist();
    },
    removeStation(stationId: string): string | null {
      const station = this.stations.find((s) => s.id === stationId);
      if (!station) return "油站不存在";
      if (this.activeAssignments.some((a) => a.stationId === stationId))
        return "该站有在途占位，不能注销";
      this.stations = this.stations.filter((s) => s.id !== stationId);
      this.pending = this.pending.filter((p) => p.stationId !== stationId);
      this.log("登记", `油站 ${station.name} 注销`);
      this.persist();
      return null;
    },

    // ---------- 罐车登记 ----------
    addTanker(input: { plate: string; capacity: number; zones: Zone[]; status: TankerStatus }) {
      const tanker: Tanker = { id: uid(), ...input };
      this.tankers.push(tanker);
      this.log(
        "登记",
        `罐车 ${tanker.plate} 登记：载重 ${tanker.capacity} 吨，可走 ${tanker.zones.join("、")}，${tanker.status}`
      );
      this.persist();
    },
    setTankerStatus(tankerId: string, status: TankerStatus): string | null {
      const tanker = this.tankers.find((t) => t.id === tankerId);
      if (!tanker) return "罐车不存在";
      if (status === "检修" && this.activeAssignments.some((a) => a.tankerId === tankerId))
        return "该车有在途任务，不能转检修";
      tanker.status = status;
      this.log("登记", `罐车 ${tanker.plate} 状态调整为${status}`);
      this.persist();
      return null;
    },
    removeTanker(tankerId: string): string | null {
      const tanker = this.tankers.find((t) => t.id === tankerId);
      if (!tanker) return "罐车不存在";
      if (this.activeAssignments.some((a) => a.tankerId === tankerId))
        return "该车有在途任务，不能注销";
      this.tankers = this.tankers.filter((t) => t.id !== tankerId);
      this.log("登记", `罐车 ${tanker.plate} 注销`);
      this.persist();
      return null;
    },

    // ---------- 判定 / 排车 ----------
    autoSchedule() {
      if (this.roadStatus !== "封闭中") return;
      const at = now();
      const { drafts, pending } = planAssignments(this.stations, this.tankers, this.assignments, at);
      for (const d of drafts) {
        this.assignments.push({ ...d, id: uid(), status: "已确认", createdAt: at });
        this.log(
          "确认",
          `${this.stationName(d.stationId)} 缺口 ${d.tons} 吨，排 ${this.tankerPlate(d.tankerId)}，${d.window} 到站`
        );
      }
      this.pending = pending;
      for (const p of pending) {
        this.log("判定", `${this.stationName(p.stationId)} 排不下，留待派区：${p.reason}`);
      }
      if (drafts.length === 0 && pending.length === 0) {
        this.log("判定", "本轮没有需要排车的断供风险站");
      }
      this.persist();
    },

    manualSchedule(
      stationId: string,
      tankerId: string,
      window: TimeWindow,
      tons: number
    ): string | null {
      const station = this.stations.find((s) => s.id === stationId);
      const tanker = this.tankers.find((t) => t.id === tankerId);
      if (!station || !tanker) return "油站或罐车不存在";
      const at = now();
      const err = validateManual(station, tanker, window, tons, this.assignments);
      if (err) {
        // 手动确认失败也回写待派区，写清缺口与原因
        const item: PendingItem = { stationId, deficit: deficitOf(station), reason: err, at };
        const idx = this.pending.findIndex((p) => p.stationId === stationId);
        if (idx >= 0) this.pending.splice(idx, 1, item);
        else this.pending.push(item);
        this.log("判定", `${station.name} 手动排车失败：${err}`);
        this.persist();
        return err;
      }
      this.assignments.push({
        id: uid(),
        stationId,
        tankerId,
        tons: r1(tons),
        window,
        status: "已确认",
        createdAt: at,
      });
      this.pending = this.pending.filter((p) => p.stationId !== stationId);
      this.log("确认", `${station.name} 手动排 ${tanker.plate} ${r1(tons)} 吨，${window} 到站`);
      this.persist();
      return null;
    },

    dispatch(assignmentId: string) {
      const a = this.assignments.find((x) => x.id === assignmentId);
      if (!a || a.status !== "已确认") return;
      a.status = "已发车";
      this.log(
        "发车",
        `${this.tankerPlate(a.tankerId)} 发往 ${this.stationName(a.stationId)}，${a.tons} 吨，${a.window} 到站；此后仅可登记接力车和原因`
      );
      this.persist();
    },

    /** 已发车的任务只能登记接力车和原因 */
    registerRelay(assignmentId: string, vehicle: string, reason: string): string | null {
      const a = this.assignments.find((x) => x.id === assignmentId);
      if (!a) return "任务不存在";
      if (a.status !== "已发车") return "只有已发车的任务才能登记接力车";
      if (!vehicle || !reason) return "接力车号和原因都要填写";
      a.relay = { vehicle, reason, at: now() };
      a.status = "已接力";
      this.log("接力", `${this.stationName(a.stationId)} 在途任务改由 ${vehicle} 接力，原因：${reason}`);
      this.persist();
      return null;
    },

    // ---------- 解封 / 封路 ----------
    reopenRoads() {
      if (this.roadStatus === "已解封") return;
      let released = 0;
      for (const a of this.assignments) {
        if (a.status === "已确认") {
          a.status = "已释放";
          released += 1;
          this.log(
            "释放",
            `解封释放占位：${this.stationName(a.stationId)} ${a.tons} 吨（${a.window}，原车 ${this.tankerPlate(a.tankerId)}）`
          );
        }
      }
      if (this.pending.length > 0) {
        this.log("解封", `待派区 ${this.pending.length} 个站随解封清零，恢复正常配送`);
        this.pending = [];
      }
      this.roadStatus = "已解封";
      this.log(
        "解封",
        `道路解封：释放未发车占位 ${released} 笔；已发车任务保留，仅可登记接力车和原因`
      );
      this.persist();
    },
    closeRoads() {
      if (this.roadStatus === "封闭中") return;
      this.roadStatus = "封闭中";
      this.log("封路", "再次封路，恢复应急保供排车");
      this.persist();
    },
  },
});
