export const AVATAR_IDS = [
  "bernard",
  "fred",
  "green",
  "guy1",
  "guy2",
  "herman",
  "hoagie",
  "indy4",
  "laverne",
  "lechuck",
  "many",
  "purple",
  "sam",
  "stan",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

export function randomAvatarId(random: () => number = Math.random): AvatarId {
  const index = Math.min(Math.floor(random() * AVATAR_IDS.length), AVATAR_IDS.length - 1);
  return AVATAR_IDS[index] as AvatarId;
}
