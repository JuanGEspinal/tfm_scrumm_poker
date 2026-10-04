const ROOM_ID_RE = /^[a-z0-9-]{3,32}$/;

export function normalizeRoomId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidRoomId(raw: string): boolean {
  return ROOM_ID_RE.test(normalizeRoomId(raw));
}

export function normalizeDisplayName(raw: string): string {
  return raw.trim();
}

export function isValidDisplayName(raw: string): boolean {
  const name = normalizeDisplayName(raw);
  return name.length >= 1 && name.length <= 40;
}

export function namesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
