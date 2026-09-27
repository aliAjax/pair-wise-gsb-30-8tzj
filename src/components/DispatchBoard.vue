<script setup lang="ts">
import { reactive, ref } from "vue";
import { useDeskStore } from "../stores/desk";
import { eligibleRelayTankers, eligibleTankers, gapTons, hasTimeConflict } from "../domain/rules";
import type { Assignment, PendingGap, Station, Tanker } from "../domain/types";
import { formatTime } from "../ledger/ledger";

const desk = useDeskStore();

const manualTanker = reactive<Record<string, string>>({});
const relayFor = ref<string | null>(null);
const relayTanker = ref("");
const relayReason = ref("");

const shiftsText = (s: Station) => (s.shiftSalesTons > 0 ? (s.inventoryTons / s.shiftSalesTons).toFixed(1) : "—");
const stationName = (id: string) => desk.stationById.get(id)?.name ?? "（油站已删除）";
const tankerPlate = (id: string) => desk.tankerById.get(id)?.plate ?? "（罐车已删除）";
const eligibleIds = (s: Station) => new Set(eligibleTankers(desk.state, s, gapTons(s)).map((t) => t.id));
const relayCandidates = (a: Assignment) => eligibleRelayTankers(desk.state, a);

/** 罐车下拉项写清不可选原因，让判定摆在台面上 */
function optionLabel(s: Station, t: Tanker): string {
  const base = `${t.plate} · ${t.capacityTons}吨 · ${t.zones.join("/")}`;
  if (t.inMaintenance) return `${base} · 检修中`;
  if (!t.zones.includes(s.zone)) return `${base} · 不走${s.zone}`;
  if (t.capacityTons < gapTons(s)) return `${base} · 载重不足`;
  if (hasTimeConflict(desk.state, t.id, s.windowStart, s.windowEnd)) return `${base} · 时段冲突`;
  return base;
}

function statusClass(status: string) {
  return status === "已排车" ? "ok" : status === "待派区" ? "warn" : "danger";
}

function runAuto() {
  try {
    const result = desk.autoDispatch();
    if (result.assigned === 0 && result.pending === 0) window.alert("没有新的告急油站需要排车");
  } catch (e) {
    window.alert((e as Error).message);
  }
}

function confirmManual(stationId: string) {
  const tankerId = manualTanker[stationId];
  if (!tankerId) {
    window.alert("请先选择罐车");
    return;
  }
  try {
    desk.confirmAssignment(stationId, tankerId);
    manualTanker[stationId] = "";
  } catch (e) {
    window.alert((e as Error).message);
  }
}

function dispatch(id: string) {
  try {
    desk.dispatchAssignment(id);
  } catch (e) {
    window.alert((e as Error).message);
  }
}

function retry(id: string) {
  try {
    desk.retryPending(id);
  } catch (e) {
    window.alert((e as Error).message);
  }
}

function drop(p: PendingGap) {
  if (!window.confirm(`确定办结「${stationName(p.stationId)}」的待派缺口？`)) return;
  desk.dropPending(p.id);
}

function openRelay(id: string) {
  relayFor.value = id;
  relayTanker.value = "";
  relayReason.value = "";
}

function submitRelay() {
  if (!relayFor.value) return;
  try {
    desk.registerRelay(relayFor.value, relayTanker.value, relayReason.value);
    relayFor.value = null;
  } catch (e) {
    window.alert((e as Error).message);
  }
}
</script>

<template>
  <div>
    <div v-if="!desk.state.roadClosed" class="banner ok">
      道路已解封：未发车的原占位已释放；已发车任务保留，只能登记接力车和原因。
    </div>
    <div class="board-grid">
      <section class="panel col">
        <div class="col-head">
          <h2>告急油站 <span class="tag danger">{{ desk.urgentStations.length }}</span></h2>
          <button type="button" :disabled="!desk.state.roadClosed" @click="runAuto">一键排车</button>
        </div>
        <p class="hint">撑不到下一班（库存 ÷ 班均销量 &lt; 1 班）的站优先，按保供等级、可撑班次排序。</p>
        <div v-if="desk.urgentStations.length === 0" class="empty">暂无告急油站</div>
        <article v-for="s in desk.urgentStations" :key="s.id" class="card">
          <div class="card-head">
            <p class="card-title">{{ s.name }} <span class="muted">{{ s.zone }}</span></p>
            <span class="tag" :class="statusClass(desk.stationStatus(s.id))">{{ desk.stationStatus(s.id) }}</span>
          </div>
          <div class="details">
            <span>保供等级: {{ s.grade }}</span>
            <span>到站时段: {{ s.windowStart }}-{{ s.windowEnd }}</span>
            <span>库存: {{ s.inventoryTons }} 吨</span>
            <span>班均销量: {{ s.shiftSalesTons }} 吨</span>
            <span>可撑: {{ shiftsText(s) }} 班</span>
            <span class="gap">缺口: {{ gapTons(s) }} 吨</span>
          </div>
          <p class="judge">判定：库存 ÷ 班均 = {{ shiftsText(s) }} 班 &lt; 1 班，撑不到下一班</p>
          <div v-if="desk.stationStatus(s.id) !== '已排车'" class="assign-row">
            <select v-model="manualTanker[s.id]" :disabled="!desk.state.roadClosed">
              <option value="">选择罐车</option>
              <option
                v-for="t in desk.state.tankers"
                :key="t.id"
                :value="t.id"
                :disabled="!eligibleIds(s).has(t.id)"
              >{{ optionLabel(s, t) }}</option>
            </select>
            <button type="button" :disabled="!desk.state.roadClosed" @click="confirmManual(s.id)">确认排车</button>
          </div>
        </article>
        <div v-if="desk.calmStations.length" class="calm">
          <p class="hint">其余油站均能撑过下一班：</p>
          <p v-for="s in desk.calmStations" :key="s.id" class="calm-row">
            {{ s.name }}（{{ s.zone }}）可撑 {{ shiftsText(s) }} 班
          </p>
        </div>
      </section>

      <section class="panel col">
        <div class="col-head">
          <h2>留待派区 <span class="tag warn">{{ desk.state.pendings.length }}</span></h2>
        </div>
        <p class="hint">片区可走、载重够缺口且时段不冲突的罐车凑不齐时，缺口留在这里并写清原因。</p>
        <div v-if="desk.state.pendings.length === 0" class="empty">没有待派缺口</div>
        <article v-for="p in desk.state.pendings" :key="p.id" class="card">
          <div class="card-head">
            <p class="card-title">{{ stationName(p.stationId) }}</p>
            <span class="tag warn">缺口 {{ p.gapTons }} 吨</span>
          </div>
          <ul class="reasons">
            <li v-for="(r, i) in p.reasons" :key="i">{{ r }}</li>
          </ul>
          <p class="muted small">登记于 {{ formatTime(p.createdAt) }}</p>
          <div class="actions">
            <button type="button" :disabled="!desk.state.roadClosed" @click="retry(p.id)">重试排车</button>
            <button class="secondary" type="button" @click="drop(p)">办结</button>
          </div>
        </article>
      </section>

      <section class="panel col">
        <div class="col-head">
          <h2>排车与接力 <span class="tag ok">{{ desk.activeAssignments.length }}</span></h2>
        </div>
        <div v-if="desk.activeAssignments.length === 0" class="empty">暂无排车</div>
        <article v-for="a in desk.activeAssignments" :key="a.id" class="card">
          <div class="card-head">
            <p class="card-title">{{ stationName(a.stationId) }}</p>
            <span class="tag" :class="a.status === '已发车' ? 'ok' : 'info'">{{ a.status }}</span>
          </div>
          <div class="details">
            <span>罐车: {{ tankerPlate(a.tankerId) }}</span>
            <span>补油: {{ a.gapTons }} 吨</span>
            <span>到站时段: {{ a.windowStart }}-{{ a.windowEnd }}</span>
            <span v-if="a.dispatchedAt">发车: {{ formatTime(a.dispatchedAt) }}</span>
          </div>
          <p v-if="a.isRelay" class="relay">接力车 · 原因：{{ a.relayReason }}</p>
          <div class="actions">
            <button v-if="a.status === '已确认' && desk.state.roadClosed" type="button" @click="dispatch(a.id)">发车</button>
            <button v-if="a.status === '已发车' && !desk.state.roadClosed" class="secondary" type="button" @click="openRelay(a.id)">登记接力车</button>
          </div>
          <div v-if="relayFor === a.id" class="relay-form">
            <select v-model="relayTanker">
              <option value="">选择接力罐车</option>
              <option v-for="t in relayCandidates(a)" :key="t.id" :value="t.id">{{ t.plate }} · {{ t.capacityTons }}吨</option>
            </select>
            <input v-model="relayReason" placeholder="接力原因（如原车故障、绕行抛锚）" />
            <div class="actions">
              <button type="button" @click="submitRelay">确认接力</button>
              <button class="secondary" type="button" @click="relayFor = null">取消</button>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>
