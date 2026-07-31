import {
  StatsigApiAdapter,
  type StatsigCredentials,
} from "./statsig-api.adapter";
import { STATSIG_OPERATIONS } from "./statsig-operation-registry";

describe("StatsigApiAdapter", () => {
  const credentials: StatsigCredentials = {
    personalConsoleApiKey: "console-test-key",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins six read-only gate, dynamic-config, and experiment operations", () => {
    expect(STATSIG_OPERATIONS).toHaveLength(6);
    expect(
      STATSIG_OPERATIONS.every((operation) =>
        operation.path.startsWith("/console/v1/"),
      ),
    ).toBe(true);
  });

  it("uses fixed bounded gate routing and the pinned API version", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "gate_1",
              name: "Checkout Gate",
              rules: [
                {
                  name: "Private targeting",
                  passPercentage: 20,
                  conditions: [{ targetValue: ["user@example.com"] }],
                  returnValue: { private: true },
                },
              ],
              creatorEmail: "owner@example.com",
            },
          ],
          pagination: { pageNumber: 1, nextPage: "secret-cursor" },
        }),
      ),
    );
    const result = await new StatsigApiAdapter().read(
      credentials,
      "list_gates",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://statsigapi.net/console/v1/gates?limit=25&page=1&includeArchived=false",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "STATSIG-API-KEY": "console-test-key",
      "STATSIG-API-VERSION": "20240601",
    });
    expect(JSON.stringify(result)).not.toContain("user@example.com");
    expect(JSON.stringify(result)).not.toContain("secret-cursor");
    expect(result.pagination.hasNextPage).toBe(true);
  });

  it("uses sparse exact experiment reads and strips parameter values", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: "experiment_1",
            groups: [
              {
                id: "control",
                name: "Control",
                size: 50,
                parameterValues: { secret: 1 },
              },
            ],
          },
        }),
      ),
    );
    const result = await new StatsigApiAdapter().read(
      credentials,
      "get_experiment",
      { resourceId: "experiment_1" },
    );
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(
      "https://statsigapi.net/console/v1/experiments/experiment_1?fields=",
    );
    expect(JSON.stringify(result)).not.toContain("parameterValues");
  });

  it("blocks pagination, targeting, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new StatsigApiAdapter();
    await expect(
      adapter.read(credentials, "list_gates", { page: 2 } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_gate", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_gate", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
