import { OperationsObservabilityService } from "./operations-observability.service";

describe("OperationsObservabilityService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-15T04:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("aggregates bridge, runtime, and OAuth failures without identifiers or content", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          totalCount: "4",
          activeCount: "3",
          revokedCount: "1",
          recentCount: "1",
          staleCount: "1",
          neverSeenCount: "1",
          devicePublicId: "bridge-secret",
        },
      ])
      .mockResolvedValueOnce([
        {
          inWindowCount: "7",
          failedInWindowCount: "2",
          retryingInWindowCount: "1",
          stalePendingCount: "1",
          payload: { token: "secret" },
        },
      ])
      .mockResolvedValueOnce([
        {
          totalCount: "3",
          enabledCount: "3",
          healthyCount: "2",
          unhealthyCount: "1",
        },
      ])
      .mockResolvedValueOnce([
        {
          inWindowCount: "10",
          failedInWindowCount: "2",
          staleActiveCount: "1",
          errorMessage: "customer content",
        },
      ])
      .mockResolvedValueOnce([
        {
          deniedInWindowCount: "4",
          refreshFailedInWindowCount: "1",
          workspaceId: "workspace-secret",
        },
      ])
      .mockResolvedValueOnce([
        {
          totalCount: "8",
          readyCount: "5",
          errorCount: "2",
          needsCredentialsCount: "1",
          providerConnectionId: "provider-secret",
        },
      ]);
    const config = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              RELAY_OPERATIONS_MONITOR_WINDOW_HOURS: "24",
              RELAY_BRIDGE_RECENT_MINUTES: "5",
              RELAY_OPERATIONS_STALE_EVENT_MINUTES: "15",
            }) as Record<string, string>
          )[key],
      ),
    } as any;

    const result = await new OperationsObservabilityService(
      { query } as any,
      config,
    ).snapshot();

    expect(result).toMatchObject({
      schemaVersion: "relay.operations-observability.v1",
      generatedAt: "2026-07-15T04:00:00.000Z",
      status: "attention",
      bridge: {
        devices: {
          totalCount: 4,
          activeCount: 3,
          revokedCount: 1,
          recentCount: 1,
          staleCount: 1,
          neverSeenCount: 1,
        },
        events: {
          inWindowCount: 7,
          failedInWindowCount: 2,
          retryingInWindowCount: 1,
          stalePendingCount: 1,
        },
        offlineDevicesAreCustomerAvailabilitySignals: true,
      },
      runtimes: {
        bindings: {
          totalCount: 3,
          enabledCount: 3,
          healthyCount: 2,
          unhealthyCount: 1,
        },
        dispatches: {
          inWindowCount: 10,
          failedInWindowCount: 2,
          staleActiveCount: 1,
        },
      },
      marketplace: {
        oauth: { deniedInWindowCount: 4, refreshFailedInWindowCount: 1 },
        connections: {
          totalCount: 8,
          readyCount: 5,
          errorCount: 2,
          needsCredentialsCount: 1,
        },
        deniedConsentIsNotAnOperationalAlert: true,
      },
      alerts: [
        "BRIDGE_EVENT_FAILURES",
        "BRIDGE_EVENTS_STUCK",
        "RUNTIME_DISPATCHES_STUCK",
        "OAUTH_REFRESH_FAILURES",
      ],
    });
    expect(query).toHaveBeenCalledTimes(6);
    expect(query.mock.calls[0][1]).toEqual([
      new Date("2026-07-15T03:55:00.000Z"),
    ]);
    expect(query.mock.calls[1][1]).toEqual([
      new Date("2026-07-14T04:00:00.000Z"),
      new Date("2026-07-15T03:45:00.000Z"),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /bridge-secret|workspace-secret|provider-secret|customer content|token/i,
    );
  });

  it("reports a healthy empty system and bounds unsafe configuration", async () => {
    const query = jest.fn().mockResolvedValue([{}]);
    const config = {
      get: jest.fn((key: string) =>
        key === "RELAY_OPERATIONS_MONITOR_WINDOW_HOURS" ? "100000" : "0",
      ),
    } as any;

    const result = await new OperationsObservabilityService(
      { query } as any,
      config,
    ).snapshot();

    expect(result.status).toBe("healthy");
    expect(result.alerts).toEqual([]);
    expect(result.window).toMatchObject({
      hours: 24,
      bridgeRecentMinutes: 5,
      staleEventMinutes: 15,
    });
    expect(result.privacy).toEqual({
      workspaceIdsIncluded: false,
      customerIdentifiersIncluded: false,
      deviceIdentifiersIncluded: false,
      providerConnectionIdentifiersIncluded: false,
      eventPayloadsIncluded: false,
      errorMessagesIncluded: false,
      customerContentIncluded: false,
      secretValuesIncluded: false,
    });
  });
});
