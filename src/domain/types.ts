export type Grade = "重点保供" | "常规保供" | "一般保供";

export const GRADES: Grade[] = ["重点保供", "常规保供", "一般保供"];

export type AssignmentStatus = "已确认" | "已发车";

export type EventKind = "登记" | "判定" | "排车" | "发车" | "解封" | "接力" | "清理";

export const EVENT_KINDS: EventKind[] = ["登记", "判定", "排车", "发车", "解封", "接力", "清理"];

export interface Station {
  id: string;
  name: string;
  zone: string;
  inventoryTons: number;
  shiftSalesTons: number;
  grade: Grade;
  windowStart: string; // HH:mm，可接油时段开始
  windowEnd: string; // HH:mm，可接油时段结束
}

export interface Tanker {
  id: string;
  plate: string;
  capacityTons: number;
  zones: string[];
  inMaintenance: boolean;
}

export interface Assignment {
  id: string;
  stationId: string;
  tankerId: string;
  gapTons: number;
  windowStart: string;
  windowEnd: string;
  status: AssignmentStatus;
  createdAt: string;
  dispatchedAt?: string;
  isRelay?: boolean;
  relayReason?: string;
  relayForId?: string;
}

export interface PendingGap {
  id: string;
  stationId: string;
  gapTons: number;
  reasons: string[];
  createdAt: string;
}

export interface LedgerEvent {
  id: string;
  at: string;
  kind: EventKind;
  message: string;
}

export interface DeskState {
  stations: Station[];
  tankers: Tanker[];
  assignments: Assignment[];
  pendings: PendingGap[];
  ledger: LedgerEvent[];
  roadClosed: boolean;
}
