import type { DeskState } from "./types";

export const SEED_ZONES = ["城东片区", "城西片区", "机场片区", "新区片区", "城北片区"];

/**
 * 演示数据：5 座告急站。
 * - 机场站/城东站/南湖站可确认排车；
 * - 新区站因到站时段与在排任务冲突留待派区；
 * - 北门站所在城北片区无可走罐车，留待派区。
 */
export function seedState(): DeskState {
  return {
    roadClosed: true,
    stations: [
      { id: "st-jichang", name: "机场站", zone: "机场片区", inventoryTons: 1, shiftSalesTons: 15, grade: "重点保供", windowStart: "09:00", windowEnd: "11:00" },
      { id: "st-chengdong", name: "城东站", zone: "城东片区", inventoryTons: 2, shiftSalesTons: 16, grade: "重点保供", windowStart: "08:00", windowEnd: "10:00" },
      { id: "st-nanhu", name: "南湖站", zone: "城西片区", inventoryTons: 2, shiftSalesTons: 8, grade: "常规保供", windowStart: "10:00", windowEnd: "12:00" },
      { id: "st-xinqu", name: "新区站", zone: "新区片区", inventoryTons: 5, shiftSalesTons: 9, grade: "常规保供", windowStart: "08:00", windowEnd: "10:00" },
      { id: "st-beimen", name: "北门站", zone: "城北片区", inventoryTons: 1, shiftSalesTons: 6, grade: "一般保供", windowStart: "13:00", windowEnd: "15:00" },
      { id: "st-jiangtan", name: "江滩站", zone: "城东片区", inventoryTons: 15, shiftSalesTons: 9, grade: "一般保供", windowStart: "14:00", windowEnd: "16:00" },
      { id: "st-laocheng", name: "老城站", zone: "城西片区", inventoryTons: 20, shiftSalesTons: 7, grade: "常规保供", windowStart: "15:00", windowEnd: "17:00" }
    ],
    tankers: [
      { id: "tk-001", plate: "鄂A·T1001", capacityTons: 8, zones: ["城东片区", "城西片区"], inMaintenance: false },
      { id: "tk-002", plate: "鄂A·T1002", capacityTons: 12, zones: ["城东片区", "机场片区"], inMaintenance: false },
      { id: "tk-003", plate: "鄂A·T1003", capacityTons: 16, zones: ["机场片区", "新区片区"], inMaintenance: false },
      { id: "tk-004", plate: "鄂A·T1004", capacityTons: 20, zones: ["城东片区", "城西片区", "新区片区"], inMaintenance: false },
      { id: "tk-005", plate: "鄂A·T1005", capacityTons: 10, zones: ["新区片区"], inMaintenance: true }
    ],
    assignments: [],
    pendings: [],
    ledger: []
  };
}
