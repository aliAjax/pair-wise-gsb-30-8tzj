<script setup lang="ts">
import { computed, ref } from "vue";
import { useSupplyStore } from "../store/supplyStore";
import { fmtTime } from "../domain/format";
import type { LogKind } from "../domain/types";

const store = useSupplyStore();

const kinds: ("全部" | LogKind)[] = ["全部", "登记", "判定", "确认", "发车", "接力", "释放", "解封", "封路"];
const filter = ref<(typeof kinds)[number]>("全部");

const list = computed(() =>
  filter.value === "全部" ? store.logs : store.logs.filter((l) => l.kind === filter.value)
);

const chipOf = (kind: LogKind) =>
  kind === "确认" || kind === "解封"
    ? "ok"
    : kind === "发车"
      ? "warn"
      : kind === "接力"
        ? "lock"
        : kind === "释放" || kind === "封路"
          ? "danger"
          : "info";
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>留档</h2>
      <select v-model="filter" class="filter-select">
        <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
      </select>
    </div>
    <div v-if="list.length === 0" class="empty">暂无留档</div>
    <div class="log-list">
      <article v-for="entry in list" :key="entry.id" class="log-item">
        <div class="log-meta">
          <span class="chip" :class="chipOf(entry.kind)">{{ entry.kind }}</span>
          <time>{{ fmtTime(entry.at) }}</time>
        </div>
        <p>{{ entry.text }}</p>
      </article>
    </div>
  </section>
</template>
