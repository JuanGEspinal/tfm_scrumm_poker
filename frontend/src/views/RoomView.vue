<template>
  <main class="page room-page">
    <header class="room-header">
      <div>
        <p class="eyebrow">Sala</p>
        <h1>{{ roomId }}</h1>
      </div>
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

      <UserBoard :users="store.state.users" :revealed="store.revealed" />

      <div class="actions">
        <button type="button" :disabled="store.revealed" @click="store.reveal">Revelar</button>
        <button type="button" class="secondary" @click="store.resetRound">Nueva ronda</button>
      </div>

      <AveragePanel :visible="store.revealed" :value="store.state.average" />
    </template>

    <p v-else class="muted">Conectando con la sala…</p>
  </main>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import CardDeck from "../components/CardDeck.vue";
import UserBoard from "../components/UserBoard.vue";
import AveragePanel from "../components/AveragePanel.vue";
import { getStoredName } from "../session";
import { useRoomStore } from "../stores/room";

const route = useRoute();
const router = useRouter();
const store = useRoomStore();
const roomId = String(route.params.roomId);

onMounted(() => {
  const name = getStoredName();
  if (!name) {
    void router.replace({ name: "home", query: { room: roomId } });
    return;
  }
  store.join(roomId, name);
});

onUnmounted(() => {
  store.disconnect();
});
</script>
