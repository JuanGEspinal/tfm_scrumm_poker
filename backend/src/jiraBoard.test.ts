import { describe, expect, it, vi } from "vitest";
import {
  adfToPlainText,
  loadBoardTaskDetail,
  loadBoardTasks,
  readJiraConfig,
  readStoryPoints,
  toBoardTask,
  type JiraConfig,
} from "./jiraBoard.js";

const config: JiraConfig = {
  baseUrl: "https://scrumpocker.atlassian.net",
  email: "ada@example.com",
  apiToken: "token",
  boardId: 1,
  storyPointsField: "customfield_10016",
};

describe("readJiraConfig", () => {
  it("requires email and api token", () => {
    expect(readJiraConfig({})).toBeNull();
    expect(readJiraConfig({ JIRA_EMAIL: "ada@example.com" })).toBeNull();
  });

  it("defaults the scrum poker board and story point field", () => {
    expect(
      readJiraConfig({
        JIRA_EMAIL: "ada@example.com",
        JIRA_API_TOKEN: "secret",
      }),
    ).toEqual({
      baseUrl: "https://scrumpocker.atlassian.net",
      email: "ada@example.com",
      apiToken: "secret",
      boardId: 1,
      storyPointsField: "customfield_10016",
    });
  });
});

describe("readStoryPoints", () => {
  it("treats an empty field as missing and zero as filled", () => {
    expect(readStoryPoints(null)).toBeNull();
    expect(readStoryPoints("")).toBeNull();
    expect(readStoryPoints(0)).toBe(0);
    expect(readStoryPoints("8")).toBe(8);
    expect(readStoryPoints({ value: 5 })).toBe(5);
  });
});

describe("toBoardTask", () => {
  it("marks done issues and filled story points", () => {
    expect(
      toBoardTask(
        {
          key: "SCRUM-2",
          fields: {
            summary: "Cerrar sprint",
            status: { statusCategory: { key: "done" } },
            customfield_10016: 3,
          },
        },
        "customfield_10016",
      ),
    ).toEqual({
      key: "SCRUM-2",
      title: "Cerrar sprint",
      done: true,
      estimated: true,
    });
  });
});

describe("loadBoardTasks", () => {
  it("pages through the board and maps titles", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const startAt = new URL(String(input)).searchParams.get("startAt");
      const issues =
        startAt === "0"
          ? [
              {
                key: "SCRUM-1",
                fields: {
                  summary: "Elegir base de datos",
                  status: { statusCategory: { key: "new" } },
                  customfield_10016: null,
                },
              },
            ]
          : [
              {
                key: "SCRUM-3",
                fields: {
                  summary: "Tarea 3",
                  status: { statusCategory: { key: "indeterminate" } },
                  customfield_10016: null,
                },
              },
            ];
      return new Response(JSON.stringify({ total: 2, issues }), { status: 200 });
    });

    const tasks = await loadBoardTasks(config, fetchImpl as typeof fetch, 1);
    expect(tasks.map((task) => task.title)).toEqual(["Elegir base de datos", "Tarea 3"]);
    expect(tasks.every((task) => !task.done && !task.estimated)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails when Jira rejects the credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(loadBoardTasks(config, fetchImpl as typeof fetch)).rejects.toMatchObject({
      code: "jira_unauthorized",
    });
  });
});

describe("loadBoardTaskDetail", () => {
  it("reads the description and comments as plain text", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/comment")) {
        return new Response(
          JSON.stringify({
            total: 1,
            comments: [
              {
                id: "10001",
                created: "2026-03-01T10:00:00.000+0000",
                author: { displayName: "Ada" },
                body: {
                  type: "doc",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Mirad Redis." }] }],
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          fields: {
            description: {
              type: "doc",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Elegir Postgres." }] },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [{ type: "paragraph", content: [{ type: "text", text: "Con Redis" }] }],
                    },
                  ],
                },
              ],
            },
          },
        }),
        { status: 200 },
      );
    });

    await expect(loadBoardTaskDetail(config, "scrum-1", fetchImpl as typeof fetch)).resolves.toEqual({
      key: "SCRUM-1",
      description: "Elegir Postgres.\n\n- Con Redis",
      comments: [
        {
          id: "10001",
          author: "Ada",
          createdAt: "2026-03-01T10:00:00.000+0000",
          body: "Mirad Redis.",
        },
      ],
    });
  });

  it("rejects a key that is not a Jira issue", async () => {
    const fetchImpl = vi.fn();
    await expect(loadBoardTaskDetail(config, "../admin", fetchImpl as typeof fetch)).rejects.toMatchObject({
      code: "invalid_issue_key",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("adfToPlainText", () => {
  it("returns an empty string when the description is missing", () => {
    expect(adfToPlainText(null)).toBe("");
  });
});
