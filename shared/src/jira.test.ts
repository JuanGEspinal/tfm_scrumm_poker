import { describe, expect, it } from "vitest";
import { isJiraEmail, isStoryPointsField, parseJiraBoardUrl } from "./jira.js";

describe("parseJiraBoardUrl", () => {
  it("reads the site and board from a board URL", () => {
    expect(parseJiraBoardUrl("https://empresa.atlassian.net/jira/software/projects/SCRUM/boards/1")).toEqual({
      baseUrl: "https://empresa.atlassian.net",
      boardId: 1,
    });
    expect(
      parseJiraBoardUrl(" https://Empresa.atlassian.net/jira/software/c/projects/SCRUM/boards/42/backlog?x=1 "),
    ).toEqual({ baseUrl: "https://empresa.atlassian.net", boardId: 42 });
  });

  it("accepts the legacy RapidBoard URL", () => {
    expect(parseJiraBoardUrl("https://empresa.atlassian.net/secure/RapidBoard.jspa?rapidView=7")).toEqual({
      baseUrl: "https://empresa.atlassian.net",
      boardId: 7,
    });
  });

  it("rejects hosts outside Jira Cloud", () => {
    expect(parseJiraBoardUrl("https://evil.example.com/jira/software/projects/SCRUM/boards/1")).toBeNull();
    expect(parseJiraBoardUrl("https://atlassian.net.evil.com/boards/1")).toBeNull();
    expect(parseJiraBoardUrl("https://empresa.atlassian.net:8443/boards/1")).toBeNull();
  });

  it("requires https and a board id", () => {
    expect(parseJiraBoardUrl("http://empresa.atlassian.net/jira/software/projects/SCRUM/boards/1")).toBeNull();
    expect(parseJiraBoardUrl("https://empresa.atlassian.net/jira/software/projects/SCRUM")).toBeNull();
    expect(parseJiraBoardUrl("https://empresa.atlassian.net/boards/0")).toBeNull();
    expect(parseJiraBoardUrl("no es una url")).toBeNull();
  });
});

describe("jira field validation", () => {
  it("validates story point fields and emails", () => {
    expect(isStoryPointsField("customfield_10016")).toBe(true);
    expect(isStoryPointsField("summary")).toBe(false);
    expect(isJiraEmail("ada@example.com")).toBe(true);
    expect(isJiraEmail("ada")).toBe(false);
  });
});
