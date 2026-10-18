export type JiraLinkInput = {
  boardUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
};

export type JiraBoardLocation = {
  baseUrl: string;
  boardId: number;
};

export const DEFAULT_STORY_POINTS_FIELD = "customfield_10016";

const JIRA_CLOUD_HOST = /^[a-z0-9][a-z0-9-]{0,62}\.atlassian\.net$/;
const BOARD_PATH = /\/boards\/(\d{1,9})(?:\/|$)/;
const STORY_POINTS_FIELD = /^customfield_\d{1,9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseJiraBoardUrl(value: string): JiraBoardLocation | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password || !JIRA_CLOUD_HOST.test(host)) {
    return null;
  }
  const raw = BOARD_PATH.exec(url.pathname)?.[1] ?? url.searchParams.get("rapidView") ?? "";
  if (!/^\d{1,9}$/.test(raw)) {
    return null;
  }
  const boardId = Number(raw);
  if (boardId < 1) {
    return null;
  }
  return { baseUrl: `https://${host}`, boardId };
}

export function isStoryPointsField(value: string): boolean {
  return STORY_POINTS_FIELD.test(value);
}

export function isJiraEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}
