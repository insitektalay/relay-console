import {
  LinkSquaresApiAdapter,
  LinkSquaresApiError,
} from "./linksquares-api.adapter";
import { LINKSQUARES_CONNECTOR_MANIFEST } from "./linksquares.connector";

const credentials = { apiKey: "customer-linksquares-key" };

describe("LinkSquares connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the broad administrator key on one fixed read-only surface", () => {
    expect(
      LINKSQUARES_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["LINKSQUARES_API_KEY"]);
    expect(
      LINKSQUARES_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      LINKSQUARES_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates Analyze health without returning user identity", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            whoami: "private@example.com",
            status: "up",
            timestamp: "2026-07-17",
          }),
          { status: 200 },
        ),
      );
    const result = await new LinkSquaresApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.linksquares.com/api/analyze/v1/me",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-api-key": "customer-linksquares-key",
    });
    expect(result).toMatchObject({
      credentialValid: true,
      providerStatus: "up",
      broadAdministratorKey: true,
      userIdentityReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("lists only bounded agreement-type IDs and names", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "254f12b8-febf-11ec-b879-4f58a7c16e8e",
              name: "Amendment",
              private: { agreementCount: 42 },
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new LinkSquaresApiAdapter().listAgreementTypes(
      credentials,
      { limit: 1 },
    );
    expect(result.agreementTypes).toEqual([
      {
        agreementTypeId: "254f12b8-febf-11ec-b879-4f58a7c16e8e",
        name: "Amendment",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("agreementCount");
  });

  it("rejects missing keys and invalid limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new LinkSquaresApiAdapter();
    await expect(adapter.health({ apiKey: "" })).rejects.toBeInstanceOf(
      LinkSquaresApiError,
    );
    await expect(
      adapter.listAgreementTypes(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(LinkSquaresApiError);
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
      new LinkSquaresApiAdapter().listAgreementTypes(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
