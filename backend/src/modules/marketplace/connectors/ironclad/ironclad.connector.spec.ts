import { IroncladApiAdapter, IroncladApiError } from "./ironclad-api.adapter";
import { IRONCLAD_CONNECTOR_MANIFEST } from "./ironclad.connector";

const credentials = {
  apiOrigin: "https://na1.ironcladapp.com",
  clientId: "customer-client",
  clientSecret: "customer-secret",
  asUserId: "5f0375c4cdc1927a3c5edcd3",
};
const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "short-lived-token",
      scope: "public.workflows.readSchemas",
      expires_in: 21600,
      token_type: "Bearer",
    }),
    { status: 200 },
  );

describe("Ironclad connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact read-only authority and one bound as-user identity", () => {
    expect(
      IRONCLAD_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "IRONCLAD_API_ORIGIN",
      "IRONCLAD_CLIENT_ID",
      "IRONCLAD_CLIENT_SECRET",
      "IRONCLAD_AS_USER_ID",
    ]);
    expect(
      IRONCLAD_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      IRONCLAD_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates exact-scope client credentials without resource access", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(tokenResponse());
    const result = await new IroncladApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://na1.ironcladapp.com/oauth/token",
    );
    expect(String(fetchMock.mock.calls[0][1]?.body)).toBe(
      "grant_type=client_credentials&scope=public.workflows.readSchemas",
    );
    expect(result).toMatchObject({
      credentialValid: true,
      asUserId: "5f0375c4cdc1927a3c5edcd3",
      exactScopes: ["public.workflows.readSchemas"],
      refreshTokensIssued: false,
      writesEnabled: false,
    });
  });

  it("lists only bounded schema IDs and names", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "template-1",
              name: "NDA",
              schema: { counterparty: { value: "private" } },
              approvals: [{ email: "private@example.com" }],
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new IroncladApiAdapter().listWorkflowSchemas(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://na1.ironcladapp.com/public/api/v1/workflow-schemas?form=launch",
    );
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer short-lived-token",
      "x-as-user-id": "5f0375c4cdc1927a3c5edcd3",
    });
    expect(result.schemas).toEqual([{ templateId: "template-1", name: "NDA" }]);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("counterparty");
  });

  it("rejects any extra or missing granted scope", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token",
            scope: "public.workflows.readSchemas public.records.readRecords",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new IroncladApiAdapter().health(credentials),
    ).rejects.toBeInstanceOf(IroncladApiError);
  });

  it("rejects invalid environments, user IDs, and limits before resource fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new IroncladApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://evil.example" }),
    ).rejects.toBeInstanceOf(IroncladApiError);
    await expect(
      adapter.health({ ...credentials, asUserId: "../admin" }),
    ).rejects.toBeInstanceOf(IroncladApiError);
    await expect(
      adapter.listWorkflowSchemas(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(IroncladApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
