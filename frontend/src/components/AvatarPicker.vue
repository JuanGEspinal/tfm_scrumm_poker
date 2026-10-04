<template>
  <fieldset class="avatar-picker">
    <legend>Elige tu avatar</legend>
    <p class="muted avatar-help">Si no eliges ninguno, te asignaremos uno al azar.</p>
    <div class="avatar-grid">
      <button
        v-for="avatar in AVATARS"
        :key="avatar.id"
        type="button"
        class="avatar-option"
        :class="{ selected: avatar.id === modelValue }"
        :aria-pressed="avatar.id === modelValue"
        :aria-label="`Avatar ${avatar.id}`"
        @click="toggle(avatar.id)"
      >
        <img class="avatar-img" :src="avatar.url" :alt="avatar.id" />
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import type { AvatarId } from "@scrum-poker/shared";
import { AVATARS } from "../avatars";

const props = defineProps<{
  modelValue: AvatarId | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AvatarId | null];
}>();

function toggle(id: AvatarId) {
  emit("update:modelValue", props.modelValue === id ? null : id);
}
</script>
