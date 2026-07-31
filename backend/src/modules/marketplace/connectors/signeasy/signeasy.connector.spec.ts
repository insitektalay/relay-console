import { SigneasyApiAdapter, SigneasyApiError } from "./signeasy-api.adapter";
import { SIGNEASY_CONNECTOR_MANIFEST } from "./signeasy.connector";

describe("Signeasy connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses only rs:read plus offline_access", () => {
    expect(SIGNEASY_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "rs:read",
      "offline_access",
    ]);
    expect(SIGNEASY_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      SIGNEASY_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });
  it("lists at most 25 summaries and strips people, files, and signing data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: Array.from({ length: 30 }, (_, i) => ({
              id: i + 1,
              name: `Envelope ${i}`,
              status: "incomplete",
              recipients: [{ email: "private@example.com" }],
              files: [{ url: "https://private.example/file" }],
              signing_url: "https://private.example/sign",
            })),
          }),
          { status: 200 },
        ),
      );
    const result = await new SigneasyApiAdapter().listEnvelopes("token", {
      resultLimit: 25,
    });
    expect(new URL(String(fetchMock.mock.calls[0][0])).toString()).toBe(
      "https://api.signeasy.com/v3/rs/",
    );
    expect(result.envelopes).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });
  it("reads one fixed envelope path and projects lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 42,
            name: "NDA",
            status: "complete",
            created_at: "2026-07-17T10:00:00Z",
            recipients: [{ email: "private@example.com" }],
          }),
          { status: 200 },
        ),
      );
    const result = await new SigneasyApiAdapter().getEnvelope("token", {
      envelopeId: 42,
    });
    expect(result.envelope).toEqual({
      envelopeId: 42,
      name: "NDA",
      status: "complete",
      createdAt: "2026-07-17T10:00:00Z",
      updatedAt: null,
      expiresAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });
  it("rejects invalid IDs and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SigneasyApiAdapter();
    await expect(
      adapter.getEnvelope("token", { envelopeId: 0 }),
    ).rejects.toBeInstanceOf(SigneasyApiError);
    await expect(
      adapter.listEnvelopes("token", { resultLimit: 26 }),
    ).rejects.toBeInstanceOf(SigneasyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
