import { VitallyApiAdapter, VitallyApiError } from "./vitally-api.adapter";
import { VITALLY_CONNECTOR_MANIFEST } from "./vitally.connector";

const credentials = {
  apiKey: "rest-key",
  apiOrigin: "https://example.rest.vitally.io",
};

describe("Vitally connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated trait-schema read", () => {
    expect(VITALLY_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      VITALLY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["vitally_custom_traits_list"]);
  });

  it("checks credentials without returning trait data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: "private-trait" }]), {
          status: 200,
        }),
      );
    const result = await new VitallyApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactEnvironmentBound: true,
      traitDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-trait");
  });

  it("lists only bounded projected custom-trait schemas", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "trait-1",
            label: "Lifecycle stage",
            path: "vitally.custom.lifecycleStage",
            type: "string",
            createdAt: "2026-01-01T00:00:00Z",
            options: [{ label: "Private", value: "private-value" }],
            value: "private-customer-value",
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await new VitallyApiAdapter().listCustomTraits(credentials, {
      model: "accounts",
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.rest.vitally.io/resources/customFields?model=accounts",
    );
    expect(result.traits).toEqual([
      {
        traitId: "trait-1",
        label: "Lifecycle stage",
        path: "vitally.custom.lifecycleStage",
        type: "string",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-value|private-customer-value/,
    );
  });

  it("rejects missing keys, unsafe origins, custom objects, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new VitallyApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toBeInstanceOf(VitallyApiError);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.test" }),
    ).rejects.toBeInstanceOf(VitallyApiError);
    await expect(
      adapter.listCustomTraits(credentials, { model: "customObjects" }),
    ).rejects.toBeInstanceOf(VitallyApiError);
    await expect(
      adapter.listCustomTraits(credentials, { model: "accounts", limit: 101 }),
    ).rejects.toBeInstanceOf(VitallyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new VitallyApiAdapter().listCustomTraits(credentials, {
        model: "accounts",
      }),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
