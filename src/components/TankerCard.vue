<script setup lang="ts">
import { computed, ref } from "vue";
import type { Tanker } from "../domain/types";
import { useSupplyStore } from "../store/supplyStore";

const props = defineProps<{ tanker: Tanker }>();
const store = useSupplyStore();

const error = ref("");
const remaining = computed(() => store.remainingOf(props.tanker.id));
const busy = computed(() =>
  store.activeAssignments.filter((a) => a.tankerId === props.tanker.id)
);

function toggleStatus() {
  const next = props.tanker.status === "在役" ? "检修" : "在役";
  const err = store.setTankerStatus(props.tanker.id, next);
  error.value = err ?? "";
}

function remove() {
  const err = store.removeTanker(props.tanker.id);
  error.value = err ?? "";
}
</script>

<template>
  <article class="record">
    <div class="record-head">
      <p class="record-title">{{ tanker.plate }}</p>
      <span class="chip" :class="tanker.status === '在役' ? 'ok' : 'danger'">{{ tanker.status }}</span>
    </div>
    <div class="kv">
      <span>载重：<strong>{{ tanker.capacity }} 吨</strong></span>
      <span>剩余载重：<strong>{{ remaining }} 吨</strong></span>
      <span>可走片区：<strong>{{ tanker.zones.join("、") }}</strong></span>
      <span>
        在途任务：
        <strong>{{ busy.length ? busy.map((a) => `${store.stationName(a.stationId)} ${a.window}`).join("；") : "无" }}</strong>
      </span>
    </div>
    <div class="actions">
      <button type="button" class="secondary" @click="toggleStatus">
        {{ tanker.status === "在役" ? "转检修" : "转在役" }}
      </button>
      <button type="button" class="danger" :disabled="busy.length > 0" @click="remove">注销</button>
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
  </article>
</template>
