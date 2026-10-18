<template>
  <template v-for="(token, index) in tokens" :key="index">
    <template v-if="token.type === 'text'">{{ token.text }}</template>
    <strong v-else-if="token.type === 'strong'">
      <ChatRichText :tokens="token.children" />
    </strong>
    <em v-else-if="token.type === 'em'">
      <ChatRichText :tokens="token.children" />
    </em>
    <a
      v-else-if="token.type === 'link'"
      :href="token.href"
      target="_blank"
      rel="noopener noreferrer"
    >
      <ChatRichText :tokens="token.children" />
    </a>
    <br v-else />
  </template>
</template>

<script setup lang="ts">
import type { ChatToken } from "@scrum-poker/shared";

defineProps<{
  tokens: ChatToken[];
}>();
</script>
