import type { FastifyInstance, FastifyReply } from "fastify";
import { isFibonacciEstimate, isValidRoomId, normalizeRoomId } from "@scrum-poker/shared";
import { ERROR_MESSAGES } from "./errorMessages.js";
import {
  assignStoryPoints,
  JiraBoardError,
  loadBoardTaskAttachment,
  loadBoardTaskDetail,
  loadBoardTasks,
  toJiraConfig,
  verifyJiraBoard,
  type JiraConfig,
} from "./jiraBoard.js";
import type { RoomStore } from "./roomStore.js";

const JIRA_MESSAGES = {
  jira_not_linked: "Esta sala no está vinculada a Jira.",
  invalid_jira_config:
    "Revisa los datos de Jira: la URL debe ser un panel de https://<sitio>.atlassian.net y el email y el API token son obligatorios.",
  jira_unauthorized: "Jira ha rechazado las credenciales de la sala.",
  jira_unavailable: "No se han podido cargar las tareas del panel.",
  jira_not_found: "No se ha encontrado esa tarea en Jira.",
  invalid_issue_key: "La clave de la tarea no es válida.",
  invalid_attachment_id: "El identificador del adjunto no es válido.",
  attachment_not_found: "No se ha encontrado ese adjunto.",
  invalid_estimate: "La estimación debe ser 0, 1, 2, 3, 5, 8, 13 o 21.",
} as const;

const LINK_MESSAGES = {
  jira_unauthorized: "Jira ha rechazado el email o el API token.",
  jira_not_found: "No se ha encontrado ese panel en Jira o no tienes acceso a él.",
  jira_unavailable: "No se ha podido conectar con Jira.",
} as const;

type JiraErrorCode = keyof typeof JIRA_MESSAGES;

function jiraStatus(code: JiraErrorCode): number {
  if (code === "jira_not_linked") {
    return 409;
  }
  if (code === "jira_unauthorized") {
    return 401;
  }
  if (code === "jira_not_found" || code === "attachment_not_found") {
    return 404;
  }
  if (
    code === "invalid_issue_key" ||
    code === "invalid_attachment_id" ||
    code === "invalid_estimate" ||
    code === "invalid_jira_config"
  ) {
    return 400;
  }
  return 502;
}

function sendRoomError(reply: FastifyReply, code: keyof typeof ERROR_MESSAGES) {
  const status = code === "room_exists" ? 409 : code === "room_not_found" ? 404 : 400;
  return reply.code(status).send({ code, message: ERROR_MESSAGES[code] });
}

export function registerHttp(app: FastifyInstance, store: RoomStore, fetchImpl: typeof fetch = fetch): void {
  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { id?: string; jira?: unknown } }>("/rooms", async (request, reply) => {
    const id = normalizeRoomId(request.body?.id ?? "");
    if (!isValidRoomId(id)) {
      return sendRoomError(reply, "invalid_room_id");
    }

    let jira: JiraConfig | undefined;
    if (request.body?.jira !== undefined) {
      const config = toJiraConfig(request.body.jira);
      if (!config) {
        return reply.code(400).send({ code: "invalid_jira_config", message: JIRA_MESSAGES.invalid_jira_config });
      }
      if (await store.exists(id)) {
        return sendRoomError(reply, "room_exists");
      }
      try {
        await verifyJiraBoard(config, fetchImpl);
      } catch (error) {
        const code = error instanceof JiraBoardError && error.code in LINK_MESSAGES
          ? (error.code as keyof typeof LINK_MESSAGES)
          : "jira_unavailable";
        return reply.code(jiraStatus(code)).send({ code, message: LINK_MESSAGES[code] });
      }
      jira = config;
    }

    try {
      const room = await store.create(id, jira);
      return reply.code(201).send({ id: room.id });
    } catch (error) {
      const code = error instanceof Error && error.message === "room_exists" ? "room_exists" : "invalid_room_id";
      return sendRoomError(reply, code);
    }
  });

  app.get<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    const id = normalizeRoomId(request.params.id);
    if (!isValidRoomId(id)) {
      return sendRoomError(reply, "invalid_room_id");
    }
    const exists = await store.exists(id);
    if (!exists) {
      return sendRoomError(reply, "room_not_found");
    }
    return { id, exists: true };
  });

  async function roomJira(reply: FastifyReply, roomId: string): Promise<JiraConfig | null> {
    const jira = await store.getJira(roomId);
    if (!jira) {
      reply.code(409).send({ code: "jira_not_linked", message: JIRA_MESSAGES.jira_not_linked });
    }
    return jira;
  }

  app.get<{ Params: { id: string } }>("/rooms/:id/board/issues", async (request, reply) => {
    const jira = await roomJira(reply, request.params.id);
    if (!jira) {
      return reply;
    }
    try {
      const tasks = await loadBoardTasks(jira, fetchImpl);
      return { tasks };
    } catch (error) {
      return sendJiraError(reply, error, JIRA_MESSAGES.jira_unavailable);
    }
  });

  app.get<{ Params: { id: string; key: string } }>("/rooms/:id/board/issues/:key", async (request, reply) => {
    const jira = await roomJira(reply, request.params.id);
    if (!jira) {
      return reply;
    }
    try {
      return await loadBoardTaskDetail(jira, request.params.key, fetchImpl);
    } catch (error) {
      return sendJiraError(reply, error, "No se ha podido cargar el detalle de la tarea.");
    }
  });

  app.get<{ Params: { id: string; key: string; attachmentId: string } }>(
    "/rooms/:id/board/issues/:key/attachments/:attachmentId",
    async (request, reply) => sendAttachment(reply, await roomJira(reply, request.params.id), request.params, "content"),
  );

  app.get<{ Params: { id: string; key: string; attachmentId: string } }>(
    "/rooms/:id/board/issues/:key/attachments/:attachmentId/thumbnail",
    async (request, reply) =>
      sendAttachment(reply, await roomJira(reply, request.params.id), request.params, "thumbnail"),
  );

  app.put<{ Params: { id: string; key: string }; Body: { points?: unknown } }>(
    "/rooms/:id/board/issues/:key/estimate",
    async (request, reply) => {
      const jira = await roomJira(reply, request.params.id);
      if (!jira) {
        return reply;
      }
      const points = request.body?.points;
      if (typeof points !== "number" || !isFibonacciEstimate(points)) {
        return reply.code(400).send({
          code: "invalid_estimate",
          message: JIRA_MESSAGES.invalid_estimate,
        });
      }
      try {
        await assignStoryPoints(jira, request.params.key, points, fetchImpl);
        return reply.code(204).send();
      } catch (error) {
        return sendJiraError(reply, error, "No se ha podido asignar la estimación.");
      }
    },
  );

  async function sendAttachment(
    reply: FastifyReply,
    jira: JiraConfig | null,
    params: { key: string; attachmentId: string },
    variant: "content" | "thumbnail",
  ) {
    if (!jira) {
      return reply;
    }
    try {
      const file = await loadBoardTaskAttachment(jira, params.key, params.attachmentId, variant, fetchImpl);
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
