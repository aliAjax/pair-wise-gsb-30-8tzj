<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useSupplyStore } from "../store/supplyStore";
import { deficitOf } from "../domain/scheduler";
import { fmtShifts, fmtTime } from "../domain/format";
import type { Assignment } from "../domain/types";
import PendingCard from "../components/PendingCard.vue";

const store = useSupplyStore();

const metrics = computed(() => [
  { label: "断供风险站", value: store.urgentStations.length },
  { label: "待派缺口（吨）", value: store.pendingDeficit },
  { label: "在役罐车", value: store.availableTankers.length },
  { label: "占位吨数", value: store.reservedTons },
]);

const assignmentOf = (stationId: string) =>
  store.activeAssignments.find((a) => a.stationId === stationId);

const assignmentText = (stationId: string) => {
  const a = assignmentOf(stationId);
  return a
    ? `已排 ${store.tankerPlate(a.tankerId)} · ${a.tons} 吨 · ${a.window} 到站（${a.status}）`
    : "";
};

const pendingRows = computed(() =>
  store.pending.flatMap((item) => {
    const station = store.stations.find((s) => s.id === item.stationId);
    return station ? [{ item, station }] : [];
  })
);

const statusChip = (status: Assignment["status"]) =>
  status === "已确认" ? "info" : status === "已发车" ? "warn" : status === "已接力" ? "lock" : "info";

// 接力登记：同一时刻只展开一条
const relayOpen = ref<string | null>(null);
const relayForm = reactive({ vehicle: "", reason: "" });
const relayError = ref("");

function openRelay(id: string) {
  relayOpen.value = relayOpen.value === id ? null : id;
  relayForm.vehicle = "";
  relayForm.reason = "";
  relayError.value = "";
}

function submitRelay(a: Assignment) {
  const err = store.registerRelay(a.id, relayForm.vehicle.trim(), relayForm.reason.trim());
  relayError.value = err ?? "";
  if (!err) relayOpen.value = null;
}
</script>

<template>
  <section class="metrics four">
    <article v-for="m in metrics" :key="m.label" class="metric">
      <span>{{ m.label }}</span>
      <strong>{{ m.value }}</strong>
    </article>
  </section>

  <section class="panel section">
    <div class="section-head">
      <div>
        <h2>保供判定</h2>
        <p class="hint">缺口 = 班均销量 × 2 − 当前库存；可撑班次 &lt; 1 视为撑不到下一班，优先排车</p>
        <p v-if="store.roadStatus === '已解封'" class="hint">道路已解封，应急排车停用，恢复正常配送。</p>
      </div>
      <button type="button" :disabled="store.roadStatus !== '封闭中'" @click="store.autoSchedule()">
        一键排车（撑不到下一班优先）
      </button>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>断供风险油站</h2>
      <span class="hint">按保供等级、可撑班次排序</span>
    </div>
    <div v-if="store.urgentStations.length === 0" class="empty">暂无撑不到下一班的油站</div>
    <div class="card-list">
      <article v-for="(s, i) in store.urgentStations" :key="s.id" class="record">
        <div class="record-head">
          <p class="record-title">#{{ i + 1 }} {{ s.name }}</p>
          <span class="chip danger">撑不到下一班</span>
        </div>
        <div class="kv">
          <span>保供等级：<strong>{{ s.level }}</strong></span>
          <span>片区：<strong>{{ s.zone }}</strong></span>
          <span>库存 / 班均：<strong>{{ s.inventory }} / {{ s.shiftSales }} 吨</strong></span>
          <span>可撑：<strong>{{ fmtShifts(s) }}</strong></span>
          <span>缺口：<strong>{{ deficitOf(s) }} 吨</strong></span>
          <span>到站时段：<strong>{{ s.windows.join("、") }}</strong></span>
        </div>
        <p class="note">{{ assignmentText(s.id) || "尚未排车：点“一键排车”，排不下会留待派区写清缺口" }}</p>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>排车占位</h2>
      <span class="hint">已发车任务仅可登记接力车和原因</span>
    </div>
    <div v-if="store.activeAssignments.length === 0" class="empty">暂无占位</div>
    <div class="card-list">
      <article v-for="a in store.activeAssignments" :key="a.id" class="record">
        <div class="record-head">
          <p class="record-title">{{ store.stationName(a.stationId) }} ← {{ store.tankerPlate(a.tankerId) }}</p>
          <span class="chip" :class="statusChip(a.status)">{{ a.status }}</span>
        </div>
        <div class="kv">
          <span>排车吨数：<strong>{{ a.tons }} 吨</strong></span>
          <span>到站时段：<strong>{{ a.window }}</strong></span>
          <span>排车时间：<strong>{{ fmtTime(a.createdAt) }}</strong></span>
          <span>罐车剩余载重：<strong>{{ store.remainingOf(a.tankerId) }} 吨</strong></span>
        </div>
        <p v-if="a.relay" class="relay-info">
          接力车 {{ a.relay.vehicle }} ｜ 原因：{{ a.relay.reason }} ｜ 登记于 {{ fmtTime(a.relay.at) }}
        </p>
        <div class="actions">
          <button v-if="a.status === '已确认'" type="button" @click="store.dispatch(a.id)">发车</button>
          <button v-if="a.status === '已发车'" type="button" class="secondary" @click="openRelay(a.id)">
            登记接力车
          </button>
          <span v-if="a.status !== '已确认'" class="hint-inline">已发车任务仅可登记接力车和原因</span>
        </div>
        <form v-if="relayOpen === a.id" class="inline-form" @submit.prevent="submitRelay(a)">
          <div class="row">
            <label>
              接力车号
              <input v-model="relayForm.vehicle" placeholder="如 沪E·D9012" required />
            </label>
            <label>
              接力原因
              <input v-model="relayForm.reason" placeholder="如 原车在封控点抛锚" required />
            </label>
          </div>
          <p v-if="relayError" class="error-text">{{ relayError }}</p>
          <div class="actions">
            <button type="submit">保存接力登记</button>
            <button type="button" class="secondary" @click="relayOpen = null">取消</button>
          </div>
        </form>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>待派区</h2>
      <span class="hint">排不下的站留在这里，写清缺口与原因，可手动改派再次确认</span>
    </div>
    <div v-if="pendingRows.length === 0" class="empty">待派区为空</div>
    <div class="card-list">
      <PendingCard v-for="row in pendingRows" :key="row.item.stationId" :station="row.station" :item="row.item" />
    </div>
  </section>

  <section v-if="store.releasedAssignments.length > 0" class="section">
    <div class="section-head">
      <h2>已释放占位</h2>
      <span class="hint">解封后释放的原占位，仅留档</span>
    </div>
    <div class="card-list">
      <article v-for="a in store.releasedAssignments" :key="a.id" class="record muted">
        <div class="record-head">
          <p class="record-title">{{ store.stationName(a.stationId) }} ← {{ store.tankerPlate(a.tankerId) }}</p>
          <span class="chip info">已释放</span>
        </div>
        <div class="kv">
          <span>吨数：<strong>{{ a.tons }} 吨</strong></span>
          <span>原到站时段：<strong>{{ a.window }}</strong></span>
        </div>
      </article>
    </div>
  </section>
</template>
