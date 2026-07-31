import { JuroApiAdapter, JuroApiError } from "./juro-api.adapter";
import { JURO_CONNECTOR_MANIFEST } from "./juro.connector";

const credentials = {
  apiKey: "customer-juro-key",
  apiOrigin: "https://api-sandbox.juro.io",
};

describe("Juro connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the broad customer key on an exact environment and read-only surface", () => {
    expect(
      JURO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name),
    ).toEqual(["JURO_API_ORIGIN", "JURO_API_KEY"]);
    expect(JURO_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual([
      "read",
      "read",
    ]);
    expect(
      JURO_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates API-key health without returning provider data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "ok" }), { status: 200 }),
      );
    const result = await new JuroApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api-sandbox.juro.io/v3/health",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-api-key": "customer-juro-key",
    });
    expect(result).toMatchObject({
      credentialValid: true,
      environment: "sandbox",
      broadAccountKey: true,
      writesEnabled: false,
    });
  });

  it("lists only bounded redacted template lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            templates: [
              {
                id: "5de9227402e24204247757c4",
                name: "NDA",
                status: "published",
                createdDate: "2026-01-01",
                updatedDate: "2026-02-01",
                sharingUrl: "https://private",
                fields: [{ value: "secret" }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new JuroApiAdapter().listTemplates(credentials, {
      limit: 1,
    });
    expect(result.templates).toEqual([
      {
        templateId: "5de9227402e24204247757c4",
        name: "NDA",
        status: "published",
        createdAt: "2026-01-01",
        updatedAt: "2026-02-01",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("https://private");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("strictly projects one template without fields, people, or links", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            template: {
              id: "5de9227402e24204247757c4",
              name: "NDA",
              status: "published",
              createdDate: "2026-01-01",
              updatedDate: "2026-02-01",
              internalUrl: "https://private",
              questions: [{ title: "Email", text: "private" }],
              signingSides: [
                { signatures: [{ username: "private@example.com" }] },
              ],
              state: {
                approval: { approvers: [{ username: "legal@example.com" }] },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const result = await new JuroApiAdapter().getTemplate(credentials, {
      templateId: "5de9227402e24204247757c4",
    });
    expect(result.template).toEqual({
      templateId: "5de9227402e24204247757c4",
      name: "NDA",
      status: "published",
      createdAt: "2026-01-01",
      updatedAt: "2026-02-01",
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("https://private");
  });

  it("rejects invalid environments, IDs, and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new JuroApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://evil.example" }),
    ).rejects.toBeInstanceOf(JuroApiError);
    await expect(
      adapter.getTemplate(credentials, { templateId: "../private" }),
    ).rejects.toBeInstanceOf(JuroApiError);
    await expect(
      adapter.listTemplates(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(JuroApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
