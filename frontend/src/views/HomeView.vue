<template>
  <main class="page home-page">
    <header>
      <h1>Scrum poker</h1>      
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
        <button type="button" @click="onCreate">Crear sala</button>
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
} from "@scrum-poker/shared";
import { createRoom, roomExists } from "../api";
import AvatarPicker from "../components/AvatarPicker.vue";
import { getStoredAvatar, getStoredName, setStoredAvatar, setStoredName } from "../session";

const router = useRouter();
const route = useRoute();
const name = ref(getStoredName());
const avatar = ref<AvatarId | null>(getStoredAvatar());
const createId = ref("");
const joinId = ref("");
const formError = ref("");

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

async function onCreate() {
  if (!requireName()) {
    return;
  }
  const id = normalizeRoomId(createId.value);
  if (!isValidRoomId(id)) {
    formError.value = "El ID de sala debe tener 3-32 caracteres (letras, números o guiones).";
    return;
  }
  try {
    const room = await createRoom(id);
    await router.push({ name: "room", params: { roomId: room.id } });
  } catch (error) {
    formError.value = error instanceof Error ? error.message : (error as { message: string }).message;
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
    formError.value = error instanceof Error ? error.message : (error as { message: string }).message;
  }
}
</script>
