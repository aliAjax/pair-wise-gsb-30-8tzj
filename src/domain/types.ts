export const ZONES = ["城东片区", "机场片区", "新区片区", "临港片区"] as const;
export type Zone = (typeof ZONES)[number];

export const SUPPLY_LEVELS = ["重点保供", "常规保供", "一般保供"] as const;
export type SupplyLevel = (typeof SUPPLY_LEVELS)[number];

export const TIME_WINDOWS = ["06:00-10:00", "08:00-12:00", "14:00-18:00", "18:00-22:00"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

/** 油站登记：库存、班均销量、保供等级、到站时段 */
export interface Station {
  id: string;
  name: string;
  zone: Zone;
  inventory: number; // 当前库存（吨）
  shiftSales: number; // 班均销量（吨/班）
  level: SupplyLevel; // 保供等级
  windows: TimeWindow[]; // 可接油的到站时段
}

export type TankerStatus = "在役" | "检修";

/** 罐车登记：载重、可走片区、检修状态 */
export interface Tanker {
  id: string;
  plate: string;
  capacity: number; // 载重（吨）
  zones: Zone[]; // 可走片区
  status: TankerStatus; // 检修状态
}

export type AssignmentStatus = "已确认" | "已发车" | "已接力" | "已释放";

export interface RelayRecord {
  vehicle: string; // 接力车号
  reason: string; // 接力原因
  at: string;
}

/** 排车占位 */
export interface Assignment {
  id: string;
  stationId: string;
  tankerId: string;
  tons: number; // 排车吨数（= 确认时的缺口）
  window: TimeWindow;
  status: AssignmentStatus;
  createdAt: string;
  relay?: RelayRecord; // 已发车后仅可登记接力车和原因
}

/** 待派区：排不下的站 + 缺口 + 原因 */
export interface PendingItem {
  stationId: string;
  deficit: number; // 缺口（吨）
  reason: string;
  at: string;
}

export type LogKind = "登记" | "判定" | "确认" | "发车" | "接力" | "释放" | "解封" | "封路";

/** 留档 */
export interface LogEntry {
  id: string;
  at: string;
  kind: LogKind;
  text: string;
}

export type RoadStatus = "封闭中" | "已解封";

export interface SupplyState {
  roadStatus: RoadStatus;
  stations: Station[];
  tankers: Tanker[];
  assignments: Assignment[];
  pending: PendingItem[];
  logs: LogEntry[];
}
