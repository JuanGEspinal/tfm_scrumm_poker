import { isAvatarId, randomAvatarId, type AvatarId } from "@scrum-poker/shared";

const NAME_KEY = "scrum-poker:name";
const AVATAR_KEY = "scrum-poker:avatar";

export function getStoredName(): string {
  return sessionStorage.getItem(NAME_KEY) ?? "";
}

export function setStoredName(name: string): void {
  sessionStorage.setItem(NAME_KEY, name.trim());
}

export function getStoredAvatar(): AvatarId | null {
  const value = sessionStorage.getItem(AVATAR_KEY);
  return isAvatarId(value) ? value : null;
}

export function setStoredAvatar(avatar: AvatarId): void {
  sessionStorage.setItem(AVATAR_KEY, avatar);
}

export function getOrAssignAvatar(): AvatarId {
  const stored = getStoredAvatar();
  if (stored) {
    return stored;
  }
  const avatar = randomAvatarId();
  setStoredAvatar(avatar);
  return avatar;
}
