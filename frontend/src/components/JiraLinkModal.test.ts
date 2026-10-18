import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import JiraLinkModal from "./JiraLinkModal.vue";

const boardUrl = "https://empresa.atlassian.net/jira/software/projects/SCRUM/boards/1";

async function fill(wrapper: ReturnType<typeof mount>, values: { url?: string; email?: string; token?: string }) {
  const inputs = wrapper.findAll("input");
  await inputs[0]?.setValue(values.url ?? boardUrl);
  await inputs[1]?.setValue(values.email ?? "ada@example.com");
  await inputs[2]?.setValue(values.token ?? "secret");
}

describe("JiraLinkModal", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("asks for the board URL, email, API token and story point field", () => {
    const wrapper = mount(JiraLinkModal, { props: { open: true } });
    const text = wrapper.text();
    expect(wrapper.find("[role=dialog]").exists()).toBe(true);
    expect(text).toContain("URL del panel");
    expect(text).toContain("Email de Atlassian");
    expect(text).toContain("API token");
    expect(text).toContain("Campo de story points");
    expect(wrapper.findAll("input")[2]?.attributes("type")).toBe("password");
  });

  it("emits the credentials when the form is valid", async () => {
    const wrapper = mount(JiraLinkModal, { props: { open: true } });
    await fill(wrapper, { email: " ada@example.com " });
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      boardUrl,
      email: "ada@example.com",
      apiToken: "secret",
    });
  });

  it("rejects a URL that is not a Jira Cloud board", async () => {
    const wrapper = mount(JiraLinkModal, { props: { open: true } });
    await fill(wrapper, { url: "https://example.com/boards/1" });
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.get(".error").text()).toContain("URL de un panel de Jira Cloud");
  });

  it("shows the server error and blocks while checking", () => {
    const wrapper = mount(JiraLinkModal, {
      props: { open: true, submitting: true, error: "Jira ha rechazado el email o el API token." },
    });
    expect(wrapper.get(".error").text()).toBe("Jira ha rechazado el email o el API token.");
    const submit = wrapper.get("button[type=submit]");
    expect(submit.text()).toBe("Comprobando…");
    expect(submit.attributes("disabled")).toBeDefined();
  });

  it("closes from the cancel button", async () => {
    const wrapper = mount(JiraLinkModal, { props: { open: true } });
    await wrapper.get("button.secondary").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
