<template>
  <div class="room-shell" :class="{ 'is-chat-open': chatOpen }">
  <main class="page room-page">
    <header class="room-header">
      <img class="room-logo" :src="logoUrl" alt="Scumm poker" />
      <div class="room-identity">
        <p class="eyebrow">Sala</p>
        <h1>{{ roomId }}</h1>
      </div>
      <button
        v-if="jiraLinked"
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
          :room-id="roomId"
          :jira-linked="jiraLinked"
        />
      </div>
    </template>

    <p v-else class="muted">Conectando con la sala…</p>
  </main>
  <ChatPanel
    :open="chatOpen"
    :messages="store.messages"
    @close="setChatOpen(false)"
    @send="store.sendChat"
  />
  </div>
  <button type="button" class="chat-toggle" :aria-expanded="chatOpen" @click="setChatOpen(!chatOpen)">
    Chat
    <span v-if="store.unread > 0" class="chat-badge">{{ store.unread > 99 ? "99+" : store.unread }}</span>
  </button>
  <BoardDrawer
    v-if="jiraLinked"
    :room-id="roomId"
    :open="tasksOpen"
    :selected-key="selectedTask?.key"
    @close="tasksOpen = false"
    @select="store.selectTask"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoUrl from "../assets/scumm-poker-logo.png";
import AveragePanel from "../components/AveragePanel.vue";
import BoardDrawer from "../components/BoardDrawer.vue";
import CardDeck from "../components/CardDeck.vue";
import ChatPanel from "../components/ChatPanel.vue";
import UserBoard from "../components/UserBoard.vue";
import { getOrAssignAvatar, getStoredName } from "../session";
import { useRoomStore } from "../stores/room";

const route = useRoute();
const router = useRouter();
const store = useRoomStore();
const roomId = String(route.params.roomId);
const tasksOpen = ref(false);
const chatOpen = ref(false);

function setChatOpen(open: boolean) {
  chatOpen.value = open;
  store.setChatPanelOpen(open);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && chatOpen.value) {
    setChatOpen(false);
  }
}
const jiraLinked = computed(() => store.state?.jiraLinked === true);
const selectedTask = computed(() => (jiraLinked.value ? (store.state?.selectedTask ?? null) : null));

onMounted(() => {
  const name = getStoredName();
  if (!name) {
    void router.replace({ name: "home", query: { room: roomId } });
    return;
  }
  store.join(roomId, name, getOrAssignAvatar());
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  store.disconnect();
});
</script>
