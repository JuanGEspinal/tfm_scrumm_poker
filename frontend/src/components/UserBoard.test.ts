import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { PublicUser } from "@scrum-poker/shared";
import { avatarUrl } from "../avatars";
import UserBoard from "./UserBoard.vue";

const users: PublicUser[] = [
  { id: "a", displayName: "Ana", avatar: "bernard", hasVoted: true, vote: null, isCreator: true },
  { id: "b", displayName: "Bruno", avatar: "stan", hasVoted: false, vote: null, isCreator: false },
];

describe("UserBoard", () => {
  it("marks voted users without showing their card while voting", () => {
    const wrapper = mount(UserBoard, { props: { users, revealed: false } });
    const seats = wrapper.findAll(".seat");
    expect(seats).toHaveLength(2);
    expect(seats[0]?.classes()).toContain("voted");
    expect(seats[1]?.classes()).not.toContain("voted");
    expect(wrapper.findAll(".seat-value").map((v) => v.text())).toEqual(["—", "—"]);
  });

  it("shows the avatar on the card front and the name below the card", () => {
    const wrapper = mount(UserBoard, { props: { users, revealed: false } });
    const imgs = wrapper.findAll(".seat-front img");
    expect(imgs.map((img) => img.attributes("src"))).toEqual([avatarUrl("bernard"), avatarUrl("stan")]);
    expect(wrapper.find(".seat-inner .seat-name").exists()).toBe(false);
    expect(wrapper.findAll(".seat > .seat-name").map((n) => n.text())).toEqual(["Ana", "Bruno"]);
  });

  it("flips and shows votes when revealed", () => {
    const revealedUsers = users.map((u) => (u.id === "a" ? { ...u, vote: "8" as const } : u));
    const wrapper = mount(UserBoard, { props: { users: revealedUsers, revealed: true } });
    expect(wrapper.findAll(".seat.revealed")).toHaveLength(2);
    expect(wrapper.findAll(".seat-value").map((v) => v.text())).toEqual(["8", "—"]);
  });
});
