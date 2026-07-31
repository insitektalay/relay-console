import {
  AutoRenewStatus,
  Environment,
  NotificationTypeV2,
  Status,
  Subtype,
} from "@apple/app-store-server-library";
import { AppleBillingService } from "./apple-billing.service";

const workspaceId = "35d15f03-e096-41f0-9f7f-384d6be35fa7";
const otherWorkspaceId = "3f1b29a1-dd25-4e01-9c2a-f5fd0a93dd9c";

function memoryRepository(initial: any[] = []) {
  const rows = initial.map((row, index) => ({
    id: row.id || `row-${index + 1}`,
    ...row,
  }));
  return {
    findOne: jest.fn(
      async ({ where }: any) =>
        rows.find((row) =>
          Object.entries(where || {}).every(
            ([key, expected]) => row[key] === expected,
          ),
        ) || null,
    ),
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (input) => {
      if (!input.id) input.id = `row-${rows.length + 1}`;
      const index = rows.findIndex((row) => row.id === input.id);
      if (index >= 0) rows[index] = input;
      else rows.push(input);
      return input;
    }),
    query: jest.fn(async (sql: string, params: any[]) => {
      const [
        providerEventId,
        eventType,
        liveMode,
        payloadHash,
        claimToken,
        leaseSeconds,
      ] = params;
      const provider = sql.includes("'apple'") ? "apple" : "stripe";
      let row = rows.find(
        (candidate) =>
          candidate.provider === provider &&
          candidate.providerEventId === providerEventId,
      );
      const immutableMatch =
        row &&
        row.eventType === eventType &&
        row.liveMode === liveMode &&
        row.payloadHash === payloadHash;
      const stale =
        row?.status === "processing" &&
        row.claimExpiresAt instanceof Date &&
        row.claimExpiresAt.getTime() <= Date.now();
      if (!row || (immutableMatch && (row.status === "failed" || stale))) {
        if (!row) {
          row = {
            id: `row-${rows.length + 1}`,
            provider,
            providerEventId,
            createdAt: new Date(),
            attemptCount: 0,
          };
          rows.push(row);
        }
        Object.assign(row, {
          eventType,
          liveMode,
          payloadHash,
          status: "processing",
          safeErrorCode: null,
          processedAt: null,
          claimToken,
          claimExpiresAt: new Date(Date.now() + leaseSeconds * 1000),
          attemptCount: (row.attemptCount || 0) + 1,
        });
        return [{ id: row.id, claimToken }];
      }
      return [];
    }),
    update: jest.fn(async (criteria: any, patch: any) => {
      const row = rows.find((candidate) =>
        Object.entries(criteria || {}).every(
          ([key, expected]) => candidate[key] === expected,
        ),
      );
      if (!row) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    }),
    rows,
  } as any;
}

describe("AppleBillingService", () => {
  const configValues: Record<string, string> = {
    RELAY_APPLE_BILLING_ENABLED: "true",
    APPLE_RELAY_CLOUD_PRODUCT_ID: "com.relayconsole.cloud.monthly",
    APPLE_BUNDLE_ID: "com.clawchat.app",
    APPLE_APP_ID: "1234567890",
    APPLE_ROOT_CA_BASE64_JSON: '["Y2VydGlmaWNhdGU="]',
    RELAY_APPLE_ALLOW_SANDBOX: "true",
  };

  function transaction(overrides: Record<string, unknown> = {}) {
    return {
      transactionId: "transaction-1",
      originalTransactionId: "original-1",
      productId: "com.relayconsole.cloud.monthly",
      bundleId: "com.clawchat.app",
      appAccountToken: workspaceId,
      environment: Environment.PRODUCTION,
      expiresDate: Date.now() + 30 * 86_400_000,
      ...overrides,
    } as any;
  }

  function build(initialSubscriptions: any[] = []) {
    const subscriptions = memoryRepository(initialSubscriptions);
    const events = memoryRepository();
    const membership = {
      ensureWorkspaceAdminAccess: jest.fn(async () => ({ role: "owner" })),
    } as any;
    const audit = { record: jest.fn(async () => undefined) } as any;
    const cloud = {
      entitlements: jest.fn(
        async (_userId: string, requestedWorkspaceId: string) => ({
          payload: {
            workspaceId: requestedWorkspaceId,
            status: "active",
            mode: "read_write",
          },
          signature: "relay-signature",
        }),
      ),
    } as any;
    const config = { get: jest.fn((key: string) => configValues[key]) } as any;
    const service = new AppleBillingService(
      config,
      membership,
      audit,
      cloud,
      subscriptions,
      events,
    );
    return { service, subscriptions, events, membership, audit, cloud };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    configValues.RELAY_APPLE_BILLING_ENABLED = "true";
  });

  it("binds a verified purchase to its workspace and activates Relay Cloud", async () => {
    const { service, subscriptions, events, membership, audit, cloud } =
      build();
    jest
      .spyOn(service as any, "verifyAnyTransaction")
      .mockResolvedValue(transaction());

    await expect(
      service.submitTransaction("user-1", workspaceId, "signed-transaction"),
    ).resolves.toMatchObject({ payload: { workspaceId, status: "active" } });

    expect(membership.ensureWorkspaceAdminAccess).toHaveBeenCalledWith(
      workspaceId,
      "user-1",
    );
    expect(subscriptions.rows[0]).toMatchObject({
      workspaceId,
      provider: "apple",
      providerSubscriptionId: "original-1",
      plan: "relay_connect_monthly",
      status: "active",
    });
    expect(events.rows[0]).toMatchObject({
      provider: "apple",
      providerEventId: "transaction:transaction-1",
      status: "processed",
    });
    expect(events.rows[0].payloadHash).not.toContain("signed-transaction");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing.apple.transaction.verified",
        workspaceId,
      }),
    );
    expect(cloud.entitlements).toHaveBeenCalledWith("user-1", workspaceId);
  });

  it("rejects a purchase whose app account token names another workspace", async () => {
    const { service } = build();
    jest
      .spyOn(service as any, "verifyAnyTransaction")
      .mockResolvedValue(transaction({ appAccountToken: otherWorkspaceId }));
    await expect(
      service.submitTransaction("user-1", workspaceId, "signed-transaction"),
    ).rejects.toThrow("APPLE_APP_ACCOUNT_TOKEN_MISMATCH");
  });

  it("rejects the wrong App Store product or bundle", async () => {
    const wrongProduct = build();
    jest
      .spyOn(wrongProduct.service as any, "verifyAnyTransaction")
      .mockResolvedValue(transaction({ productId: "com.example.wrong" }));
    await expect(
      wrongProduct.service.submitTransaction(
        "user-1",
        workspaceId,
        "signed-transaction",
      ),
    ).rejects.toThrow("APPLE_PRODUCT_ID_MISMATCH");

    const wrongBundle = build();
    jest
      .spyOn(wrongBundle.service as any, "verifyAnyTransaction")
      .mockResolvedValue(transaction({ bundleId: "com.example.wrong" }));
    await expect(
      wrongBundle.service.submitTransaction(
        "user-1",
        workspaceId,
        "signed-transaction",
      ),
    ).rejects.toThrow("APPLE_BUNDLE_ID_MISMATCH");
  });

  it("rejects an App Store free-trial transaction", async () => {
    const { service } = build();
    jest
      .spyOn(service as any, "verifyAnyTransaction")
      .mockResolvedValue(
        transaction({ offerDiscountType: "FREE_TRIAL" }),
      );
    await expect(
      service.submitTransaction("user-1", workspaceId, "signed-transaction"),
    ).rejects.toThrow("APPLE_FREE_TRIAL_NOT_ALLOWED");
  });

  it("prevents an Apple purchase while the workspace has another billing provider", async () => {
    const { service } = build([
      {
        workspaceId,
        provider: "stripe",
        status: "active",
      },
    ]);
    jest
      .spyOn(service as any, "verifyAnyTransaction")
      .mockResolvedValue(transaction());
    await expect(
      service.submitTransaction("user-1", workspaceId, "signed-transaction"),
    ).rejects.toThrow("RELAY_CLOUD_SUBSCRIPTION_PROVIDER_CONFLICT");
  });

  it("reconciles and deduplicates a verified renewal notification", async () => {
    const { service, subscriptions, events, audit } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "past_due",
      },
    ]);
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-1",
        notificationType: NotificationTypeV2.DID_RENEW,
        data: {
          signedTransactionInfo: "signed-renewal",
          status: Status.ACTIVE,
        },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () => transaction()),
      verifyAndDecodeRenewalInfo: jest.fn(),
    });

    await expect(
      service.handleNotification("signed-notification"),
    ).resolves.toMatchObject({
      received: true,
      duplicate: false,
      processed: true,
    });
    expect(subscriptions.rows[0].status).toBe("active");
    expect(events.rows[0]).toMatchObject({
      providerEventId: "notification:notification-1",
      status: "processed",
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
    await expect(
      service.handleNotification("signed-notification"),
    ).resolves.toMatchObject({
      duplicate: true,
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent Apple notification to reconcile state", async () => {
    const { service, subscriptions, events, audit } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "past_due",
      },
    ]);
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-concurrent",
        notificationType: NotificationTypeV2.DID_RENEW,
        data: {
          signedTransactionInfo: "signed-renewal",
          status: Status.ACTIVE,
        },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () => transaction()),
      verifyAndDecodeRenewalInfo: jest.fn(),
    });
    let enterSave!: () => void;
    let releaseSave!: () => void;
    const saveEntered = new Promise<void>((resolve) => {
      enterSave = resolve;
    });
    const saveRelease = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    subscriptions.save.mockImplementationOnce(async (input: any) => {
      enterSave();
      await saveRelease;
      return input;
    });

    const winner = service.handleNotification("signed-notification");
    await saveEntered;
    await expect(
      service.handleNotification("signed-notification"),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(audit.record).not.toHaveBeenCalled();

    releaseSave();
    await expect(winner).resolves.toMatchObject({
      duplicate: false,
      processed: true,
    });
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(events.rows[0]).toMatchObject({
      status: "processed",
      attemptCount: 1,
      claimToken: null,
    });
  });

  it("reclaims one failed Apple notification claim on retry", async () => {
    const { service, subscriptions, events } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "past_due",
      },
    ]);
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-retry",
        notificationType: NotificationTypeV2.DID_RENEW,
        data: {
          signedTransactionInfo: "signed-renewal",
          status: Status.ACTIVE,
        },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () => transaction()),
      verifyAndDecodeRenewalInfo: jest.fn(),
    });
    subscriptions.save.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      service.handleNotification("signed-notification"),
    ).rejects.toThrow("database unavailable");
    expect(events.rows[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      claimToken: null,
    });

    await expect(
      service.handleNotification("signed-notification"),
    ).resolves.toMatchObject({ processed: true, duplicate: false });
    expect(events.rows[0]).toMatchObject({
      status: "processed",
      attemptCount: 2,
      safeErrorCode: null,
    });
  });

  it("ignores a delayed notification older than the applied provider state", async () => {
    const newerStateAt = Date.now();
    const olderNotificationAt = newerStateAt - 60_000;
    const { service, subscriptions, events, audit } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "read_only",
        readOnlyAt: new Date(newerStateAt),
        providerStateAt: new Date(newerStateAt),
      },
    ]);
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-delayed-renewal",
        notificationType: NotificationTypeV2.DID_RENEW,
        signedDate: olderNotificationAt,
        data: {
          signedTransactionInfo: "signed-delayed-renewal",
          status: Status.ACTIVE,
        },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () =>
        transaction({
          signedDate: olderNotificationAt,
        }),
      ),
      verifyAndDecodeRenewalInfo: jest.fn(),
    });

    await expect(
      service.handleNotification("signed-delayed-notification"),
    ).resolves.toEqual({
      received: true,
      duplicate: false,
      processed: false,
      stale: true,
    });
    expect(subscriptions.rows[0].status).toBe("read_only");
    expect(subscriptions.rows[0].providerStateAt).toEqual(
      new Date(newerStateAt),
    );
    expect(events.rows[0]).toMatchObject({ status: "ignored" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing.apple.notification.stale_ignored",
        workspaceId,
        metadata: expect.objectContaining({
          notificationId: "notification-delayed-renewal",
          status: "read_only",
        }),
      }),
    );
  });

  it("maps billing grace notifications to a bounded grace period", async () => {
    const { service, subscriptions } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "active",
      },
    ]);
    const graceEnds = Date.now() + 3 * 86_400_000;
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-grace",
        notificationType: NotificationTypeV2.DID_FAIL_TO_RENEW,
        subtype: Subtype.GRACE_PERIOD,
        data: {
          signedTransactionInfo: "signed-grace-transaction",
          signedRenewalInfo: "signed-grace-renewal",
          status: Status.BILLING_GRACE_PERIOD,
        },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () => transaction()),
      verifyAndDecodeRenewalInfo: jest.fn(async () => ({
        originalTransactionId: "original-1",
        appAccountToken: workspaceId,
        autoRenewStatus: AutoRenewStatus.ON,
        gracePeriodExpiresDate: graceEnds,
      })),
    });

    await service.handleNotification("signed-grace-notification");
    expect(subscriptions.rows[0].status).toBe("grace");
    expect(subscriptions.rows[0].graceEndsAt).toEqual(new Date(graceEnds));
    expect(subscriptions.rows[0].readOnlyAt).toEqual(new Date(graceEnds));
    expect(subscriptions.rows[0].cancelAtPeriodEnd).toBe(false);
  });

  it("moves a refunded subscription immediately into read-only mode", async () => {
    const { service, subscriptions } = build([
      {
        workspaceId,
        provider: "apple",
        providerSubscriptionId: "original-1",
        status: "active",
      },
    ]);
    jest.spyOn(service as any, "verifyAnyNotification").mockResolvedValue({
      environment: Environment.PRODUCTION,
      notification: {
        notificationUUID: "notification-refund",
        notificationType: NotificationTypeV2.REFUND,
        data: { signedTransactionInfo: "signed-refund" },
      },
    });
    jest.spyOn(service as any, "verifier").mockReturnValue({
      verifyAndDecodeTransaction: jest.fn(async () =>
        transaction({ revocationDate: Date.now() }),
      ),
      verifyAndDecodeRenewalInfo: jest.fn(),
    });

    await service.handleNotification("signed-refund-notification");
    expect(subscriptions.rows[0].status).toBe("read_only");
    expect(subscriptions.rows[0].readOnlyAt).toBeInstanceOf(Date);
    expect(subscriptions.rows[0].deletionEligibleAt).toBeInstanceOf(Date);
  });

  it("fails closed when verification fails or Apple billing is disabled", async () => {
    const verificationFailure = build();
    await expect(
      verificationFailure.service.submitTransaction(
        "user-1",
        workspaceId,
        "unsigned",
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "APPLE_TRANSACTION_VERIFICATION_FAILED",
      }),
    });

    configValues.RELAY_APPLE_BILLING_ENABLED = "false";
    const disabled = build();
    await expect(
      disabled.service.submitTransaction(
        "user-1",
        workspaceId,
        "signed-transaction",
      ),
    ).rejects.toThrow("RELAY_APPLE_BILLING_NOT_ENABLED");
  });
});
