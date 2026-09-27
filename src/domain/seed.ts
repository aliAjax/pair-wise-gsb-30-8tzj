import type { SupplyState } from "./types";

/** 初始演示数据：暴雨封路，部分油站撑不到下一班 */
export function seedState(): SupplyState {
  const at = new Date().toISOString();
  return {
    roadStatus: "封闭中",
    stations: [
      { id: "st-chengdong", name: "城东站", zone: "城东片区", inventory: 6, shiftSales: 9, level: "重点保供", windows: ["06:00-10:00", "14:00-18:00"] },
      { id: "st-xinqu", name: "新区站", zone: "新区片区", inventory: 4, shiftSales: 7, level: "重点保供", windows: ["06:00-10:00", "18:00-22:00"] },
      { id: "st-lingang", name: "临港站", zone: "临港片区", inventory: 3, shiftSales: 8, level: "一般保供", windows: ["14:00-18:00"] },
      { id: "st-jichang", name: "机场站", zone: "机场片区", inventory: 15, shiftSales: 8, level: "常规保供", windows: ["08:00-12:00"] },
      { id: "st-binjiang", name: "滨江站", zone: "新区片区", inventory: 9, shiftSales: 5, level: "常规保供", windows: ["08:00-12:00", "14:00-18:00"] },
    ],
    tankers: [
      { id: "tk-a", plate: "沪A·D2103", capacity: 14, zones: ["城东片区", "新区片区"], status: "在役" },
      { id: "tk-b", plate: "沪B·D8871", capacity: 12, zones: ["机场片区", "临港片区"], status: "在役" },
      { id: "tk-c", plate: "沪C·D5520", capacity: 20, zones: ["城东片区", "机场片区", "新区片区", "临港片区"], status: "检修" },
      { id: "tk-d", plate: "沪D·D3366", capacity: 10, zones: ["新区片区"], status: "在役" },
    ],
    assignments: [],
    pending: [],
    logs: [
      {
        id: "log-seed",
        at,
        kind: "封路",
        text: "暴雨导致多条道路封闭，启动区域断供保供，调度员逐站核对库存与班均销量。",
      },
    ],
  };
}
