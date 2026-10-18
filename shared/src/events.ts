import type { AvatarId } from "./avatars.js";
import type { BoardTask } from "./boardTasks.js";
import type { ChatHistoryPayload, ChatMessagePayload, ChatSendPayload } from "./chat.js";
import type { RoomState } from "./room.js";
import type { CardValue } from "./cards.js";

export const CLIENT_EVENTS = {
  join: "room:join",
  vote: "vote:cast",
  reveal: "round:reveal",
  reset: "round:reset",
  selectTask: "task:select",
  sendChat: "chat:send",
} as const;

export const SERVER_EVENTS = {
  state: "room:state",
  error: "room:error",
  chatHistory: "chat:history",
  chatMessage: "chat:message",
} as const;

export type JoinPayload = {
  roomId: string;
  displayName: string;
  avatar?: AvatarId;
};

export type VotePayload = {
  value: CardValue;
};

export type SelectTaskPayload = {
  task: BoardTask;
};

export type RoomErrorCode =
  | "invalid_room_id"
  | "invalid_name"
  | "room_not_found"
  | "room_exists"
  | "name_taken"
  | "not_in_room"
  | "invalid_vote"
  | "invalid_task"
  | "invalid_message"
  | "wrong_phase";

export type RoomError = {
  code: RoomErrorCode;
  message: string;
};

export type ClientToServerEvents = {
  [CLIENT_EVENTS.join]: (payload: JoinPayload) => void;
  [CLIENT_EVENTS.vote]: (payload: VotePayload) => void;
  [CLIENT_EVENTS.reveal]: () => void;
  [CLIENT_EVENTS.reset]: () => void;
  [CLIENT_EVENTS.selectTask]: (payload: SelectTaskPayload) => void;
  [CLIENT_EVENTS.sendChat]: (payload: ChatSendPayload) => void;
};

export type ServerToClientEvents = {
  [SERVER_EVENTS.state]: (state: RoomState) => void;
  [SERVER_EVENTS.error]: (error: RoomError) => void;
  [SERVER_EVENTS.chatHistory]: (payload: ChatHistoryPayload) => void;
  [SERVER_EVENTS.chatMessage]: (payload: ChatMessagePayload) => void;
};
