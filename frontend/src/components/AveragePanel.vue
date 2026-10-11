<template>
  <section v-if="visible" class="average">
    <h2>Media</h2>
    <label class="average-field">
      <span class="visually-hidden">Media</span>
      <select v-model="estimate" class="average-value" :disabled="assigning">
        <option value="" disabled>—</option>
        <option v-for="points in FIBONACCI_ESTIMATES" :key="points" :value="String(points)">
          {{ points }}
        </option>
      </select>
    </label>
    <p v-if="error" class="error average-feedback">{{ error }}</p>
    <p v-else-if="status" class="muted average-feedback">{{ status }}</p>
    <p v-else-if="!issueKey" class="muted average-feedback">Selecciona una tarea para asignar la estimación.</p>
    <button type="button" class="average-assign" :disabled="!canAssign" @click="assign">
      {{ assigning ? "Asignando…" : "Asignar estimación" }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { FIBONACCI_ESTIMATES, isFibonacciEstimate } from "@scrum-poker/shared";
import { computed, ref, watch } from "vue";
import { assignStoryPoints } from "../api";

const props = defineProps<{
  visible: boolean;
  value: number | null;
  issueKey: string | null;
}>();

const estimate = ref("");
const followedAverage = ref<number | null>(null);
const error = ref("");
const status = ref("");
const assigning = ref(false);

const selectedPoints = computed(() => {
  const points = Number(estimate.value);
  return estimate.value !== "" && isFibonacciEstimate(points) ? points : null;
});

const canAssign = computed(() => selectedPoints.value !== null && props.issueKey !== null && !assigning.value);

watch(
  () => props.value,
  (value) => {
    const next = value !== null && isFibonacciEstimate(value) ? value : null;
    if (selectedPoints.value === followedAverage.value) {
      estimate.value = next === null ? "" : String(next);
      error.value = "";
      status.value = "";
    }
    followedAverage.value = next;
  },
  { immediate: true },
);

function errorMessage(cause: unknown): string {
  if (typeof cause === "object" && cause && "message" in cause && typeof cause.message === "string") {
    return cause.message;
  }
  return "No se ha podido asignar la estimación.";
}

async function assign() {
  const points = selectedPoints.value;
  if (points === null || !props.issueKey || assigning.value) {
    return;
  }
  assigning.value = true;
  error.value = "";
  status.value = "";
  try {
    await assignStoryPoints(props.issueKey, points);
    status.value = "Estimación asignada.";
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    assigning.value = false;
  }
}
</script>
