<script setup lang="ts">
import { computed, ref } from "vue";
import { useDeskStore } from "./stores/desk";
import DispatchBoard from "./components/DispatchBoard.vue";
import StationPanel from "./components/StationPanel.vue";
import TankerPanel from "./components/TankerPanel.vue";
import ArchivePanel from "./components/ArchivePanel.vue";

const desk = useDeskStore();

const tabs = [
  { key: "board", label: "排车台" },
  { key: "stations", label: "油站登记" },
  { key: "tankers", label: "罐车登记" },
  { key: "archive", label: "留档" }
] as const;

const tab = ref<(typeof tabs)[number]["key"]>("board");

const stats = computed(() => ({
  urgent: desk.urgentStations.length,
  confirmed: desk.state.assignments.filter((a) => a.status === "已确认").length,
  dispatched: desk.state.assignments.filter((a) => a.status === "已发车").length,
  pending: desk.state.pendings.length
}));

function reopen() {
  if (!window.confirm("解封后将释放全部未发车的原占位，已发车任务仅可登记接力车。确认解封？")) return;
  desk.reopenRoads();
}

function reset() {
  if (!window.confirm("将清空当前全部登记、排车与留档，恢复演示数据。确定重置？")) return;
  desk.resetAll();
  tab.value = "board";
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 暴雨封路应急</p>
          <h1>区域断供保供台</h1>
          <p class="subtitle">
            油站登记库存、班均销量、保供等级与到站时段；罐车登记载重、可走片区与检修状态。
            撑不到下一班的站优先排车，片区可走、载重够缺口且时段不冲突才确认，排不下的留待派区写清缺口。
          </p>
        </div>
        <div class="top-actions">
          <span class="road-pill" :class="desk.state.roadClosed ? 'closed' : 'open'">
            {{ desk.state.roadClosed ? "暴雨封路中" : "道路已解封" }}
          </span>
          <button v-if="desk.state.roadClosed" class="danger" type="button" @click="reopen">道路解封</button>
          <button class="secondary" type="button" @click="reset">重置演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>告急油站</span>
          <strong>{{ stats.urgent }}</strong>
        </article>
        <article class="metric">
          <span>已确认占位</span>
          <strong>{{ stats.confirmed }}</strong>
        </article>
        <article class="metric">
          <span>已发车</span>
          <strong>{{ stats.dispatched }}</strong>
        </article>
        <article class="metric">
          <span>待派缺口</span>
          <strong>{{ stats.pending }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </nav>

      <DispatchBoard v-if="tab === 'board'" />
      <StationPanel v-else-if="tab === 'stations'" />
      <TankerPanel v-else-if="tab === 'tankers'" />
      <ArchivePanel v-else />
    </div>
  </main>
</template>
