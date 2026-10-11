import { describe, expect, it, vi, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { BoardTask, BoardTaskDetail } from "@scrum-poker/shared";
import BoardDrawer from "./BoardDrawer.vue";

const tasks: BoardTask[] = [
  { key: "SCRUM-1", title: "Elegir base de datos", done: false, estimated: false },
  { key: "SCRUM-2", title: "Cerrar sprint", done: true, estimated: false },
  { key: "SCRUM-3", title: "Definir estilo", done: false, estimated: true },
  { key: "SCRUM-4", title: "Base de datos", done: true, estimated: true },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const detail: BoardTaskDetail = {
  key: "SCRUM-1",
  description: "Elegir Postgres.\n\n- Con Redis",
  comments: [
    {
      id: "10001",
      author: "Ada",
      createdAt: "2026-03-01T10:00:00.000Z",
      body: "Mirad Redis.",
    },
  ],
  attachments: [
    { id: "20001", filename: "esquema.png", size: 1536, mimeType: "image/png" },
    { id: "20002", filename: "notas.pdf", size: 2048, mimeType: "application/pdf" },
  ],
};

async function openDrawer(selectedKey?: string) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/board/issues/")) {
      return jsonResponse(detail);
    }
    return jsonResponse({ tasks });
  });
  vi.stubGlobal("fetch", fetchImpl);
  const wrapper = mount(BoardDrawer, { props: { open: true, selectedKey } });
  await flushPromises();
  return wrapper;
}

describe("BoardDrawer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("lists only the title, with ellipsis styling", async () => {
    const wrapper = await openDrawer();
    const items = wrapper.findAll(".board-task-title");
    expect(items.map((item) => item.text())).toEqual([
      "Elegir base de datos",
      "Cerrar sprint",
      "Definir estilo",
      "Base de datos",
    ]);
    expect(items[0]?.attributes("title")).toBe("Elegir base de datos");
    expect(wrapper.text()).not.toContain("SCRUM-1");
  });

  it("filters by a partial title and combines the preset buttons", async () => {
    const wrapper = await openDrawer();
    await wrapper.get("input").setValue("base");
    expect(wrapper.findAll(".board-task-title").map((item) => item.text())).toEqual([
      "Elegir base de datos",
      "Base de datos",
    ]);

    await wrapper.get("button[aria-pressed]").trigger("click");
    const buttons = wrapper.findAll(".board-filters button");
    expect(buttons[0]?.attributes("aria-pressed")).toBe("true");
    expect(wrapper.findAll(".board-task-title").map((item) => item.text())).toEqual(["Elegir base de datos"]);

    await buttons[1]?.trigger("click");
    expect(wrapper.findAll(".board-task-title").map((item) => item.text())).toEqual(["Elegir base de datos"]);

    await wrapper.get("input").setValue("");
    await buttons[0]?.trigger("click");
    expect(wrapper.findAll(".board-task-title").map((item) => item.text())).toEqual([
      "Elegir base de datos",
      "Cerrar sprint",
    ]);
  });

  it("shows the server error when the board cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ code: "jira_not_configured", message: "Jira no está configurado en el servidor." }, 503),
      ),
    );
    const wrapper = mount(BoardDrawer, { props: { open: true } });
    await flushPromises();
    expect(wrapper.get(".error").text()).toContain("Jira no está configurado en el servidor.");
  });

  it("shows the description and comments under the list when the title is chosen", async () => {
    const wrapper = await openDrawer();
    expect(wrapper.get(".board-detail").text()).toContain("Pulsa el nombre de una tarea");
    await wrapper.get(".board-task-title").trigger("click");
    await flushPromises();
    const panel = wrapper.get(".board-detail");
    expect(panel.text()).toContain("Elegir base de datos");
    expect(panel.text()).toContain("Elegir Postgres.");
    expect(panel.text()).toContain("Ada");
    expect(panel.text()).toContain("Mirad Redis.");
    expect(panel.text()).toContain("esquema.png");
    expect(panel.text()).toContain("1,5 KB");
    const links = panel.findAll(".board-attachment");
    expect(links[0]?.attributes("href")).toBe("/api/board/issues/SCRUM-1/attachments/20001");
    expect(links[0]?.attributes("target")).toBe("_blank");
    expect(links[0]?.get("img").attributes("src")).toBe("/api/board/issues/SCRUM-1/attachments/20001/thumbnail");
    expect(links[1]?.attributes("href")).toBe("/api/board/issues/SCRUM-1/attachments/20002");
    expect(links[1]?.get(".board-attachment-fallback").text()).toBe("PDF");
    expect(links[1]?.find("img").exists()).toBe(false);
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(wrapper.get(".board-task-row.inspecting .board-task-title").text()).toBe("Elegir base de datos");
  });

  it("selects a task from the row button and asks to close", async () => {
    const wrapper = await openDrawer("SCRUM-3");
    expect(wrapper.get(".board-task-row.selected .board-task-title").text()).toBe("Definir estilo");
    await wrapper.get(".board-task-select").trigger("click");
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({ key: "SCRUM-1", title: "Elegir base de datos" });
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(wrapper.find(".board-toggle").exists()).toBe(false);
  });
});
