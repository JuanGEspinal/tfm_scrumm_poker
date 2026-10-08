import Fastify from "fastify";
import cors from "@fastify/cors";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { registerHttp } from "./http.js";
import { readJiraConfig, type JiraConfig } from "./jiraBoard.js";
import { RoomStore } from "./roomStore.js";
import { createSocketServer } from "./sockets.js";

export async function buildApp(options?: {
  redisUrl?: string;
  corsOrigin?: string;
  redis?: Redis;
  logger?: boolean;
  useAdapter?: boolean;
  jira?: JiraConfig | null;
}) {
  const redisUrl = options?.redisUrl ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const corsOrigin = options?.corsOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const redis = options?.redis ?? new Redis(redisUrl);
  const pubClient = new Redis(redisUrl);
  const subClient = new Redis(redisUrl);

  await Promise.all([redis.ping(), pubClient.ping(), subClient.ping()]);

  const app = Fastify({ logger: options?.logger ?? true });
  await app.register(cors, { origin: corsOrigin });

  const store = new RoomStore(redis);
  const jira = options?.jira === undefined ? readJiraConfig() : options.jira;
  registerHttp(app, store, jira);

  await app.ready();
  const io = createSocketServer(app.server, store, corsOrigin);
  if (options?.useAdapter !== false) {
    io.adapter(createAdapter(pubClient, subClient));
  }

  return { app, io, redis, pubClient, subClient, store };
}
