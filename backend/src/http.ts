import type { FastifyInstance, FastifyReply } from "fastify";
import { isFibonacciEstimate, isValidRoomId, normalizeRoomId } from "@scrum-poker/shared";
import { ERROR_MESSAGES } from "./errorMessages.js";
import {
  assignStoryPoints,
  JiraBoardError,
  loadBoardTaskAttachment,
  loadBoardTaskDetail,
  loadBoardTasks,
  type JiraConfig,
} from "./jiraBoard.js";
import type { RoomStore } from "./roomStore.js";

const JIRA_MESSAGES = {
  jira_not_configured:
    "Jira no está configurado en el servidor. Indica JIRA_EMAIL y JIRA_API_TOKEN en backend/.env.",
  jira_unauthorized: "Jira ha rechazado las credenciales del servidor.",
  jira_unavailable: "No se han podido cargar las tareas del panel.",
  jira_not_found: "No se ha encontrado esa tarea en Jira.",
  invalid_issue_key: "La clave de la tarea no es válida.",
  invalid_attachment_id: "El identificador del adjunto no es válido.",
  attachment_not_found: "No se ha encontrado ese adjunto.",
  invalid_estimate: "La estimación debe ser 0, 1, 2, 3, 5, 8, 13 o 21.",
} as const;

function jiraStatus(code: keyof typeof JIRA_MESSAGES): number {
  if (code === "jira_not_configured") {
    return 503;
  }
  if (code === "jira_unauthorized") {
    return 401;
  }
  if (code === "jira_not_found" || code === "attachment_not_found") {
    return 404;
  }
  if (code === "invalid_issue_key" || code === "invalid_attachment_id" || code === "invalid_estimate") {
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

  app.get<{ Params: { key: string; attachmentId: string } }>(
    "/board/issues/:key/attachments/:attachmentId",
    async (request, reply) => sendAttachment(reply, jira, request.params, "content"),
  );

  app.get<{ Params: { key: string; attachmentId: string } }>(
    "/board/issues/:key/attachments/:attachmentId/thumbnail",
    async (request, reply) => sendAttachment(reply, jira, request.params, "thumbnail"),
  );

  app.put<{ Params: { key: string }; Body: { points?: unknown } }>(
    "/board/issues/:key/estimate",
    async (request, reply) => {
      if (!jira) {
        return reply.code(503).send({
          code: "jira_not_configured",
          message: JIRA_MESSAGES.jira_not_configured,
        });
      }
      const points = request.body?.points;
      if (typeof points !== "number" || !isFibonacciEstimate(points)) {
        return reply.code(400).send({
          code: "invalid_estimate",
          message: JIRA_MESSAGES.invalid_estimate,
        });
      }
      try {
        await assignStoryPoints(jira, request.params.key, points);
        return reply.code(204).send();
      } catch (error) {
        return sendJiraError(reply, error, "No se ha podido asignar la estimación.");
      }
    },
  );
}

async function sendAttachment(
  reply: FastifyReply,
  jira: JiraConfig | null,
  params: { key: string; attachmentId: string },
  variant: "content" | "thumbnail",
) {
  if (!jira) {
    return reply.code(503).send({
      code: "jira_not_configured",
      message: JIRA_MESSAGES.jira_not_configured,
    });
  }
  try {
    const file = await loadBoardTaskAttachment(jira, params.key, params.attachmentId, variant);
    return reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, max-age=300")
      .header("Content-Disposition", inlineDisposition(file.filename))
      .type(file.mimeType)
      .send(file.bytes);
  } catch (error) {
    return sendJiraError(reply, error, "No se ha podido abrir el adjunto.");
  }
}

function inlineDisposition(filename: string): string {
  const cleaned = filename.replace(/[\r\n"]/g, "_").slice(0, 180);
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

function sendJiraError(reply: FastifyReply, error: unknown, unavailableMessage: string) {
  const code = error instanceof JiraBoardError ? error.code : "jira_unavailable";
  const message = code === "jira_unavailable" ? unavailableMessage : JIRA_MESSAGES[code];
  return reply.code(jiraStatus(code)).send({ code, message });
}
