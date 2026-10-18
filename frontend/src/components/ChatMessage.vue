<template>
  <article class="chat-message">
    <header class="chat-message-head">
      <img class="chat-avatar" :src="avatarUrl(message.avatar)" :alt="message.displayName" />
      <span class="chat-message-name">{{ message.displayName }}</span>
      <time class="chat-message-time" :datetime="message.createdAt">{{ when }}</time>
    </header>
    <p class="chat-message-body">
      <ChatRichText :tokens="tokens" />
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { parseChatText, type ChatMessage } from "@scrum-poker/shared";
import { avatarUrl } from "../avatars";
import ChatRichText from "./ChatRichText.vue";

const props = defineProps<{
  message: ChatMessage;
}>();

const tokens = computed(() => parseChatText(props.message.text));

const when = computed(() =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(props.message.createdAt),
  ),
);
</script>
