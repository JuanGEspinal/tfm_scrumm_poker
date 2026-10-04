import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type CardValue,
  type RoomError,
  type RoomState,
} from "@scrum-poker/shared";
import { connectSocket, type AppSocket } from "../socket";

export const useRoomStore = defineStore("room", () => {
  const state = ref<RoomState | null>(null);
  const error = ref<string | null>(null);
  const selectedCard = ref<CardValue | null>(null);
  const selfName = ref("");
  let socket: AppSocket | null = null;

  const revealed = computed(() => state.value?.phase === "revealed");

  function ensureSocket(): AppSocket {
    if (socket) {
      return socket;
    }
    socket = connectSocket();
    socket.on(SERVER_EVENTS.state, (next) => {
      state.value = next;
      error.value = null;
      if (next.phase === "voting") {
        const me = next.users.find((u) => u.displayName.toLowerCase() === selfName.value.toLowerCase());
        if (!me?.hasVoted) {
          selectedCard.value = null;
        }
      }
    });
    socket.on(SERVER_EVENTS.error, (payload: RoomError) => {
      error.value = payload.message;
    });
    return socket;
  }

  function join(roomId: string, displayName: string) {
    selfName.value = displayName;
    ensureSocket().emit(CLIENT_EVENTS.join, { roomId, displayName });
  }

  function vote(value: CardValue) {
    if (state.value?.phase !== "voting") {
      return;
    }
    selectedCard.value = value;
    ensureSocket().emit(CLIENT_EVENTS.vote, { value });
  }

  function reveal() {
    ensureSocket().emit(CLIENT_EVENTS.reveal);
  }

  function resetRound() {
    selectedCard.value = null;
    ensureSocket().emit(CLIENT_EVENTS.reset);
  }

  function disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    state.value = null;
    selectedCard.value = null;
    error.value = null;
  }

  return {
    state,
    error,
    selectedCard,
    revealed,
    join,
    vote,
    reveal,
    resetRound,
    disconnect,
  };
});
