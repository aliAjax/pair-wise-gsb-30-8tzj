<script setup lang="ts">
import { reactive, ref } from "vue";
import { SUPPLY_LEVELS, TIME_WINDOWS, ZONES, type SupplyLevel, type TimeWindow, type Zone } from "../domain/types";
import { useSupplyStore } from "../store/supplyStore";
import StationCard from "../components/StationCard.vue";

const store = useSupplyStore();
const error = ref("");

const form = reactive({
  name: "",
  zone: ZONES[0] as Zone,
  inventory: 0,
  shiftSales: 0,
  level: "常规保供" as SupplyLevel,
  windows: [] as TimeWindow[],
});

function submit() {
  if (!form.name.trim()) {
    error.value = "请填写站名";
    return;
  }
  if (form.inventory < 0) {
    error.value = "库存不能为负";
    return;
  }
  if (!(form.shiftSales > 0)) {
    error.value = "班均销量必须大于 0";
    return;
  }
  if (form.windows.length === 0) {
    error.value = "至少选择一个到站时段";
    return;
  }
  store.addStation({
    name: form.name.trim(),
    zone: form.zone,
    inventory: Number(form.inventory),
    shiftSales: Number(form.shiftSales),
    level: form.level,
    // 按时间顺序保存，便于排车时取最早空闲时段
    windows: TIME_WINDOWS.filter((w) => form.windows.includes(w)),
  });
  Object.assign(form, { name: "", zone: ZONES[0], inventory: 0, shiftSales: 0, level: "常规保供", windows: [] });
  error.value = "";
}
</script>

<template>
  <section class="workspace">
    <form class="panel" @submit.prevent="submit">
      <h2>油站登记</h2>
      <div class="form-grid">
        <label>
          站名
          <input v-model="form.name" placeholder="如 城东站" required />
        </label>
        <label>
          所属片区
          <select v-model="form.zone">
            <option v-for="z in ZONES" :key="z" :value="z">{{ z }}</option>
          </select>
        </label>
        <label>
          当前库存（吨）
          <input v-model.number="form.inventory" type="number" min="0" step="0.1" required />
        </label>
        <label>
          班均销量（吨/班）
          <input v-model.number="form.shiftSales" type="number" min="0.1" step="0.1" required />
        </label>
        <label>
          保供等级
          <select v-model="form.level">
            <option v-for="l in SUPPLY_LEVELS" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <div>
          <span class="field-label">可接油到站时段</span>
          <div class="check-row">
            <label v-for="w in TIME_WINDOWS" :key="w">
              <input v-model="form.windows" type="checkbox" :value="w" /> {{ w }}
            </label>
          </div>
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button type="submit">保存油站</button>
      </div>
    </form>

    <section class="list-panel">
      <div class="toolbar">
        <h2>油站列表</h2>
        <span class="hint">可撑班次 = 库存 ÷ 班均销量，&lt; 1 班即撑不到下一班</span>
      </div>
      <div v-if="store.stations.length === 0" class="empty">暂无油站</div>
      <div class="card-list">
        <StationCard v-for="s in store.stations" :key="s.id" :station="s" />
      </div>
    </section>
  </section>
</template>
