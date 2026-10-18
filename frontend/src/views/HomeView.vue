<template>
  <main class="page home-page">
    <header class="home-brand">
      <h1>
        <img class="home-logo" :src="logoUrl" alt="Scumm poker" />
      </h1>
    </header>

    <form class="panel" @submit.prevent>
      <label>
        Tu nombre
        <input v-model="name" type="text" maxlength="40" autocomplete="nickname" />
      </label>
      <AvatarPicker v-model="avatar" />
      <p v-if="formError" class="error">{{ formError }}</p>

      <div class="combo">
        <label>
          Crear sala
          <input v-model="createId" type="text" placeholder="id-de-sala" />
        </label>
        <div class="combo-actions">
          <button type="button" @click="onCreate">Crear sala</button>
          <button type="button" class="secondary" @click="onOpenJira">Crear sala vinculada a Jira</button>
        </div>
      </div>

      <div class="combo">
        <label>
          Unirse a sala existente
          <input v-model="joinId" type="text" placeholder="id-de-sala" />
        </label>
        <button type="button" @click="onJoin">Unirse</button>
      </div>
    </form>
  </main>
  <JiraLinkModal
    :open="jiraOpen"
    :submitting="jiraSubmitting"
    :error="jiraError"
    @close="jiraOpen = false"
    @submit="onCreateWithJira"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  isValidDisplayName,
  isValidRoomId,
  normalizeRoomId,
  randomAvatarId,
  type AvatarId,
  type JiraLinkInput,
} from "@scrum-poker/shared";
import { createRoom, roomExists } from "../api";
import logoUrl from "../assets/scumm-poker-logo.png";
import AvatarPicker from "../components/AvatarPicker.vue";
import JiraLinkModal from "../components/JiraLinkModal.vue";
import { getStoredAvatar, getStoredName, setStoredAvatar, setStoredName } from "../session";

const router = useRouter();
const route = useRoute();
const name = ref(getStoredName());
const avatar = ref<AvatarId | null>(getStoredAvatar());
const createId = ref("");
const joinId = ref("");
const formError = ref("");
const jiraOpen = ref(false);
const jiraSubmitting = ref(false);
const jiraError = ref("");

onMounted(() => {
  const pending = route.query.room;
  if (typeof pending === "string") {
    joinId.value = pending;
  }
});

function requireName(): boolean {
  if (!isValidDisplayName(name.value)) {
    formError.value = "Indica tu nombre para identificarte en la sala.";
    return false;
  }
  setStoredName(name.value);
  setStoredAvatar(avatar.value ?? randomAvatarId());
  formError.value = "";
  return true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : (error as { message: string }).message;
}

function requireCreateId(): string | null {
  if (!requireName()) {
    return null;
  }
  const id = normalizeRoomId(createId.value);
  if (!isValidRoomId(id)) {
    formError.value = "El ID de sala debe tener 3-32 caracteres (letras, números o guiones).";
    return null;
  }
  return id;
}

async function onCreate() {
  const id = requireCreateId();
  if (!id) {
    return;
  }
  try {
    const room = await createRoom(id);
    await router.push({ name: "room", params: { roomId: room.id } });
  } catch (error) {
    formError.value = errorMessage(error);
  }
}

function onOpenJira() {
  if (!requireCreateId()) {
    return;
  }
  jiraError.value = "";
  jiraOpen.value = true;
}

async function onCreateWithJira(jira: JiraLinkInput) {
  const id = requireCreateId();
  if (!id) {
    jiraOpen.value = false;
    return;
  }
  jiraSubmitting.value = true;
  jiraError.value = "";
  try {
    const room = await createRoom(id, jira);
    jiraOpen.value = false;
    await router.push({ name: "room", params: { roomId: room.id } });
  } catch (error) {
    jiraError.value = errorMessage(error);
  } finally {
    jiraSubmitting.value = false;
  }
}

async function onJoin() {
  if (!requireName()) {
    return;
  }
  const id = normalizeRoomId(joinId.value);
  if (!isValidRoomId(id)) {
    formError.value = "El ID de sala debe tener 3-32 caracteres (letras, números o guiones).";
    return;
  }
  try {
    const exists = await roomExists(id);
    if (!exists) {
      formError.value = "La sala no existe.";
      return;
    }
    await router.push({ name: "room", params: { roomId: id } });
  } catch (error) {
    formError.value = errorMessage(error);
  }
}
</script>
