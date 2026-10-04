import { describe, expect, it } from "vitest";
import { AVATAR_IDS, isAvatarId, randomAvatarId } from "./avatars.js";
import { averageVotes } from "./cards.js";
import {
  addUser,
  castVote,
  createEmptyRoom,
  createRoom,
  rejoinUser,
  removeUser,
  resetRound,
  revealRound,
  toPublicRoomState,
  type RoomUser,
} from "./room.js";

const alice: RoomUser = { id: "a", displayName: "Alice", avatar: "bernard", vote: null };
const bob: RoomUser = { id: "b", displayName: "Bob", avatar: "laverne", vote: null };

describe("averageVotes", () => {
  it("ignores infinity and question and returns one decimal", () => {
    expect(averageVotes(["1", "2", "∞", "?"])).toBe(1.5);
  });

  it("returns null when there are no numeric votes", () => {
    expect(averageVotes(["∞", "?", null])).toBeNull();
  });
});

describe("room machine", () => {
  it("creates a voting room with creator", () => {
    const room = createRoom("sprint-1", alice);
    expect(room.phase).toBe("voting");
    expect(room.creatorId).toBe("a");
  });

  it("assigns creator on first join to an empty room", () => {
    const room = addUser(createEmptyRoom("sprint-1"), alice);
    expect(room.creatorId).toBe("a");
  });

  it("rejects duplicate names case-insensitively", () => {
    const room = createRoom("sprint-1", alice);
    expect(() => addUser(room, { ...bob, displayName: "alice" })).toThrow("name_taken");
  });

  it("rejoins by replacing the previous seat and clearing the vote", () => {
    let room = castVote(createRoom("sprint-1", alice), "a", "8");
    room = rejoinUser(room, "a", { id: "a2", displayName: "Alice", avatar: "bernard", vote: null });
    expect(room.creatorId).toBe("a2");
    expect(room.users[0]?.id).toBe("a2");
    expect(room.users[0]?.vote).toBeNull();
  });

  it("hides votes until reveal and computes average after", () => {
    let room = addUser(createRoom("sprint-1", alice), bob);
    room = castVote(room, "a", "5");
    room = castVote(room, "b", "8");
    const hidden = toPublicRoomState(room);
    expect(hidden.users.every((u) => u.vote === null)).toBe(true);
    expect(hidden.users.every((u) => u.hasVoted)).toBe(true);
    expect(hidden.average).toBeNull();

    room = revealRound(room);
    const shown = toPublicRoomState(room);
    expect(shown.users.map((u) => u.vote)).toEqual(["5", "8"]);
    expect(shown.average).toBe(6.5);
  });

  it("allows reveal with missing votes", () => {
    let room = addUser(createRoom("sprint-1", alice), bob);
    room = castVote(room, "a", "3");
    room = revealRound(room);
    const shown = toPublicRoomState(room);
    expect(shown.users.find((u) => u.id === "b")?.vote).toBeNull();
    expect(shown.average).toBe(3);
  });

  it("resets votes and returns to voting", () => {
    let room = castVote(createRoom("sprint-1", alice), "a", "13");
    room = revealRound(room);
    room = resetRound(room);
    expect(room.phase).toBe("voting");
    expect(room.users[0]?.vote).toBeNull();
    expect(toPublicRoomState(room).average).toBeNull();
  });

  it("forbids voting after reveal", () => {
    let room = revealRound(createRoom("sprint-1", alice));
    expect(() => castVote(room, "a", "1")).toThrow("wrong_phase");
  });

  it("removes users from the board", () => {
    let room = addUser(createRoom("sprint-1", alice), bob);
    room = removeUser(room, "b");
    expect(room.users).toHaveLength(1);
  });

  it("exposes each user's avatar in the public state", () => {
    const room = addUser(createRoom("sprint-1", alice), bob);
    expect(toPublicRoomState(room).users.map((u) => u.avatar)).toEqual(["bernard", "laverne"]);
  });
});

describe("avatars", () => {
  it("validates avatar ids", () => {
    expect(isAvatarId("lechuck")).toBe(true);
    expect(isAvatarId("nope")).toBe(false);
    expect(isAvatarId(undefined)).toBe(false);
  });

  it("picks a random avatar within the list", () => {
    expect(randomAvatarId(() => 0)).toBe(AVATAR_IDS[0]);
    expect(randomAvatarId(() => 0.9999)).toBe(AVATAR_IDS[AVATAR_IDS.length - 1]);
  });
});
