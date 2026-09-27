<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Station } from "../domain/types";
import { deficitOf, isUrgent } from "../domain/scheduler";
import { fmtShifts } from "../domain/format";
import { useSupplyStore } from "../store/supplyStore";

const props = defineProps<{ station: Station }>();
const store = useSupplyStore();

const inv = ref(props.station.inventory);
watch(
  () => props.station.inventory,
  (v) => (inv.value = v)
);
const error = ref("");

const urgent = computed(() => isUrgent(props.station));
const deficit = computed(() => deficitOf(props.station));
const assignment = computed(() =>
  store.activeAssignments.find((a) => a.stationId === props.station.id)
);
const levelChip = computed(() =>
  props.station.level === "重点保供" ? "danger" : props.station.level === "常规保供" ? "warn" : "info"
);

function saveInventory() {
  if (inv.value < 0) {
    error.value = "库存不能为负";
    return;
  }
  store.updateInventory(props.station.id, Number(inv.value));
  error.value = "";
}

function remove() {
  const err = store.removeStation(props.station.id);
  error.value = err ?? "";
}
</script>

<template>
  <article class="record">
    <div class="record-head">
      <p class="record-title">{{ station.name }}</p>
      <span class="chip" :class="levelChip">{{ station.level }}</span>
      <span v-if="urgent" class="chip danger">撑不到下一班</span>
    </div>
    <div class="kv">
      <span>片区：<strong>{{ station.zone }}</strong></span>
      <span>库存：<strong>{{ station.inventory }} 吨</strong></span>
      <span>班均销量：<strong>{{ station.shiftSales }} 吨/班</strong></span>
      <span>可撑：<strong>{{ fmtShifts(station) }}</strong></span>
      <span>缺口：<strong>{{ deficit }} 吨</strong></span>
      <span>到站时段：<strong>{{ station.windows.join("、") }}</strong></span>
    </div>
    <p v-if="assignment" class="note">
      在途占位：{{ store.tankerPlate(assignment.tankerId) }} · {{ assignment.tons }} 吨 ·
      {{ assignment.window }}（{{ assignment.status }}）
    </p>
    <div class="actions">
      <input v-model.number="inv" class="inline-input" type="number" min="0" step="0.1" />
      <button type="button" class="secondary" @click="saveInventory">更新库存</button>
      <button type="button" class="danger" :disabled="!!assignment" @click="remove">注销</button>
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
  </article>
</template>
