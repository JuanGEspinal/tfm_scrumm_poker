import type { AvatarId } from "./avatars.js";
import { averageVotes, isCardValue, type CardValue } from "./cards.js";
import { isValidDisplayName, namesEqual, normalizeDisplayName } from "./ids.js";

export type RoomPhase = "voting" | "revealed";

export type RoomUser = {
  id: string;
  displayName: string;
  avatar: AvatarId;
  vote: CardValue | null;
};

export type Room = {
  id: string;
  creatorId: string;
  phase: RoomPhase;
  users: RoomUser[];
};

export type PublicUser = {
  id: string;
  displayName: string;
  avatar: AvatarId;
  hasVoted: boolean;
  vote: CardValue | null;
  isCreator: boolean;
};

export type RoomState = {
  id: string;
  creatorId: string;
  phase: RoomPhase;
  users: PublicUser[];
  average: number | null;
};

export function createEmptyRoom(id: string): Room {
  return {
    id,
    creatorId: "",
    phase: "voting",
    users: [],
  };
}

export function createRoom(id: string, creator: RoomUser): Room {
  return addUser(createEmptyRoom(id), creator);
}

export function addUser(room: Room, user: RoomUser): Room {
  const name = normalizeDisplayName(user.displayName);
  if (!isValidDisplayName(name)) {
    throw new Error("invalid_name");
  }
  if (room.users.some((u) => namesEqual(u.displayName, name))) {
    throw new Error("name_taken");
  }
  const nextUser: RoomUser = { ...user, displayName: name, vote: null };
  return {
    ...room,
    creatorId: room.creatorId || nextUser.id,
    users: [...room.users, nextUser],
  };
}

export function rejoinUser(room: Room, existingId: string, next: RoomUser): Room {
  const name = normalizeDisplayName(next.displayName);
  const wasCreator = room.creatorId === existingId;
  return {
    ...room,
    creatorId: wasCreator ? next.id : room.creatorId,
    users: room.users.map((u) =>
      u.id === existingId ? { ...next, displayName: name, vote: null } : u,
    ),
  };
}

export function removeUser(room: Room, userId: string): Room {
  return {
    ...room,
    users: room.users.filter((u) => u.id !== userId),
  };
}

export function findUserByName(room: Room, displayName: string): RoomUser | undefined {
  return room.users.find((u) => namesEqual(u.displayName, displayName));
}

export function castVote(room: Room, userId: string, value: CardValue): Room {
  if (room.phase !== "voting") {
    throw new Error("wrong_phase");
  }
  if (!isCardValue(value)) {
    throw new Error("invalid_vote");
  }
  if (!room.users.some((u) => u.id === userId)) {
    throw new Error("not_in_room");
  }
  return {
    ...room,
    users: room.users.map((u) => (u.id === userId ? { ...u, vote: value } : u)),
  };
}

export function revealRound(room: Room): Room {
  if (room.phase !== "voting") {
    throw new Error("wrong_phase");
  }
  return { ...room, phase: "revealed" };
}

export function resetRound(room: Room): Room {
  return {
    ...room,
    phase: "voting",
    users: room.users.map((u) => ({ ...u, vote: null })),
  };
}

export function toPublicRoomState(room: Room): RoomState {
  const revealed = room.phase === "revealed";
  return {
    id: room.id,
    creatorId: room.creatorId,
    phase: room.phase,
    average: revealed ? averageVotes(room.users.map((u) => u.vote)) : null,
    users: room.users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      avatar: u.avatar,
      hasVoted: u.vote !== null,
      vote: revealed ? u.vote : null,
      isCreator: u.id === room.creatorId,
    })),
  };
}
