<script setup lang="ts">
import { reactive, ref } from "vue";
import { useDeskStore } from "../stores/desk";
import { gapTons, isUrgent } from "../domain/rules";
import { GRADES } from "../domain/types";
import type { Grade, Station } from "../domain/types";

const desk = useDeskStore();

const blank = () => ({
  name: "",
  zone: "",
  inventoryTons: 0,
  shiftSalesTons: 0,
  grade: "常规保供" as Grade,
  windowStart: "08:00",
  windowEnd: "10:00"
});

const form = reactive(blank());
const editingId = ref<string | null>(null);
const error = ref("");

const shiftsText = (s: Station) => (s.shiftSalesTons > 0 ? (s.inventoryTons / s.shiftSalesTons).toFixed(1) : "—");

function submit() {
  error.value = "";
  if (!form.name.trim()) {
    error.value = "请填写油站名称";
    return;
  }
  if (!form.zone) {
    error.value = "请选择或输入所属片区";
    return;
  }
  if (form.windowEnd <= form.windowStart) {
    error.value = "到站时段结束需晚于开始";
    return;
  }
  const payload = { ...form, name: form.name.trim() };
  try {
    if (editingId.value) {
      desk.updateStation(editingId.value, payload);
    } else {
      desk.addStation(payload);
    }
    Object.assign(form, blank());
    editingId.value = null;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function edit(station: Station) {
  editingId.value = station.id;
  Object.assign(form, {
    name: station.name,
    zone: station.zone,
    inventoryTons: station.inventoryTons,
    shiftSalesTons: station.shiftSalesTons,
    grade: station.grade,
    windowStart: station.windowStart,
    windowEnd: station.windowEnd
  });
  error.value = "";
}

function cancelEdit() {
  editingId.value = null;
  Object.assign(form, blank());
  error.value = "";
}

function remove(station: Station) {
  if (!window.confirm(`确定删除「${station.name}」？`)) return;
  try {
    desk.removeStation(station.id);
  } catch (e) {
    window.alert((e as Error).message);
  }
}
</script>

<template>
  <div class="stack-panels">
    <form class="panel" @submit.prevent="submit">
      <h2>{{ editingId ? "编辑油站" : "登记油站" }}</h2>
      <div class="form-grid cols-2">
        <label>
          油站名称
          <input v-model="form.name" required placeholder="如 城东站" />
        </label>
        <label>
          所属片区
          <el-select v-model="form.zone" filterable allow-create default-first-option placeholder="选择或输入片区" style="width: 100%">
            <el-option v-for="z in desk.zones" :key="z" :label="z" :value="z" />
          </el-select>
        </label>
        <label>
          当前库存（吨）
          <input v-model.number="form.inventoryTons" type="number" min="0" step="0.5" required />
        </label>
        <label>
          班均销量（吨/班）
          <input v-model.number="form.shiftSalesTons" type="number" min="0" step="0.5" required />
        </label>
        <label>
          保供等级
          <select v-model="form.grade">
            <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
          </select>
        </label>
        <label>
          到站时段
          <span class="time-range">
            <input v-model="form.windowStart" type="time" required />
            <em>至</em>
            <input v-model="form.windowEnd" type="time" required />
          </span>
        </label>
        <div class="span-2 actions">
          <button type="submit">{{ editingId ? "保存修改" : "登记油站" }}</button>
          <button v-if="editingId" class="secondary" type="button" @click="cancelEdit">取消编辑</button>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <section class="panel">
      <h2>油站列表</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>油站</th>
              <th>片区</th>
              <th>库存(吨)</th>
              <th>班均(吨)</th>
              <th>可撑(班)</th>
              <th>缺口(吨)</th>
              <th>保供等级</th>
              <th>到站时段</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in desk.state.stations" :key="s.id">
              <td>{{ s.name }}</td>
              <td>{{ s.zone }}</td>
              <td>{{ s.inventoryTons }}</td>
              <td>{{ s.shiftSalesTons }}</td>
              <td>{{ shiftsText(s) }}</td>
              <td>{{ gapTons(s) }}</td>
              <td>{{ s.grade }}</td>
              <td>{{ s.windowStart }}-{{ s.windowEnd }}</td>
              <td>
                <span class="tag" :class="isUrgent(s) ? 'danger' : 'ok'">{{ isUrgent(s) ? "告急" : "正常" }}</span>
              </td>
              <td class="actions">
                <button class="secondary" type="button" @click="edit(s)">编辑</button>
                <button class="danger" type="button" @click="remove(s)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
