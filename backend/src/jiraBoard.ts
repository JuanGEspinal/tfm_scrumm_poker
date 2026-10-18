import {
  DEFAULT_STORY_POINTS_FIELD,
  isBoardTaskKey,
  isFibonacciEstimate,
  isJiraEmail,
  isStoryPointsField,
  parseJiraBoardUrl,
  type JiraLinkInput,
  type BoardTask,
  type BoardTaskAttachment,
  type BoardTaskComment,
  type BoardTaskDetail,
} from "@scrum-poker/shared";

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  boardId: number;
  storyPointsField: string;
};

export class JiraBoardError extends Error {
  constructor(
    readonly code:
      | "jira_unauthorized"
      | "jira_unavailable"
      | "jira_not_found"
      | "invalid_issue_key"
      | "invalid_attachment_id"
      | "attachment_not_found"
      | "invalid_estimate",
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

const MAX_API_TOKEN = 1024;

export function toJiraConfig(input: unknown): JiraConfig | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as Partial<Record<keyof JiraLinkInput, unknown>>;
  if (
    typeof candidate.boardUrl !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.apiToken !== "string" ||
    (candidate.storyPointsField !== undefined && typeof candidate.storyPointsField !== "string")
  ) {
    return null;
  }
  const board = parseJiraBoardUrl(candidate.boardUrl);
  const email = candidate.email.trim();
  const apiToken = candidate.apiToken.trim();
  const storyPointsField = candidate.storyPointsField?.trim() || DEFAULT_STORY_POINTS_FIELD;
  if (
    !board ||
    !isJiraEmail(email) ||
    !apiToken ||
    apiToken.length > MAX_API_TOKEN ||
    !isStoryPointsField(storyPointsField)
  ) {
    return null;
  }
  return { ...board, email, apiToken, storyPointsField };
}

export async function verifyJiraBoard(config: JiraConfig, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = new URL(`${config.baseUrl}/rest/agile/1.0/board/${config.boardId}`);
  await readJiraJson<unknown>(await jiraGet(config, url, fetchImpl));
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

type JiraAttachment = {
  id?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
};

function mapAttachments(files: JiraAttachment[] | undefined): BoardTaskAttachment[] {
  return (files ?? []).flatMap((file) => {
    const mapped = toAttachment(file);
    return mapped ? [mapped] : [];
  });
}

function toAttachment(file: JiraAttachment): BoardTaskAttachment | null {
  const id = file.id?.trim() ?? "";
  const filename = file.filename?.trim() ?? "";
  if (!id || !filename) {
    return null;
  }
  return {
    id,
    filename,
    size: typeof file.size === "number" && Number.isFinite(file.size) && file.size >= 0 ? file.size : 0,
    mimeType: file.mimeType?.trim() || "application/octet-stream",
  };
}

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
  issueUrl.searchParams.set("fields", "description,attachment");
  const issuePromise = jiraGet(config, issueUrl, fetchImpl).then((response) =>
    readJiraJson<{ fields?: { description?: unknown; attachment?: JiraAttachment[] } }>(response),
  );
  const [issue, comments] = await Promise.all([issuePromise, loadIssueComments(config, issueKey, fetchImpl)]);

  return {
    key: issueKey,
    description: adfToPlainText(issue.fields?.description),
    comments,
    attachments: mapAttachments(issue.fields?.attachment),
  };
}

const ATTACHMENT_ID = /^\d{1,18}$/;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENT_REDIRECTS = 3;

export type BoardTaskFile = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export async function loadBoardTaskAttachment(
  config: JiraConfig,
  key: string,
  attachmentId: string,
  variant: "content" | "thumbnail",
  fetchImpl: typeof fetch = fetch,
): Promise<BoardTaskFile> {
  const issueKey = key.trim().toUpperCase();
  if (!isBoardTaskKey(issueKey)) {
    throw new JiraBoardError("invalid_issue_key");
  }
  if (!ATTACHMENT_ID.test(attachmentId)) {
    throw new JiraBoardError("invalid_attachment_id");
  }

  const issueUrl = new URL(`${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
  issueUrl.searchParams.set("fields", "attachment");
  const issue = await readJiraJson<{ fields?: { attachment?: JiraAttachment[] } }>(
    await jiraGet(config, issueUrl, fetchImpl),
  );
  const file = mapAttachments(issue.fields?.attachment).find((item) => item.id === attachmentId);
  if (!file) {
    throw new JiraBoardError("attachment_not_found");
  }

  const path = variant === "thumbnail" ? "thumbnail" : "content";
  const fileUrl = new URL(`${config.baseUrl}/rest/api/3/attachment/${path}/${attachmentId}`);
  const downloaded = await downloadJiraFile(config, fileUrl, fetchImpl);
  return {
    filename: file.filename,
    mimeType: downloaded.mimeType,
    bytes: downloaded.bytes,
  };
}

async function downloadJiraFile(
  config: JiraConfig,
  start: URL,
  fetchImpl: typeof fetch,
): Promise<{ mimeType: string; bytes: Buffer }> {
  const jiraHost = new URL(config.baseUrl).host;
  let current = start;
  let sendAuth = true;

  for (let hop = 0; hop <= MAX_ATTACHMENT_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(current, {
        headers: sendAuth
          ? { Accept: "*/*", Authorization: authorizationHeader(config) }
          : { Accept: "*/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new JiraBoardError("jira_unavailable");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new JiraBoardError("jira_unavailable");
      }
      const next = new URL(location, current);
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new JiraBoardError("jira_unavailable");
      }
      sendAuth = next.host === jiraHost;
      current = next;
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new JiraBoardError("jira_unauthorized");
    }
    if (response.status === 404) {
      throw new JiraBoardError("attachment_not_found");
    }
    if (!response.ok) {
      throw new JiraBoardError("jira_unavailable");
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) {
      throw new JiraBoardError("jira_unavailable");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new JiraBoardError("jira_unavailable");
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    return { mimeType, bytes };
  }

  throw new JiraBoardError("jira_unavailable");
}

export async function assignStoryPoints(
  config: JiraConfig,
  key: string,
  points: number,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const issueKey = key.trim().toUpperCase();
  if (!isBoardTaskKey(issueKey)) {
    throw new JiraBoardError("invalid_issue_key");
  }
  if (!isFibonacciEstimate(points)) {
    throw new JiraBoardError("invalid_estimate");
  }

  const url = new URL(`${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: {
        ...jiraHeaders(authorizationHeader(config)),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { [config.storyPointsField]: points } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new JiraBoardError("jira_unavailable");
  }

  if (response.status === 401 || response.status === 403) {
    throw new JiraBoardError("jira_unauthorized");
  }
  if (response.status === 404) {
    throw new JiraBoardError("jira_not_found");
  }
  if (!response.ok) {
    throw new JiraBoardError("jira_unavailable");
  }
}
