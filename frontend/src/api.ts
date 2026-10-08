import type { BoardTask, BoardTaskDetail } from "@scrum-poker/shared";

const API_BASE = "/api";

export type ApiError = {
  code?: string;
  message: string;
};

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiError;
    return { code: body.code, message: body.message || "Error de red" };
  } catch {
    return { message: "Error de red" };
  }
}

export async function createRoom(id: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response.json() as Promise<{ id: string }>;
}

export async function fetchBoardTasks(): Promise<BoardTask[]> {
  const response = await fetch(`${API_BASE}/board/issues`);
  if (!response.ok) {
    throw await parseError(response);
  }
  const body = (await response.json()) as { tasks?: BoardTask[] };
  if (!Array.isArray(body.tasks)) {
    throw { message: "No se han podido cargar las tareas del panel." } satisfies ApiError;
  }
  return body.tasks;
}

export async function fetchBoardTaskDetail(key: string): Promise<BoardTaskDetail> {
  const response = await fetch(`${API_BASE}/board/issues/${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw await parseError(response);
  }
  const body = (await response.json()) as Partial<BoardTaskDetail>;
  if (typeof body.key !== "string" || typeof body.description !== "string" || !Array.isArray(body.comments)) {
    throw { message: "No se ha podido cargar el detalle de la tarea." } satisfies ApiError;
  }
  return { key: body.key, description: body.description, comments: body.comments };
}

export async function roomExists(id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/rooms/${encodeURIComponent(id)}`);
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return true;
}
