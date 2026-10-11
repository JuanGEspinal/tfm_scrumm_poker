import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type AvatarId,
  type BoardTask,
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
  let credentials: { roomId: string; displayName: string; avatar: AvatarId } | null = null;
  let pendingTask: BoardTask | null = null;
  let retriedTask = false;

  function rejoin() {
    if (credentials) {
      socket?.emit(CLIENT_EVENTS.join, credentials);
    }
  }

  const revealed = computed(() => state.value?.phase === "revealed");

  function ensureSocket(): AppSocket {
    if (socket) {
      return socket;
    }
    socket = connectSocket();
    socket.io.on("reconnect", rejoin);
    socket.on(SERVER_EVENTS.state, (next) => {
      const task = pendingTask;
      const keepLocalTask = task !== null && !next.selectedTask && !retriedTask;
      if (task && next.selectedTask?.key === task.key) {
        pendingTask = null;
        retriedTask = false;
      } else if (keepLocalTask) {
        retriedTask = true;
      } else if (task && next.selectedTask) {
        pendingTask = null;
        retriedTask = false;
      }
      state.value = keepLocalTask && task ? { ...next, selectedTask: task } : next;
      error.value = null;
      if (next.phase === "voting") {
        const me = next.users.find((u) => u.displayName.toLowerCase() === selfName.value.toLowerCase());
        if (!me?.hasVoted) {
          selectedCard.value = null;
        }
      }
      if (keepLocalTask && task) {
        socket?.emit(CLIENT_EVENTS.selectTask, { task });
      }
    });
    socket.on(SERVER_EVENTS.error, (payload: RoomError) => {
      if (payload.code === "not_in_room" && pendingTask) {
        return;
      }
      error.value = payload.message;
    });
    return socket;
  }

  function join(roomId: string, displayName: string, avatar: AvatarId) {
    selfName.value = displayName;
    credentials = { roomId, displayName, avatar };
    ensureSocket().emit(CLIENT_EVENTS.join, credentials);
  }

  function vote(value: CardValue) {
    if (state.value?.phase !== "voting") {
      return;
    }
    selectedCard.value = value;
    ensureSocket().emit(CLIENT_EVENTS.vote, { value });
  }

  function selectTask(task: BoardTask) {
    pendingTask = task;
    retriedTask = false;
    if (state.value) {
      state.value = { ...state.value, selectedTask: task };
    }
    ensureSocket().emit(CLIENT_EVENTS.selectTask, { task });
  }

  function reveal() {
    ensureSocket().emit(CLIENT_EVENTS.reveal);
  }

  function resetRound() {
    selectedCard.value = null;
    ensureSocket().emit(CLIENT_EVENTS.reset);
  }

  function disconnect() {
    credentials = null;
    pendingTask = null;
    retriedTask = false;
    socket?.io.off("reconnect", rejoin);
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
    selectTask,
    reveal,
    resetRound,
    disconnect,
  };
});
