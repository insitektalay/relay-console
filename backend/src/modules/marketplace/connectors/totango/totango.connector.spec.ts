import { TotangoApiAdapter, TotangoApiError } from "./totango-api.adapter";
import { TOTANGO_CONNECTOR_MANIFEST } from "./totango.connector";

const credentials = { appToken: "app-token", region: "us" };

describe("Totango connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated flow inventory read", () => {
    expect(TOTANGO_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      TOTANGO_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["totango_flows_list"]);
  });

  it("checks credentials without returning flow data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ renewal: { display_name: "Private flow" } }),
          { status: 200 },
        ),
      );
    const result = await new TotangoApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactRegionBound: true,
      region: "us",
      flowDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private flow");
  });

  it("lists only bounded projected flow metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          renewal: {
            activity_type_id: "renewal",
            display_name: "Renewal",
            num_of_activities_assign_to: 42,
            icon_class: "private-icon",
            system_type: true,
            default_type: false,
            disabled: false,
          },
        }),
        { status: 200 },
      ),
    );
    const result = await new TotangoApiAdapter().listFlows(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.totango.com/api/v3/activity-types/",
    );
    expect(result.flows).toEqual([
      {
        activityTypeId: "renewal",
        displayName: "Renewal",
        systemType: true,
        defaultType: false,
        disabled: false,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/42|private-icon|icon_class/);
  });

  it("rejects missing tokens, unsafe regions, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new TotangoApiAdapter();
    await expect(
      adapter.health({ ...credentials, appToken: "" }),
    ).rejects.toBeInstanceOf(TotangoApiError);
    await expect(
      adapter.health({ ...credentials, region: "custom" }),
    ).rejects.toBeInstanceOf(TotangoApiError);
    await expect(
      adapter.listFlows(credentials, { limit: 31 }),
    ).rejects.toBeInstanceOf(TotangoApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new TotangoApiAdapter().listFlows(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
