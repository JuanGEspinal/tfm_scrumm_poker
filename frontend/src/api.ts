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
