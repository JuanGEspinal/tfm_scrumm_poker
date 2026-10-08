import { isBoardTaskKey, type BoardTask, type BoardTaskComment, type BoardTaskDetail } from "@scrum-poker/shared";

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  boardId: number;
  storyPointsField: string;
};

export class JiraBoardError extends Error {
  constructor(
    readonly code: "jira_unauthorized" | "jira_unavailable" | "jira_not_found" | "invalid_issue_key",
  ) {
    super(code);
  }
}

type JiraIssue = {
  key?: string;
  fields?: {
    summary?: string;
    status?: { statusCategory?: { key?: string } };
  } & Record<string, unknown>;
};

type JiraPage = {
  total?: number;
  issues?: JiraIssue[];
};

export function readJiraConfig(env: NodeJS.ProcessEnv = process.env): JiraConfig | null {
  const email = env.JIRA_EMAIL?.trim() ?? "";
  const apiToken = env.JIRA_API_TOKEN?.trim() ?? "";
  if (!email || !apiToken) {
    return null;
  }
  const boardId = Number(env.JIRA_BOARD_ID?.trim() || "1");
  if (!Number.isInteger(boardId) || boardId < 1) {
    return null;
  }
  const baseUrl = (env.JIRA_BASE_URL?.trim() || "https://scrumpocker.atlassian.net").replace(/\/$/, "");
  const storyPointsField = env.JIRA_STORY_POINTS_FIELD?.trim() || "customfield_10016";
  return { baseUrl, email, apiToken, boardId, storyPointsField };
}

export function readStoryPoints(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "value" in value) {
    return readStoryPoints((value as { value: unknown }).value);
  }
  return null;
}

export function toBoardTask(issue: JiraIssue, storyPointsField: string): BoardTask | null {
  const key = issue.key?.trim() ?? "";
  const title = issue.fields?.summary;
  if (!key || typeof title !== "string" || title.trim() === "") {
    return null;
  }
  return {
    key,
    title,
    done: issue.fields?.status?.statusCategory?.key === "done",
    estimated: readStoryPoints(issue.fields?.[storyPointsField]) !== null,
  };
}

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

export async function loadBoardTasks(
  config: JiraConfig,
  fetchImpl: typeof fetch = fetch,
  pageSize = PAGE_SIZE,
): Promise<BoardTask[]> {
  const tasks: BoardTask[] = [];
  const authorization = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
  let startAt = 0;
  let previousFirstKey = "";

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${config.baseUrl}/rest/agile/1.0/board/${config.boardId}/issue`);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(pageSize));
    url.searchParams.set("fields", `summary,status,${config.storyPointsField}`);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: jiraHeaders(authorization),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new JiraBoardError("jira_unavailable");
    }

    if (response.status === 401 || response.status === 403) {
      throw new JiraBoardError("jira_unauthorized");
    }
    if (!response.ok) {
      throw new JiraBoardError("jira_unavailable");
    }

    let body: JiraPage;
    try {
      body = (await response.json()) as JiraPage;
    } catch {
      throw new JiraBoardError("jira_unavailable");
    }

    const issues = body.issues ?? [];
    if (issues.length === 0) {
      break;
    }
    const firstKey = issues[0]?.key ?? "";
    if (firstKey && firstKey === previousFirstKey) {
      break;
    }
    previousFirstKey = firstKey;

    for (const issue of issues) {
      const task = toBoardTask(issue, config.storyPointsField);
      if (task) {
        tasks.push(task);
      }
    }

    startAt += issues.length;
    if (issues.length < pageSize || (typeof body.total === "number" && startAt >= body.total)) {
      break;
    }
  }

  return tasks;
}

const COMMENT_PAGE_SIZE = 100;
const MAX_COMMENT_PAGES = 5;

type JiraComment = {
  id?: string;
  created?: string;
  author?: { displayName?: string };
  body?: unknown;
};

type JiraCommentPage = {
  total?: number;
  comments?: JiraComment[];
};

type AdfNode = {
  type?: string;
  text?: string;
  content?: unknown[];
  attrs?: { text?: unknown; shortName?: unknown; url?: unknown };
};

function jiraHeaders(authorization: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: authorization,
  };
}

function authorizationHeader(config: JiraConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

async function jiraGet(config: JiraConfig, url: URL, fetchImpl: typeof fetch): Promise<Response> {
  try {
    return await fetchImpl(url, {
      headers: jiraHeaders(authorizationHeader(config)),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new JiraBoardError("jira_unavailable");
  }
}

async function readJiraJson<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    throw new JiraBoardError("jira_unauthorized");
  }
  if (response.status === 404) {
    throw new JiraBoardError("jira_not_found");
  }
  if (!response.ok) {
    throw new JiraBoardError("jira_unavailable");
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new JiraBoardError("jira_unavailable");
  }
}

const ADF_BLOCKS = new Set(["paragraph", "heading", "blockquote", "codeBlock", "panel"]);

export function adfToPlainText(node: unknown): string {
  return renderAdf(node)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderAdf(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }
  if (!node || typeof node !== "object") {
    return "";
  }
  const block = node as AdfNode;
  if (block.type === "text") {
    return block.text ?? "";
  }
  if (block.type === "hardBreak") {
    return "\n";
  }
  if (block.type === "mention" && typeof block.attrs?.text === "string") {
    return block.attrs.text;
  }
  if (block.type === "emoji" && typeof block.attrs?.shortName === "string") {
    return block.attrs.shortName;
  }
  if ((block.type === "inlineCard" || block.type === "blockCard") && typeof block.attrs?.url === "string") {
    return block.attrs.url;
  }
  const content = Array.isArray(block.content) ? block.content : [];
  if (block.type === "bulletList") {
    return content
      .map((item) => {
        const text = renderAdf(item).trim();
        return text ? `- ${text}\n` : "";
      })
      .join("");
  }
  if (block.type === "orderedList") {
    return content
      .map((item, index) => {
        const text = renderAdf(item).trim();
        return text ? `${index + 1}. ${text}\n` : "";
      })
      .join("");
  }
  if (block.type === "listItem") {
    return content.map((child) => renderAdf(child)).join("");
  }
  const inner = content.map((child) => renderAdf(child)).join("");
  if (block.type && ADF_BLOCKS.has(block.type)) {
    const text = inner.trim();
    return text ? `${text}\n\n` : "";
  }
  return inner;
}

function toComment(comment: JiraComment): BoardTaskComment | null {
  const id = comment.id?.trim() ?? "";
  if (!id) {
    return null;
  }
  const author = comment.author?.displayName?.trim() || "Alguien";
  return {
    id,
    author,
    createdAt: comment.created ?? "",
    body: adfToPlainText(comment.body),
  };
}

async function loadIssueComments(
  config: JiraConfig,
  key: string,
  fetchImpl: typeof fetch,
): Promise<BoardTaskComment[]> {
  const comments: BoardTaskComment[] = [];
  let startAt = 0;

  for (let page = 0; page < MAX_COMMENT_PAGES; page += 1) {
    const url = new URL(`${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}/comment`);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(COMMENT_PAGE_SIZE));
    const body = await readJiraJson<JiraCommentPage>(await jiraGet(config, url, fetchImpl));
    const batch = body.comments ?? [];
    for (const comment of batch) {
      const mapped = toComment(comment);
      if (mapped) {
        comments.push(mapped);
      }
    }
    startAt += batch.length;
    const finished =
      batch.length === 0 ||
      batch.length < COMMENT_PAGE_SIZE ||
      (typeof body.total === "number" && startAt >= body.total);
    if (finished) {
      break;
    }
  }

  return comments;
}

export async function loadBoardTaskDetail(
  config: JiraConfig,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BoardTaskDetail> {
  const issueKey = key.trim().toUpperCase();
  if (!isBoardTaskKey(issueKey)) {
    throw new JiraBoardError("invalid_issue_key");
  }

  const issueUrl = new URL(`${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
  issueUrl.searchParams.set("fields", "description");
  const issuePromise = jiraGet(config, issueUrl, fetchImpl).then((response) =>
    readJiraJson<{ fields?: { description?: unknown } }>(response),
  );
  const [issue, comments] = await Promise.all([issuePromise, loadIssueComments(config, issueKey, fetchImpl)]);

  return {
    key: issueKey,
    description: adfToPlainText(issue.fields?.description),
    comments,
  };
}
