import { describe, expect, it } from "vitest";
import { filterBoardTasks, isBoardTaskKey, parseBoardTask, type BoardTask } from "./boardTasks.js";

const tasks: BoardTask[] = [
  { key: "SCRUM-1", title: "Elegir base de datos", done: false, estimated: false },
  { key: "SCRUM-2", title: "Cerrar sprint", done: true, estimated: false },
  { key: "SCRUM-3", title: "Definir estilo", done: false, estimated: true },
  { key: "SCRUM-4", title: "Base de datos", done: true, estimated: true },
];

describe("filterBoardTasks", () => {
  it("returns every task when no filter is active", () => {
    expect(filterBoardTasks(tasks, { query: "  ", activeOnly: false, unestimatedOnly: false })).toEqual(tasks);
  });

  it("matches the title partially, ignoring case", () => {
    expect(
      filterBoardTasks(tasks, { query: "BASE", activeOnly: false, unestimatedOnly: false }).map((task) => task.key),
    ).toEqual(["SCRUM-1", "SCRUM-4"]);
  });

  it("keeps unfinished tasks when Activas is on", () => {
    expect(
      filterBoardTasks(tasks, { query: "", activeOnly: true, unestimatedOnly: false }).map((task) => task.key),
    ).toEqual(["SCRUM-1", "SCRUM-3"]);
  });

  it("keeps tasks without story points when No estimadas is on", () => {
    expect(
      filterBoardTasks(tasks, { query: "", activeOnly: false, unestimatedOnly: true }).map((task) => task.key),
    ).toEqual(["SCRUM-1", "SCRUM-2"]);
  });

  it("parses a board task and drops anything else", () => {
    const task = { key: "SCRUM-1", title: "  Elegir base de datos  ", done: false, estimated: true };
    expect(parseBoardTask(task)).toEqual({
      key: "SCRUM-1",
      title: "Elegir base de datos",
      done: false,
      estimated: true,
    });
    expect(parseBoardTask(null)).toBeNull();
    expect(parseBoardTask({ key: "scrum-1", title: "x", done: false, estimated: false })).toBeNull();
    expect(parseBoardTask({ key: "SCRUM-1", title: "   ", done: false, estimated: false })).toBeNull();
  });

  it("accepts a Jira issue key", () => {
    expect(isBoardTaskKey("SCRUM-1")).toBe(true);
    expect(isBoardTaskKey("scrum-1")).toBe(false);
    expect(isBoardTaskKey("SCRUM-1/comment")).toBe(false);
  });

  it("combines Activas and No estimadas with AND", () => {
    expect(
      filterBoardTasks(tasks, { query: "base", activeOnly: true, unestimatedOnly: true }).map((task) => task.key),
    ).toEqual(["SCRUM-1"]);
  });
});
