export type BoardTask = {
  key: string;
  title: string;
  done: boolean;
  estimated: boolean;
};

export type BoardTaskComment = {
  id: string;
  author: string;
  createdAt: string;
  body: string;
};

export type BoardTaskAttachment = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
};

export type BoardTaskDetail = {
  key: string;
  description: string;
  comments: BoardTaskComment[];
  attachments: BoardTaskAttachment[];
};

const BOARD_TASK_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

const MAX_TASK_TITLE = 255;

export function isBoardTaskKey(value: string): boolean {
  return BOARD_TASK_KEY.test(value);
}

export function parseBoardTask(value: unknown): BoardTask | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.key !== "string" || !isBoardTaskKey(candidate.key)) {
    return null;
  }
  if (typeof candidate.title !== "string") {
    return null;
  }
  const title = candidate.title.trim();
  if (title.length === 0 || title.length > MAX_TASK_TITLE) {
    return null;
  }
  if (typeof candidate.done !== "boolean" || typeof candidate.estimated !== "boolean") {
    return null;
  }
  return {
    key: candidate.key,
    title,
    done: candidate.done,
    estimated: candidate.estimated,
  };
}

export type BoardTaskFilter = {
  query: string;
  activeOnly: boolean;
  unestimatedOnly: boolean;
};

export function filterBoardTasks(tasks: readonly BoardTask[], filter: BoardTaskFilter): BoardTask[] {
  const query = filter.query.trim().toLocaleLowerCase("es");
  return tasks.filter((task) => {
    if (query && !task.title.toLocaleLowerCase("es").includes(query)) {
      return false;
    }
    if (filter.activeOnly && task.done) {
      return false;
    }
    if (filter.unestimatedOnly && task.estimated) {
      return false;
    }
    return true;
  });
}
