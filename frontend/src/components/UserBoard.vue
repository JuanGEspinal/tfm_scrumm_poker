<template>
  <section class="board">
    <h2>Valoraciones de usuarios</h2>
    <div class="board-grid">
      <article
        v-for="user in users"
        :key="user.id"
        class="seat"
        :class="{ voted: user.hasVoted, revealed }"
      >
        <div class="seat-inner">
          <div class="seat-face seat-front">
            <p class="seat-name">{{ user.displayName }}</p>
            <p v-if="user.isCreator" class="seat-role">Anfitrión</p>
            <p class="seat-hint">{{ user.hasVoted ? "Carta elegida" : "Esperando" }}</p>
          </div>
          <div class="seat-face seat-back">
            <p class="seat-name">{{ user.displayName }}</p>
            <p class="seat-value">{{ user.vote ?? "—" }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicUser } from "@scrum-poker/shared";

defineProps<{
  users: PublicUser[];
  revealed: boolean;
}>();
</script>
