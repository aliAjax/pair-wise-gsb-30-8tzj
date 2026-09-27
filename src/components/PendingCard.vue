<script setup lang="ts">
import { ref } from "vue";
import { useSupplyStore } from "../store/supplyStore";
import { fmtTime } from "../domain/format";
import type { PendingItem, Station, TimeWindow } from "../domain/types";

const props = defineProps<{ station: Station; item: PendingItem }>();
const store = useSupplyStore();

const tankerId = ref("");
const window_ = ref<TimeWindow | "">("");
const tons = ref(props.item.deficit);
const error = ref("");

function confirm() {
  if (!tankerId.value || !window_.value) {
    error.value = "请选择罐车和到站时段";
    return;
  }
  const err = store.manualSchedule(
    props.station.id,
    tankerId.value,
    window_.value as TimeWindow,
    Number(tons.value)
  );
  error.value = err ?? "";
}
</script>

<template>
  <article class="record pending">
    <div class="record-head">
      <p class="record-title">{{ station.name }}</p>
      <span class="chip warn">待派 · 缺口 {{ item.deficit }} 吨</span>
    </div>
    <p class="note">{{ item.reason }}（判定于 {{ fmtTime(item.at) }}）</p>
    <div class="kv">
      <span>片区：<strong>{{ station.zone }}</strong></span>
      <span>可接时段：<strong>{{ station.windows.join("、") || "未登记" }}</strong></span>
    </div>
    <form class="inline-form" @submit.prevent="confirm">
      <div class="row">
        <label>
          罐车
          <select v-model="tankerId" required>
            <option value="">请选择</option>
            <option v-for="t in store.tankers" :key="t.id" :value="t.id" :disabled="t.status !== '在役'">
              {{ t.plate }}｜剩 {{ store.remainingOf(t.id) }} 吨｜{{ t.zones.join("/") }}{{ t.status !== "在役" ? "｜检修" : "" }}
            </option>
          </select>
        </label>
        <label>
          到站时段
          <select v-model="window_" required>
            <option value="">请选择</option>
            <option v-for="w in station.windows" :key="w" :value="w">{{ w }}</option>
          </select>
        </label>
        <label>
          吨数
          <input v-model.number="tons" type="number" min="0.1" step="0.1" required />
        </label>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="actions">
        <button type="submit">确认排车</button>
      </div>
    </form>
  </article>
</template>
