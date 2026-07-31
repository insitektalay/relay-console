import { BillingObservabilityService } from "./billing-observability.service";

describe("BillingObservabilityService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-14T20:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("aggregates billing, churn, webhook, and entitlement signals without customer identifiers", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          provider: "stripe",
          plan: "relay_cloud_monthly",
          status: "active",
          count: "4",
          workspaceId: "workspace-secret",
          providerCustomerId: "cus_secret",
          providerSubscriptionId: "sub_secret",
          payloadHash: "payload-secret",
          email: "customer@example.com",
        },
        {
          provider: "apple",
          plan: "relay_cloud_monthly",
          status: "grace",
          count: "2",
        },
        {
          provider: "stripe",
          plan: "relay_cloud_monthly",
          status: "cancelled",
          count: "1",
        },
      ])
      .mockResolvedValueOnce([
        {
          totalCount: "7",
          activePaidCount: "4",
          scheduledCancellationCount: "1",
          createdInWindowCount: "2",
          cancelledInWindowCount: "1",
          migrationGraceCount: "2",
          migrationGraceExpiringCount: "1",
          migrationGraceExpiredCount: "0",
        },
      ])
      .mockResolvedValueOnce([
        { code: "GRACE_MISSING_DEADLINE", count: "2" },
        { code: "ACTIVE_HAS_READ_ONLY_TIMESTAMP", count: "1" },
      ])
      .mockResolvedValueOnce([
        {
          provider: "stripe",
          status: "failed",
          eventType: "invoice.payment_failed",
          safeErrorCode: "STRIPE_WEBHOOK_PROCESSING_FAILED",
          count: "2",
        },
        {
          provider: "apple",
          status: "processed",
          eventType: "DID_FAIL_TO_RENEW.BILLING_RETRY",
          safeErrorCode: null,
          count: "1",
        },
      ])
      .mockResolvedValueOnce([
        {
          eventsInWindowCount: "12",
          failedInWindowCount: "2",
          staleProcessingCount: "1",
        },
      ]);
    const dataSource = { query } as any;
    const config = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              RELAY_BILLING_MONITOR_WINDOW_HOURS: "24",
              RELAY_BILLING_STALE_EVENT_MINUTES: "10",
            }) as Record<string, string>
          )[key],
      ),
    } as any;

    const result = await new BillingObservabilityService(
      dataSource,
      config,
    ).snapshot();

    expect(result).toMatchObject({
      schemaVersion: "relay.billing-observability.v1",
      generatedAt: "2026-07-14T20:00:00.000Z",
      status: "attention",
      subscriptions: {
        total: 7,
        activePaid: 4,
        scheduledCancellation: 1,
        createdInWindow: 2,
        cancelledInWindow: 1,
        migrationGrace: 2,
        migrationGraceExpiring: 1,
        migrationGraceExpired: 0,
        byProvider: { apple: 2, stripe: 5 },
        byStatus: { active: 4, cancelled: 1, grace: 2 },
      },
      billingEvents: {
        inWindow: 12,
        failedInWindow: 2,
        staleProcessing: 1,
        paymentAttention: 3,
        failedSafeCodes: { STRIPE_WEBHOOK_PROCESSING_FAILED: 2 },
      },
      entitlementConsistency: {
        mismatchCount: 3,
        byCode: {
          ACTIVE_HAS_READ_ONLY_TIMESTAMP: 1,
          GRACE_MISSING_DEADLINE: 2,
        },
      },
      revenue: {
        sourceOfTruth: "billing_provider",
        activePaidSubscriptions: 4,
        currencyAmountsIncluded: false,
      },
      alerts: [
        "BILLING_EVENT_FAILURES",
        "BILLING_EVENT_STUCK",
        "PAYMENT_ATTENTION_REQUIRED",
        "ENTITLEMENT_MISMATCHES",
        "MIGRATION_GRACE_EXPIRING",
      ],
    });
    expect(result.privacy).toEqual({
      workspaceIdsIncluded: false,
      customerIdentifiersIncluded: false,
      providerSubscriptionIdentifiersIncluded: false,
      emailsIncluded: false,
      payloadHashesIncluded: false,
      customerContentIncluded: false,
      secretValuesIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /workspace-secret|cus_secret|sub_secret|payload-secret|customer@example\.com/i,
    );
    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls[1][1]).toEqual([
      new Date("2026-07-13T20:00:00.000Z"),
      new Date("2026-07-15T20:00:00.000Z"),
    ]);
    expect(query.mock.calls[4][1]).toEqual([
      new Date("2026-07-13T20:00:00.000Z"),
      new Date("2026-07-14T20:00:00.000Z"),
      new Date("2026-07-14T19:50:00.000Z"),
    ]);
    expect(query.mock.calls[4][0]).toContain('"claimExpiresAt" < $2');
  });

  it("treats bounded migration grace as a known rollout state", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          provider: "relay_migration",
          plan: "relay_cloud_migration_grace",
          status: "grace",
          count: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          totalCount: 3,
          migrationGraceCount: 3,
          migrationGraceExpiringCount: 0,
          migrationGraceExpiredCount: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);

    const result = await new BillingObservabilityService(
      { query } as any,
      { get: jest.fn(() => undefined) } as any,
    ).snapshot();

    expect(result.status).toBe("healthy");
    expect(result.alerts).toEqual([]);
    expect(result.subscriptions).toMatchObject({
      migrationGrace: 3,
      migrationGraceExpiring: 0,
      migrationGraceExpired: 0,
      byProvider: { relay_migration: 3 },
      byPlan: { relay_cloud_migration_grace: 3 },
      byStatus: { grace: 3 },
    });
  });

  it("redacts malformed database dimensions and failure codes", async () => {
    const secret = "sk_live_do_not_expose_this_value";
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          provider: secret,
          plan: "relay_cloud_monthly",
          status: "active",
          count: 1,
        },
      ])
      .mockResolvedValueOnce([{ totalCount: 1, activePaidCount: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          provider: secret,
          status: "failed",
          eventType: "invoice.payment_failed",
          safeErrorCode: "customer@example.com",
          count: 1,
        },
      ])
      .mockResolvedValueOnce([
        { eventsInWindowCount: 1, failedInWindowCount: 1 },
      ]);

    const result = await new BillingObservabilityService(
      { query } as any,
      { get: jest.fn(() => undefined) } as any,
    ).snapshot();
    const serialized = JSON.stringify(result);

    expect(result.subscriptions.byProvider).toEqual({ unknown: 1 });
    expect(result.billingEvents.failedSafeCodes).toEqual({
      UNKNOWN_SAFE_CODE: 1,
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("customer@example.com");
  });

  it("reports a healthy empty launch ledger and bounds unsafe configuration", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);
    const config = {
      get: jest.fn((key: string) =>
        key === "RELAY_BILLING_MONITOR_WINDOW_HOURS" ? "100000" : "0",
      ),
    } as any;

    const result = await new BillingObservabilityService(
      { query } as any,
      config,
    ).snapshot();

    expect(result.status).toBe("healthy");
    expect(result.alerts).toEqual([]);
    expect(result.window).toMatchObject({
      hours: 24,
      staleProcessingMinutes: 10,
    });
    expect(result.subscriptions.total).toBe(0);
    expect(result.entitlementConsistency.mismatchCount).toBe(0);
  });
});
