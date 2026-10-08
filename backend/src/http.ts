import type { FastifyInstance, FastifyReply } from "fastify";
import { isValidRoomId, normalizeRoomId } from "@scrum-poker/shared";
import { ERROR_MESSAGES } from "./errorMessages.js";
import { JiraBoardError, loadBoardTaskDetail, loadBoardTasks, type JiraConfig } from "./jiraBoard.js";
import type { RoomStore } from "./roomStore.js";

const JIRA_MESSAGES = {
  jira_not_configured:
    "Jira no está configurado en el servidor. Indica JIRA_EMAIL y JIRA_API_TOKEN en backend/.env.",
  jira_unauthorized: "Jira ha rechazado las credenciales del servidor.",
  jira_unavailable: "No se han podido cargar las tareas del panel.",
  jira_not_found: "No se ha encontrado esa tarea en Jira.",
  invalid_issue_key: "La clave de la tarea no es válida.",
} as const;

function jiraStatus(code: keyof typeof JIRA_MESSAGES): number {
  if (code === "jira_not_configured") {
    return 503;
  }
  if (code === "jira_unauthorized") {
    return 401;
  }
  if (code === "jira_not_found") {
    return 404;
  }
  if (code === "invalid_issue_key") {
    return 400;
  }
  return 502;
}

export function registerHttp(app: FastifyInstance, store: RoomStore, jira: JiraConfig | null = null): void {
  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { id?: string } }>("/rooms", async (request, reply) => {
    try {
      const room = await store.create(request.body?.id ?? "");
      return reply.code(201).send({ id: room.id });
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_room_id";
      const status = code === "room_exists" ? 409 : 400;
      return reply.code(status).send({
        code,
        message: ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? ERROR_MESSAGES.invalid_room_id,
      });
    }
  });

  app.get<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    const id = normalizeRoomId(request.params.id);
    if (!isValidRoomId(id)) {
      return reply.code(400).send({
        code: "invalid_room_id",
        message: ERROR_MESSAGES.invalid_room_id,
      });
    }
    const exists = await store.exists(id);
    if (!exists) {
      return reply.code(404).send({
        code: "room_not_found",
        message: ERROR_MESSAGES.room_not_found,
      });
    }
    return { id, exists: true };
  });

  app.get("/board/issues", async (_request, reply) => {
    if (!jira) {
      return reply.code(503).send({
        code: "jira_not_configured",
        message: JIRA_MESSAGES.jira_not_configured,
      });
    }
    try {
      const tasks = await loadBoardTasks(jira);
      return { tasks };
    } catch (error) {
      return sendJiraError(reply, error, JIRA_MESSAGES.jira_unavailable);
    }
  });

  app.get<{ Params: { key: string } }>("/board/issues/:key", async (request, reply) => {
    if (!jira) {
      return reply.code(503).send({
        code: "jira_not_configured",
        message: JIRA_MESSAGES.jira_not_configured,
      });
    }
    try {
      return await loadBoardTaskDetail(jira, request.params.key);
    } catch (error) {
      return sendJiraError(reply, error, "No se ha podido cargar el detalle de la tarea.");
    }
  });
}

function sendJiraError(reply: FastifyReply, error: unknown, unavailableMessage: string) {
  const code = error instanceof JiraBoardError ? error.code : "jira_unavailable";
  const message = code === "jira_unavailable" ? unavailableMessage : JIRA_MESSAGES[code];
  return reply.code(jiraStatus(code)).send({ code, message });
}
