<script setup lang="ts">
import { computed, ref } from "vue";
import { useDeskStore } from "../stores/desk";
import { EVENT_KINDS } from "../domain/types";
import type { EventKind } from "../domain/types";
import { formatTime } from "../ledger/ledger";

const desk = useDeskStore();
const kindFilter = ref<"全部" | EventKind>("全部");

const filtered = computed(() =>
  kindFilter.value === "全部" ? desk.state.ledger : desk.state.ledger.filter((e) => e.kind === kindFilter.value)
);

function kindClass(kind: EventKind) {
  switch (kind) {
    case "判定":
      return "warn";
    case "排车":
    case "发车":
      return "ok";
    case "解封":
      return "danger";
    case "接力":
    case "登记":
      return "info";
    default:
      return "";
  }
}

function exportArchive() {
  const blob = new Blob([JSON.stringify(desk.state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `保供台留档-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>留档（判定与操作流水）</h2>
      <div class="actions">
        <select v-model="kindFilter">
          <option>全部</option>
          <option v-for="k in EVENT_KINDS" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="secondary" type="button" @click="exportArchive">导出留档 JSON</button>
      </div>
    </div>
    <div v-if="filtered.length === 0" class="empty">暂无留档</div>
    <ul class="ledger">
      <li v-for="e in filtered" :key="e.id">
        <span class="tag" :class="kindClass(e.kind)">{{ e.kind }}</span>
        <span class="muted">{{ formatTime(e.at) }}</span>
        <span>{{ e.message }}</span>
      </li>
    </ul>
  </section>
</template>
