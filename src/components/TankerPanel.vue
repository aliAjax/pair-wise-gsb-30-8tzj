<script setup lang="ts">
import { reactive, ref } from "vue";
import { useDeskStore } from "../stores/desk";
import { isActive } from "../domain/rules";
import type { Tanker } from "../domain/types";

const desk = useDeskStore();

const blank = () => ({
  plate: "",
  capacityTons: 10,
  zones: [] as string[],
  inMaintenance: false
});

const form = reactive(blank());
const editingId = ref<string | null>(null);
const error = ref("");

const holds = (tankerId: string) => desk.state.assignments.filter((a) => a.tankerId === tankerId && isActive(a)).length;

function submit() {
  error.value = "";
  if (!form.plate.trim()) {
    error.value = "请填写车牌号";
    return;
  }
  if (form.capacityTons <= 0) {
    error.value = "载重需大于 0 吨";
    return;
  }
  if (form.zones.length === 0) {
    error.value = "请至少选择一个可走片区";
    return;
  }
  const payload = { ...form, plate: form.plate.trim(), zones: [...form.zones] };
  try {
    if (editingId.value) {
      desk.updateTanker(editingId.value, payload);
    } else {
      desk.addTanker(payload);
    }
    Object.assign(form, blank());
    editingId.value = null;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function edit(tanker: Tanker) {
  editingId.value = tanker.id;
  Object.assign(form, {
    plate: tanker.plate,
    capacityTons: tanker.capacityTons,
    zones: [...tanker.zones],
    inMaintenance: tanker.inMaintenance
  });
  error.value = "";
}

function cancelEdit() {
  editingId.value = null;
  Object.assign(form, blank());
  error.value = "";
}

function toggle(tanker: Tanker) {
  try {
    desk.setMaintenance(tanker.id, !tanker.inMaintenance);
  } catch (e) {
    window.alert((e as Error).message);
  }
}

function remove(tanker: Tanker) {
  if (!window.confirm(`确定删除罐车「${tanker.plate}」？`)) return;
  try {
    desk.removeTanker(tanker.id);
  } catch (e) {
    window.alert((e as Error).message);
  }
}
</script>

<template>
  <div class="stack-panels">
    <form class="panel" @submit.prevent="submit">
      <h2>{{ editingId ? "编辑罐车" : "登记罐车" }}</h2>
      <div class="form-grid cols-2">
        <label>
          车牌号
          <input v-model="form.plate" required placeholder="如 鄂A·T1006" />
        </label>
        <label>
          载重（吨）
          <input v-model.number="form.capacityTons" type="number" min="1" step="0.5" required />
        </label>
        <label class="span-2">
          可走片区
          <el-select v-model="form.zones" multiple filterable allow-create default-first-option placeholder="选择或输入片区" style="width: 100%">
            <el-option v-for="z in desk.zones" :key="z" :label="z" :value="z" />
          </el-select>
        </label>
        <label class="check">
          <input v-model="form.inMaintenance" type="checkbox" />
          检修中（不可排车）
        </label>
        <div class="span-2 actions">
          <button type="submit">{{ editingId ? "保存修改" : "登记罐车" }}</button>
          <button v-if="editingId" class="secondary" type="button" @click="cancelEdit">取消编辑</button>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <section class="panel">
      <h2>罐车列表</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>车牌</th>
              <th>载重(吨)</th>
              <th>可走片区</th>
              <th>状态</th>
              <th>在排任务</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in desk.state.tankers" :key="t.id">
              <td>{{ t.plate }}</td>
              <td>{{ t.capacityTons }}</td>
              <td class="zones-cell"><span v-for="z in t.zones" :key="z" class="tag">{{ z }}</span></td>
              <td>
                <span class="tag" :class="t.inMaintenance ? 'danger' : 'ok'">{{ t.inMaintenance ? "检修中" : "可用" }}</span>
              </td>
              <td>{{ holds(t.id) }}</td>
              <td class="actions">
                <button class="secondary" type="button" @click="edit(t)">编辑</button>
                <button class="secondary" type="button" @click="toggle(t)">{{ t.inMaintenance ? "检修完成" : "转检修" }}</button>
                <button class="danger" type="button" @click="remove(t)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
