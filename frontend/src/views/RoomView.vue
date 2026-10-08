<template>
  <main class="page room-page">
    <header class="room-header">
      <div class="room-identity">
        <p class="eyebrow">Sala</p>
        <h1>{{ roomId }}</h1>
      </div>
      <button
        type="button"
        class="room-task"
        :class="{ 'is-empty': !selectedTask }"
        :title="selectedTask?.title ?? 'Seleccionar tarea'"
        aria-haspopup="dialog"
        @click="tasksOpen = true"
      >
        <span class="room-task-label">{{ selectedTask?.title ?? "Seleccionar tarea" }}</span>
      </button>
      <router-link class="ghost" to="/">Salir</router-link>
    </header>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <section v-if="!store.state && store.error" class="panel">
      <p>No se ha podido entrar en la sala.</p>
      <router-link class="ghost" :to="{ name: 'home', query: { room: roomId } }">
        Volver al inicio
      </router-link>
    </section>

    <template v-else-if="store.state">
      <CardDeck
        :selected="store.selectedCard"
        :disabled="store.revealed"
        @select="store.vote"
      />

      <div class="room-results">
        <UserBoard :users="store.state.users" :revealed="store.revealed" />

        <div class="actions">
          <button type="button" :disabled="store.revealed" @click="store.reveal">Revelar</button>
          <button type="button" class="secondary" @click="store.resetRound">Nueva ronda</button>
        </div>

        <AveragePanel :visible="store.revealed" :value="store.state.average" />
      </div>
    </template>

    <p v-else class="muted">Conectando con la sala…</p>
  </main>
  <BoardDrawer
    :open="tasksOpen"
    :selected-key="selectedTask?.key"
    @close="tasksOpen = false"
    @select="selectedTask = $event"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { BoardTask } from "@scrum-poker/shared";
import AveragePanel from "../components/AveragePanel.vue";
import BoardDrawer from "../components/BoardDrawer.vue";
import CardDeck from "../components/CardDeck.vue";
import UserBoard from "../components/UserBoard.vue";
import { getOrAssignAvatar, getStoredName } from "../session";
import { useRoomStore } from "../stores/room";

const route = useRoute();
const router = useRouter();
const store = useRoomStore();
const roomId = String(route.params.roomId);
const tasksOpen = ref(false);
const selectedTask = ref<BoardTask | null>(null);

onMounted(() => {
  const name = getStoredName();
  if (!name) {
    void router.replace({ name: "home", query: { room: roomId } });
    return;
  }
  store.join(roomId, name, getOrAssignAvatar());
});

onUnmounted(() => {
  store.disconnect();
});
</script>
