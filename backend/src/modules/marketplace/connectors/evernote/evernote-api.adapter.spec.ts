import { EvernoteApiAdapter, EvernoteApiError } from "./evernote-api.adapter";

describe("EvernoteApiAdapter", () => {
  const adapter = new EvernoteApiAdapter();
  const credentials = { accessToken: "test-token" };

  it("rejects create-note payloads without title and ENML content before transport", async () => {
    await expect(adapter.createNote(credentials, {})).rejects.toMatchObject({
      code: "provider_validation_error",
    } satisfies Partial<EvernoteApiError>);
  });

  it("rejects note content without an en-note root before transport", async () => {
    await expect(
      adapter.createNote(credentials, { title: "Test", content: "plain text" }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
    } satisfies Partial<EvernoteApiError>);
  });

  it("rejects undocumented generic NoteStore operations", async () => {
    await expect(
      adapter.invoke(credentials, { operation: "getSecretInternalState" }),
    ).rejects.toMatchObject({
      code: "policy_blocked",
    } satisfies Partial<EvernoteApiError>);
  });

  it("rejects credential material in generic arguments", async () => {
    await expect(
      adapter.invoke(credentials, {
        operation: "listNotebooks",
        args: [{ accessToken: "leak" }],
      }),
    ).rejects.toMatchObject({
      code: "policy_blocked",
    } satisfies Partial<EvernoteApiError>);
  });
});
