<script setup lang="ts">
import { reactive, ref } from "vue";
import { ZONES, type TankerStatus, type Zone } from "../domain/types";
import { useSupplyStore } from "../store/supplyStore";
import TankerCard from "../components/TankerCard.vue";

const store = useSupplyStore();
const error = ref("");

const form = reactive({
  plate: "",
  capacity: 0,
  zones: [] as Zone[],
  status: "在役" as TankerStatus,
});

function submit() {
  if (!form.plate.trim()) {
    error.value = "请填写车牌";
    return;
  }
  if (!(form.capacity > 0)) {
    error.value = "载重必须大于 0";
    return;
  }
  if (form.zones.length === 0) {
    error.value = "至少选择一个可走片区";
    return;
  }
  store.addTanker({
    plate: form.plate.trim(),
    capacity: Number(form.capacity),
    zones: [...form.zones],
    status: form.status,
  });
  Object.assign(form, { plate: "", capacity: 0, zones: [], status: "在役" });
  error.value = "";
}
</script>

<template>
  <section class="workspace">
    <form class="panel" @submit.prevent="submit">
      <h2>罐车登记</h2>
      <div class="form-grid">
        <label>
          车牌
          <input v-model="form.plate" placeholder="如 沪A·D2103" required />
        </label>
        <label>
          载重（吨）
          <input v-model.number="form.capacity" type="number" min="0.1" step="0.1" required />
        </label>
        <div>
          <span class="field-label">可走片区</span>
          <div class="check-row">
            <label v-for="z in ZONES" :key="z">
              <input v-model="form.zones" type="checkbox" :value="z" /> {{ z }}
            </label>
          </div>
        </div>
        <label>
          检修状态
          <select v-model="form.status">
            <option value="在役">在役</option>
            <option value="检修">检修</option>
          </select>
        </label>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button type="submit">保存罐车</button>
      </div>
    </form>

    <section class="list-panel">
      <div class="toolbar">
        <h2>罐车列表</h2>
        <span class="hint">剩余载重 = 载重 − 在途占位；有在途任务的车不能转检修</span>
      </div>
      <div v-if="store.tankers.length === 0" class="empty">暂无罐车</div>
      <div class="card-list">
        <TankerCard v-for="t in store.tankers" :key="t.id" :tanker="t" />
      </div>
    </section>
  </section>
</template>
