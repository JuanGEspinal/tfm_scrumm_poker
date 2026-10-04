const NAME_KEY = "scrum-poker:name";

export function getStoredName(): string {
  return sessionStorage.getItem(NAME_KEY) ?? "";
}

export function setStoredName(name: string): void {
  sessionStorage.setItem(NAME_KEY, name.trim());
}
