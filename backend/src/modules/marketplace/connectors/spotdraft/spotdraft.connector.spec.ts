import {
  SpotDraftApiAdapter,
  SpotDraftApiError,
} from "./spotdraft-api.adapter";
import { SPOTDRAFT_CONNECTOR_MANIFEST } from "./spotdraft.connector";

const credentials = {
  clientId: "customer-spotdraft-client",
  clientSecret: "customer-spotdraft-secret",
};

describe("SpotDraft connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps customer client credentials on one fixed read-only surface", () => {
    expect(
      SPOTDRAFT_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["SPOTDRAFT_CLIENT_ID", "SPOTDRAFT_CLIENT_SECRET"]);
    expect(SPOTDRAFT_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      SPOTDRAFT_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates credentials through the fixed role list without returning data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: "role-private", name: "Legal", members: ["a@b.test"] }],
          }),
          { status: 200 },
        ),
      );
    const result = await new SpotDraftApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.spotdraft.com/v2.1/public/auth/roles/list",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from(
        "customer-spotdraft-client:customer-spotdraft-secret",
      ).toString("base64")}`,
    });
    expect(result).toMatchObject({
      clientCredentialsVerified: true,
      userDataReturned: false,
      contractDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("a@b.test");
  });

  it("lists only bounded team-role IDs and names", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "role-1",
                name: "Legal",
                members: [{ email: "private@example.com" }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new SpotDraftApiAdapter().listRoles(credentials, {
      limit: 1,
    });
    expect(result.roles).toEqual([{ roleId: "role-1", name: "Legal" }]);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects missing credentials and invalid limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SpotDraftApiAdapter();
    await expect(
      adapter.health({ clientId: "", clientSecret: "" }),
    ).rejects.toBeInstanceOf(SpotDraftApiError);
    await expect(
      adapter.listRoles(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(SpotDraftApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Rate exceeded" }), {
          status: 429,
        }),
      );
    await expect(
      new SpotDraftApiAdapter().listRoles(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
