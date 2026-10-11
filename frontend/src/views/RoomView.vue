<template>
  <main class="page room-page">
    <header class="room-header">
      <img class="room-logo" :src="logoUrl" alt="Scumm Pocker" />
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

      <div class="round-actions">
        <button
          type="button"
          :class="{ secondary: store.revealed }"
          :disabled="store.revealed"
          @click="store.reveal"
        >
          Revelar
        </button>
        <button
          type="button"
          :class="{ secondary: !store.revealed }"
          @click="store.resetRound"
        >
          Nueva ronda
        </button>
      </div>

      <div class="room-results">
        <UserBoard :users="store.state.users" :revealed="store.revealed" />

        <AveragePanel
          :visible="store.revealed"
          :value="store.state.average"
          :issue-key="selectedTask?.key ?? null"
        />
      </div>
    </template>

    <p v-else class="muted">Conectando con la sala…</p>
  </main>
  <BoardDrawer
    :open="tasksOpen"
    :selected-key="selectedTask?.key"
    @close="tasksOpen = false"
    @select="store.selectTask"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoUrl from "../assets/scumm-pocker-logo.png";
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
const selectedTask = computed(() => store.state?.selectedTask ?? null);

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
