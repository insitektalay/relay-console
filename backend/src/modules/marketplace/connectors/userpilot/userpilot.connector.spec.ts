import {
  UserpilotApiAdapter,
  UserpilotApiError,
} from "./userpilot-api.adapter";
import { USERPILOT_CONNECTOR_MANIFEST } from "./userpilot.connector";

const credentials = {
  apiKey: "environment-key",
  apiOrigin: "https://appex.userpilot.io",
};

describe("Userpilot connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated definition inventory read", () => {
    expect(
      USERPILOT_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      USERPILOT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["userpilot_feature_event_definitions_list"]);
  });

  it("checks credentials without returning definition data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ key: "private-key" }]), { status: 200 }),
      );
    const result = await new UserpilotApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactEnvironmentBound: true,
      definitionDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-key");
  });

  it("lists only bounded projected feature/event definitions", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            key: "feature_a",
            display_name: "Feature A",
            data_type: "string",
            user_id: "private-user",
            metadata: { email: "private@example.test" },
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await new UserpilotApiAdapter().listDefinitions(
      credentials,
      {
        limit: 1,
      },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://appex.userpilot.io/api/v1/analytics/exports/lookups/features_events",
    );
    expect(result.definitions).toEqual([
      { key: "feature_a", displayName: "Feature A", dataType: "string" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private-user|private@example/);
  });

  it("rejects missing keys, non-Userpilot origins, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new UserpilotApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toBeInstanceOf(UserpilotApiError);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.test" }),
    ).rejects.toBeInstanceOf(UserpilotApiError);
    await expect(
      adapter.listDefinitions(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(UserpilotApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new UserpilotApiAdapter().listDefinitions(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
