import { describe, expect, it } from "vitest";
import { AVATAR_IDS } from "@scrum-poker/shared";
import { AVATARS, avatarUrl } from "./avatars";

describe("avatars", () => {
  it("has an image for every shared avatar id", () => {
    expect(AVATARS.map((a) => a.id)).toEqual([...AVATAR_IDS]);
    expect(AVATAR_IDS.every((id) => Boolean(avatarUrl(id)))).toBe(true);
  });
});
