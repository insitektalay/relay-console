import { createHash, createHmac } from "crypto";
import { StripeBillingService } from "./stripe-billing.service";

function singleRepository(initial: any = null) {
  let value = initial;
  return {
    findOne: jest.fn(async ({ where }: any) => {
      if (!value) return null;
      return Object.entries(where || {}).every(
        ([key, expected]) => value[key] === expected,
      )
        ? value
        : null;
    }),
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (input) => {
      value = { id: value?.id || "row-1", ...input };
      return value;
    }),
    current: () => value,
  } as any;
}

function billingEventRepository(initial: any = null) {
  let value = initial;
  const repository = {
    findOne: jest.fn(async ({ where }: any) => {
      if (!value) return null;
      return Object.entries(where || {}).every(
        ([key, expected]) => value[key] === expected,
      )
        ? value
        : null;
    }),
    query: jest.fn(async (_sql: string, params: any[]) => {
      const [
        providerEventId,
        eventType,
        liveMode,
        payloadHash,
        claimToken,
        leaseSeconds,
      ] = params;
      const immutableMatch =
        value &&
        value.provider === "stripe" &&
        value.providerEventId === providerEventId &&
        value.eventType === eventType &&
        value.liveMode === liveMode &&
        value.payloadHash === payloadHash;
      const stale =
        value?.status === "processing" &&
        value.claimExpiresAt instanceof Date &&
        value.claimExpiresAt.getTime() <= Date.now();
      if (!value || (immutableMatch && (value.status === "failed" || stale))) {
        value = {
          ...(value || {}),
          id: value?.id || "event-row-1",
          provider: "stripe",
          providerEventId,
          eventType,
          liveMode,
          payloadHash,
          status: "processing",
          safeErrorCode: null,
          processedAt: null,
          claimToken,
          claimExpiresAt: new Date(Date.now() + leaseSeconds * 1000),
          attemptCount: (value?.attemptCount || 0) + 1,
          createdAt: value?.createdAt || new Date(),
        };
        return [{ id: value.id, claimToken }];
      }
      return [];
    }),
    update: jest.fn(async (criteria: any, patch: any) => {
      if (
        !value ||
        !Object.entries(criteria || {}).every(
          ([key, expected]) => value[key] === expected,
        )
      ) {
        return { affected: 0 };
      }
      value = { ...value, ...patch };
      return { affected: 1 };
    }),
    current: () => value,
    set: (next: any) => {
      value = next;
    },
  };
  return repository as any;
}

describe("StripeBillingService", () => {
  const webhookSecret = "whsec_test_relay_console";
  const configValues: Record<string, string> = {
    RELAY_BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_relay_console",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_RELAY_CLOUD_PRICE_ID: "price_relay_cloud_monthly",
    STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID: "price_relay_managed_cloud_monthly",
    RELAY_MANAGED_CLOUD_ENABLED: "true",
    RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
    RELAY_CLOUD_TRIAL_DAYS: "99",
  };

  function signedWebhook(event: Record<string, unknown>) {
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");
    return { raw, header: `t=${timestamp},v1=${signature}` };
  }

  function build(subscription: any = null) {
    const subscriptions = singleRepository(subscription);
    const events = billingEventRepository();
    const users = singleRepository({
      id: "user-1",
      email: "person@example.com",
      emailVerifiedAt: new Date(),
    });
    const membership = {
      ensureWorkspaceAdminAccess: jest.fn(async () => ({ role: "owner" })),
    } as any;
    const audit = { record: jest.fn(async () => undefined) } as any;
    const config = { get: jest.fn((key: string) => configValues[key]) } as any;
    return {
      service: new StripeBillingService(
        config,
        membership,
        audit,
        users,
        subscriptions,
        events,
      ),
      subscriptions,
      events,
      membership,
      audit,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a hosted monthly Checkout Session with tax and workspace binding", async () => {
    const { service } = build();
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      }),
    } as Response);

    const result = await service.createCheckout("user-1", "workspace-1");
    expect(result).toMatchObject({
      provider: "stripe",
      sessionId: "cs_test_1",
    });
    const [, request] = fetchMock.mock.calls[0];
    const form = request?.body as URLSearchParams;
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price]")).toBe("price_relay_cloud_monthly");
    expect(form.get("metadata[workspaceId]")).toBe("workspace-1");
    expect(form.get("subscription_data[metadata][workspaceId]")).toBe(
      "workspace-1",
    );
    expect(form.get("automatic_tax[enabled]")).toBe("true");
    expect(form.get("customer_email")).toBe("person@example.com");
    expect(form.get("subscription_data[trial_period_days]")).toBeNull();
  });

  it("fails closed before managed-Cloud checkout unless the launch flag is exactly true", async () => {
    const previous = configValues.RELAY_MANAGED_CLOUD_ENABLED;
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("Stripe must not be contacted"));
    for (const value of ["false", "1", "TRUE", ""]) {
      configValues.RELAY_MANAGED_CLOUD_ENABLED = value;
      const { service, audit } = build();
      await expect(
        service.createCheckout(
          "user-1",
          "workspace-1",
          "relay_managed_cloud_monthly",
        ),
      ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
      expect(audit.record).not.toHaveBeenCalled();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    configValues.RELAY_MANAGED_CLOUD_ENABLED = previous;
  });

  it("prevents a second active subscription", async () => {
    const { service } = build({ workspaceId: "workspace-1", status: "active" });
    await expect(
      service.createCheckout("user-1", "workspace-1"),
    ).rejects.toThrow("RELAY_CLOUD_SUBSCRIPTION_ALREADY_ACTIVE");
  });

  it("requires verified email ownership before checkout", async () => {
    const { service } = build();
    (service as any).users.findOne.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      emailVerifiedAt: null,
    });
    await expect(
      service.createCheckout("user-1", "workspace-1"),
    ).rejects.toThrow("EMAIL_VERIFICATION_REQUIRED");
  });

  it("verifies webhook signatures, reconciles subscription state, and deduplicates events", async () => {
    const { service, subscriptions, events } = build();
    const event = {
      id: "evt_1",
      type: "customer.subscription.created",
      livemode: false,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          current_period_end: 1_800_000_000,
          metadata: { workspaceId: "workspace-1", userId: "user-1" },
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;

    await expect(service.handleWebhook(raw, header)).resolves.toMatchObject({
      received: true,
      processed: true,
    });
    expect(subscriptions.current()).toMatchObject({
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      plan: "relay_connect_monthly",
      status: "active",
    });
    expect(events.current()).toMatchObject({
      providerEventId: "evt_1",
      status: "processed",
    });
    await expect(service.handleWebhook(raw, header)).resolves.toMatchObject({
      duplicate: true,
    });
  });

  it("creates the managed Hermes checkout with an explicit isolated plan", async () => {
    const { service } = build();
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cs_managed",
        url: "https://checkout.stripe.com/c/pay/cs_managed",
      }),
    } as Response);

    await service.createCheckout(
      "user-1",
      "workspace-1",
      "relay_managed_cloud_monthly",
    );
    const form = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(form.get("line_items[0][price]")).toBe(
      "price_relay_managed_cloud_monthly",
    );
    expect(form.get("subscription_data[metadata][plan]")).toBe(
      "relay_managed_cloud_monthly",
    );
  });

  it("derives managed entitlement features from the authoritative Stripe price", async () => {
    const { service, subscriptions } = build();
    const event = {
      id: "evt_managed",
      type: "customer.subscription.created",
      livemode: false,
      data: {
        object: {
          id: "sub_managed",
          customer: "cus_1",
          status: "active",
          items: {
            data: [{ price: { id: "price_relay_managed_cloud_monthly" } }],
          },
          metadata: { workspaceId: "workspace-1" },
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");
    await service.handleWebhook(raw, `t=${timestamp},v1=${signature}`);
    expect(subscriptions.current()).toMatchObject({
      plan: "relay_managed_cloud_monthly",
      features: {
        cloudControlPlane: true,
        customerRuntimeHosts: true,
        managedRuntime: true,
      },
    });
    expect(
      subscriptions.current().limits.managedRuntimeMinutes,
    ).toBeGreaterThan(0);
  });

  it("supports Stripe Basil item-level billing periods and scheduled cancel dates", async () => {
    const { service, subscriptions } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "active",
    });
    const event = {
      id: "evt_basil_cancel",
      type: "customer.subscription.updated",
      livemode: false,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          cancel_at: 1_800_000_000,
          cancel_at_period_end: false,
          items: { data: [{ id: "si_1", current_period_end: 1_800_000_000 }] },
          metadata: { workspaceId: "workspace-1", userId: "user-1" },
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");

    await service.handleWebhook(raw, `t=${timestamp},v1=${signature}`);

    expect(subscriptions.current()).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEndsAt: new Date(1_800_000_000 * 1000),
    });
  });

  it("moves failed subscription payments into a bounded grace period", async () => {
    const { service, subscriptions } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "active",
    });
    const event = {
      id: "evt_failed",
      type: "invoice.payment_failed",
      livemode: false,
      data: {
        object: { id: "in_1", customer: "cus_1", subscription: "sub_1" },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");
    await service.handleWebhook(raw, `t=${timestamp},v1=${signature}`);
    expect(subscriptions.current().status).toBe("grace");
    expect(subscriptions.current().graceEndsAt).toBeInstanceOf(Date);
    expect(subscriptions.current().readOnlyAt).toEqual(
      subscriptions.current().graceEndsAt,
    );
    expect(
      subscriptions.current().graceEndsAt.getTime() - Date.now(),
    ).toBeGreaterThan(2.99 * 86_400_000);
    expect(
      subscriptions.current().graceEndsAt.getTime() - Date.now(),
    ).toBeLessThanOrEqual(3 * 86_400_000);
  });

  it("moves a fully refunded subscription into read-only access", async () => {
    const { service, subscriptions } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "active",
    });
    const event = {
      id: "evt_refund",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_1",
          customer: "cus_1",
          amount: 999,
          amount_refunded: 999,
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest("hex");
    await service.handleWebhook(raw, `t=${timestamp},v1=${signature}`);
    expect(subscriptions.current().status).toBe("read_only");
    expect(subscriptions.current().readOnlyAt).toBeInstanceOf(Date);
  });

  it("allows only one concurrent delivery to execute the business transition", async () => {
    const { service, subscriptions, events, audit } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "grace",
    });
    const event = {
      id: "evt_concurrent",
      type: "invoice.paid",
      livemode: false,
      data: {
        object: { id: "in_1", customer: "cus_1", subscription: "sub_1" },
      },
    };
    const { raw, header } = signedWebhook(event);
    let enterFirstSave!: () => void;
    let releaseFirstSave!: () => void;
    const firstSaveEntered = new Promise<void>((resolve) => {
      enterFirstSave = resolve;
    });
    const firstSaveRelease = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    subscriptions.save.mockImplementationOnce(async (input: any) => {
      enterFirstSave();
      await firstSaveRelease;
      return input;
    });

    const winner = service.handleWebhook(raw, header);
    await firstSaveEntered;
    await expect(service.handleWebhook(raw, header)).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(audit.record).not.toHaveBeenCalled();

    releaseFirstSave();
    await expect(winner).resolves.toMatchObject({
      duplicate: false,
      processed: true,
    });
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(events.current()).toMatchObject({
      status: "processed",
      attemptCount: 1,
      claimToken: null,
      claimExpiresAt: null,
    });
  });

  it("atomically reclaims one stale processing lease", async () => {
    const { service, subscriptions, events } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "grace",
    });
    const event = {
      id: "evt_stale",
      type: "invoice.paid",
      livemode: false,
      data: {
        object: { id: "in_1", customer: "cus_1", subscription: "sub_1" },
      },
    };
    const { raw, header } = signedWebhook(event);
    events.set({
      id: "event-row-1",
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      liveMode: false,
      payloadHash: createHash("sha256").update(raw).digest("hex"),
      status: "processing",
      claimToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      claimExpiresAt: new Date(Date.now() - 1_000),
      attemptCount: 1,
      createdAt: new Date(Date.now() - 20 * 60_000),
    });
    await expect(service.handleWebhook(raw, header)).resolves.toMatchObject({
      processed: true,
      duplicate: false,
    });
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(events.current()).toMatchObject({
      status: "processed",
      attemptCount: 2,
    });
  });

  it("retries a failed claim once without overlapping the failed attempt", async () => {
    const { service, subscriptions, events } = build({
      id: "subscription-row",
      workspaceId: "workspace-1",
      provider: "stripe",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      status: "grace",
    });
    const event = {
      id: "evt_retry",
      type: "invoice.paid",
      livemode: false,
      data: {
        object: { id: "in_1", customer: "cus_1", subscription: "sub_1" },
      },
    };
    const { raw, header } = signedWebhook(event);
    subscriptions.save.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(service.handleWebhook(raw, header)).rejects.toThrow(
      "database unavailable",
    );
    expect(events.current()).toMatchObject({
      status: "failed",
      attemptCount: 1,
      safeErrorCode: "database_unavailable",
      claimToken: null,
    });

    await expect(service.handleWebhook(raw, header)).resolves.toMatchObject({
      processed: true,
      duplicate: false,
    });
    expect(events.current()).toMatchObject({
      status: "processed",
      attemptCount: 2,
      safeErrorCode: null,
    });
  });

  it("rejects a signed payload mutation that reuses a provider event id", async () => {
    const { service, events } = build();
    const original = signedWebhook({
      id: "evt_mutated",
      type: "unhandled.original",
      livemode: false,
      data: { object: { id: "object-1" } },
    });
    await service.handleWebhook(original.raw, original.header);

    const mutated = signedWebhook({
      id: "evt_mutated",
      type: "unhandled.mutated",
      livemode: false,
      data: { object: { id: "object-2" } },
    });
    await expect(
      service.handleWebhook(mutated.raw, mutated.header),
    ).rejects.toThrow("STRIPE_EVENT_PAYLOAD_MISMATCH");
    expect(events.current()).toMatchObject({
      eventType: "unhandled.original",
      status: "ignored",
      attemptCount: 1,
    });
  });

  it("uses one insert-or-reclaim SQL claim before processing", async () => {
    const { service, events } = build();
    const event = signedWebhook({
      id: "evt_claim_shape",
      type: "unhandled",
      livemode: false,
      data: { object: { id: "object-1" } },
    });
    await service.handleWebhook(event.raw, event.header);

    const sql = events.query.mock.calls[0][0];
    expect(sql).toContain(
      'ON CONFLICT (provider, "providerEventId") DO NOTHING',
    );
    expect(sql).toContain("event.status = 'failed'");
    expect(sql).toContain('event."claimExpiresAt" <= NOW()');
    expect(events.findOne).not.toHaveBeenCalled();
  });

  it("rejects unsigned webhook payloads", async () => {
    const { service } = build();
    await expect(
      service.handleWebhook(Buffer.from("{}"), undefined),
    ).rejects.toThrow("STRIPE_SIGNATURE_REQUIRED");
  });

  it("fails closed when Relay billing is not enabled", async () => {
    const previous = configValues.RELAY_BILLING_ENABLED;
    configValues.RELAY_BILLING_ENABLED = "false";
    try {
      const { service } = build();
      await expect(
        service.createCheckout("user-1", "workspace-1"),
      ).rejects.toThrow("RELAY_BILLING_NOT_ENABLED");
    } finally {
      configValues.RELAY_BILLING_ENABLED = previous;
    }
  });
});
