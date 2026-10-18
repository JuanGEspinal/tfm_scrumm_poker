<template>
  <aside class="chat-panel" :class="{ 'is-open': open }" :aria-hidden="open ? undefined : 'true'" :inert="open ? undefined : true">
    <header class="chat-panel-bar">
      <h2>Chat</h2>
      <button type="button" class="secondary" aria-label="Cerrar chat" @click="emit('close')">×</button>
    </header>
    <div class="chat-panel-body">
    <div ref="log" class="chat-log" role="log" aria-live="polite" aria-relevant="additions">
      <p v-if="messages.length === 0" class="muted">Todavía no hay mensajes.</p>
      <ChatMessage v-for="message in messages" :key="message.id" :message="message" />
    </div>
    <form class="chat-composer" @submit.prevent="submit">
      <label class="visually-hidden" for="chat-draft">Mensaje</label>
      <textarea
        id="chat-draft"
        v-model="draft"
        maxlength="2000"
        placeholder="Escribe un mensaje"
        @keydown="onKeydown"
      />
      <button type="submit" :disabled="!canSend">Enviar</button>
    </form>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { normalizeChatText, type ChatMessage } from "@scrum-poker/shared";
import ChatMessageView from "./ChatMessage.vue";

const ChatMessage = ChatMessageView;

const props = defineProps<{
  open: boolean;
  messages: ChatMessage[];
}>();

const emit = defineEmits<{
  close: [];
  send: [text: string];
}>();

const draft = ref("");
const log = ref<HTMLElement | null>(null);
const canSend = computed(() => normalizeChatText(draft.value) !== null);

watch(
  () => [props.open, props.messages.length] as const,
  async () => {
    if (!props.open) {
      return;
    }
    await nextTick();
    if (log.value) {
      log.value.scrollTop = log.value.scrollHeight;
    }
  },
);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}

function submit() {
  const text = normalizeChatText(draft.value);
  if (!text) {
    return;
  }
  emit("send", text);
  draft.value = "";
}
</script>
