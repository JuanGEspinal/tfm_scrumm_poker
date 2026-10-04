<template>
  <section v-if="visible" class="average">
    <h2>Media</h2>
    <p class="average-value">{{ formatAverage(value) }}</p>
  </section>
</template>

<script setup lang="ts">
import { formatAverage } from "../format";

defineProps<{
  visible: boolean;
  value: number | null;
}>();
</script>
