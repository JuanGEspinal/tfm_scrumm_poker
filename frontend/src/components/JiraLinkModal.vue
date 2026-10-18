<template>
  <div v-if="open" class="board-layer">
    <div class="board-backdrop" @click="close" />
    <form
      class="jira-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jira-modal-title"
      novalidate
      @submit.prevent="submit"
    >
      <h2 id="jira-modal-title">Vincular sala a Jira</h2>
      <p class="muted">La sala usará estas credenciales para leer las tareas del panel y asignar estimaciones.</p>

      <label>
        URL del panel
        <input
          ref="boardUrlInput"
          v-model="boardUrl"
          type="url"
          placeholder="https://empresa.atlassian.net/jira/software/projects/SCRUM/boards/1"
          autocomplete="url"
        />
      </label>
      <label>
        Email de Atlassian
        <input v-model="email" type="email" placeholder="tu@empresa.com" autocomplete="username" />
      </label>
      <label>
        API token
        <input v-model="apiToken" type="password" autocomplete="current-password" />
      </label>
      <p class="muted jira-modal-hint">
        Jira Cloud no acepta la contraseña de tu cuenta.
        <a :href="API_TOKENS_URL" target="_blank" rel="noopener noreferrer">Genera un API token</a>.
      </p>

      <details class="jira-modal-advanced">
        <summary>Avanzado</summary>
        <label>
          Campo de story points
          <input v-model="storyPointsField" type="text" :placeholder="DEFAULT_STORY_POINTS_FIELD" />
        </label>
      </details>

      <p v-if="message" class="error" role="alert">{{ message }}</p>

      <div class="jira-modal-actions">
        <button type="button" class="secondary" :disabled="submitting" @click="close">Cancelar</button>
        <button type="submit" :disabled="submitting">{{ submitting ? "Comprobando…" : "Crear sala" }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import {
  DEFAULT_STORY_POINTS_FIELD,
  isJiraEmail,
  isStoryPointsField,
  parseJiraBoardUrl,
  type JiraLinkInput,
} from "@scrum-poker/shared";

const API_TOKENS_URL = "https://id.atlassian.com/manage-profile/security/api-tokens";

const props = defineProps<{
  open: boolean;
  submitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [jira: JiraLinkInput];
}>();

const boardUrl = ref("");
const email = ref("");
const apiToken = ref("");
const storyPointsField = ref("");
const formError = ref("");
const boardUrlInput = ref<HTMLInputElement | null>(null);

const message = computed(() => formError.value || props.error || "");

function validate(): string {
  if (!parseJiraBoardUrl(boardUrl.value)) {
    return "Indica la URL de un panel de Jira Cloud (https://<sitio>.atlassian.net/.../boards/<número>).";
  }
  if (!isJiraEmail(email.value.trim())) {
    return "Indica el email de tu cuenta de Atlassian.";
  }
  if (!apiToken.value.trim()) {
    return "Indica tu API token de Atlassian.";
  }
  const field = storyPointsField.value.trim();
  if (field && !isStoryPointsField(field)) {
    return "El campo de story points debe tener la forma customfield_12345.";
  }
  return "";
}

function submit() {
  if (props.submitting) {
    return;
  }
  formError.value = validate();
  if (formError.value) {
    return;
  }
  const field = storyPointsField.value.trim();
  emit("submit", {
    boardUrl: boardUrl.value.trim(),
    email: email.value.trim(),
    apiToken: apiToken.value.trim(),
    ...(field ? { storyPointsField: field } : {}),
  });
}

function close() {
  if (!props.submitting) {
    emit("close");
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    close();
  }
}

function releaseOverlay() {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      releaseOverlay();
      apiToken.value = "";
      formError.value = "";
      return;
    }
    window.addEventListener("keydown", onKeydown);
    document.body.style.overflow = "hidden";
    await nextTick();
    boardUrlInput.value?.focus();
  },
  { immediate: true },
);

onUnmounted(releaseOverlay);
</script>
