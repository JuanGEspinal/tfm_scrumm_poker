<template>
  <section class="deck">
    <h2>Tus cartas</h2>
    <div class="deck-row">
      <button
        v-for="card in cards"
        :key="card"
        type="button"
        class="card"
        :class="{ selected: selected === card, disabled }"
        :disabled="disabled"
        @click="$emit('select', card)"
      >
        {{ card }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CARD_VALUES, type CardValue } from "@scrum-poker/shared";

defineProps<{
  selected: CardValue | null;
  disabled: boolean;
}>();

defineEmits<{
  select: [value: CardValue];
}>();

const cards = CARD_VALUES;
</script>
