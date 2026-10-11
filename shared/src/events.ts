import type { AvatarId } from "./avatars.js";
import type { BoardTask } from "./boardTasks.js";
import type { RoomState } from "./room.js";
import type { CardValue } from "./cards.js";

export const CLIENT_EVENTS = {
  join: "room:join",
  vote: "vote:cast",
  reveal: "round:reveal",
  reset: "round:reset",
  selectTask: "task:select",
} as const;

export const SERVER_EVENTS = {
  state: "room:state",
  error: "room:error",
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
};

export type ServerToClientEvents = {
  [SERVER_EVENTS.state]: (state: RoomState) => void;
  [SERVER_EVENTS.error]: (error: RoomError) => void;
};
