import { AVATAR_IDS, type AvatarId } from "@scrum-poker/shared";

const files = import.meta.glob<string>("./cards/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});

const urls = new Map<string, string>(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.[^.]+$/g, ""), url]),
);

export const AVATARS: ReadonlyArray<{ id: AvatarId; url: string }> = AVATAR_IDS.flatMap((id) => {
  const url = urls.get(id);
  return url ? [{ id, url }] : [];
});

export function avatarUrl(id: AvatarId | undefined): string | undefined {
  return id ? urls.get(id) : undefined;
}
