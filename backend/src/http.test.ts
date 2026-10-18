import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "ioredis";
import { buildApp } from "./app.js";
import { roomJiraKey } from "./roomStore.js";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const jira = {
  boardUrl: "https://scrumpocker.atlassian.net/jira/software/projects/SCRUM/boards/1",
  email: "ada@example.com",
  apiToken: "secret",
};

describe("room HTTP API with Jira", () => {
  const fetchImpl = vi.fn<typeof fetch>();
  let built: Awaited<ReturnType<typeof buildApp>>;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(redisUrl);
    built = await buildApp({ redis, redisUrl, corsOrigin: "*", logger: false, useAdapter: false, fetchImpl });
  });

  afterAll(async () => {
    built.io.close();
    await built.app.close();
    built.pubClient.disconnect();
    built.subClient.disconnect();
    redis.disconnect();
  });

  beforeEach(() => {
    fetchImpl.mockReset();
  });

  function roomId(): string {
    return `http-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  it("creates a linked room after Jira accepts the credentials", async () => {
    fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    const id = roomId();

    const created = await built.app.inject({ method: "POST", url: "/rooms", payload: { id, jira } });

    expect(created.statusCode).toBe(201);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://scrumpocker.atlassian.net/rest/agile/1.0/board/1");
    expect((await built.store.get(id))?.jiraLinked).toBe(true);
    expect(JSON.parse((await redis.get(roomJiraKey(id))) ?? "null")).toMatchObject({
      baseUrl: "https://scrumpocker.atlassian.net",
      boardId: 1,
      email: "ada@example.com",
    });

    fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ issues: [] }), { status: 200 }));
    const issues = await built.app.inject({ method: "GET", url: `/rooms/${id}/board/issues` });
    expect(issues.statusCode).toBe(200);
    expect(issues.json()).toEqual({ tasks: [] });
  });

  it("does not create the room when Jira rejects the credentials", async () => {
    fetchImpl.mockResolvedValueOnce(new Response("no", { status: 401 }));
    const id = roomId();

    const created = await built.app.inject({ method: "POST", url: "/rooms", payload: { id, jira } });

    expect(created.statusCode).toBe(401);
    expect(created.json()).toMatchObject({ code: "jira_unauthorized" });
    expect(await built.store.exists(id)).toBe(false);
  });

  it("rejects an invalid Jira payload without calling Jira", async () => {
    const created = await built.app.inject({
      method: "POST",
      url: "/rooms",
      payload: { id: roomId(), jira: { ...jira, boardUrl: "http://127.0.0.1/boards/1" } },
    });

    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({ code: "invalid_jira_config" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 409 on board routes of a room without Jira", async () => {
    const id = roomId();
    const created = await built.app.inject({ method: "POST", url: "/rooms", payload: { id } });
    expect(created.statusCode).toBe(201);
    expect((await built.store.get(id))?.jiraLinked).toBe(false);

    const issues = await built.app.inject({ method: "GET", url: `/rooms/${id}/board/issues` });
    const estimate = await built.app.inject({
      method: "PUT",
      url: `/rooms/${id}/board/issues/SCRUM-1/estimate`,
      payload: { points: 5 },
    });
    const attachment = await built.app.inject({
      method: "GET",
      url: `/rooms/${id}/board/issues/SCRUM-1/attachments/1`,
    });

    for (const response of [issues, estimate, attachment]) {
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "jira_not_linked" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
