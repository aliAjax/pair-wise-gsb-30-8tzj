<script setup lang="ts">
import { ref } from "vue";
import { useSupplyStore } from "./store/supplyStore";
import DispatchBoard from "./views/DispatchBoard.vue";
import StationsView from "./views/StationsView.vue";
import TankersView from "./views/TankersView.vue";
import LogView from "./views/LogView.vue";

const store = useSupplyStore();

const tabs = [
  { key: "board", label: "保供判定台" },
  { key: "stations", label: "油站登记" },
  { key: "tankers", label: "罐车登记" },
  { key: "logs", label: "留档" },
] as const;

const active = ref<(typeof tabs)[number]["key"]>("board");

function toggleRoad() {
  if (store.roadStatus === "封闭中") {
    if (window.confirm("解封后将释放全部未发车占位并清空待派区，确认解封？")) {
      store.reopenRoads();
    }
  } else {
    store.closeRoads();
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 暴雨断供应急</p>
          <h1>区域断供保供台</h1>
          <p class="subtitle">
            撑不到下一班的站优先排车；片区可走、载重够缺口、时段不冲突才能确认，排不下留待派区并写清缺口。
          </p>
        </div>
        <div class="road">
          <span class="road-badge" :class="store.roadStatus === '封闭中' ? 'closed' : 'open'">
            {{ store.roadStatus === "封闭中" ? "暴雨封路中" : "道路已解封" }}
          </span>
          <button type="button" @click="toggleRoad">
            {{ store.roadStatus === "封闭中" ? "解除封路" : "重新封路" }}
          </button>
        </div>
      </header>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ active: active === tab.key }"
          @click="active = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <DispatchBoard v-if="active === 'board'" />
      <StationsView v-else-if="active === 'stations'" />
      <TankersView v-else-if="active === 'tankers'" />
      <LogView v-else />
    </div>
  </main>
</template>
