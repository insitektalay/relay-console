import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Repository } from "typeorm";
import {
  RelayBillingEventEntity,
  RelayCommercialSubscriptionEntity,
  UserEntity,
} from "../../entities";
import { assertManagedCloudLaunchEnabled } from "../../config/managed-cloud-launch.policy";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import {
  relayDeletionEligibleAt,
  relayFailedPaymentGraceEndsAt,
} from "./subscription-commercial-policy";

type StripeObject = Record<string, unknown>;
type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: StripeObject };
};
type PurchasablePlan = "relay_connect_monthly" | "relay_managed_cloud_monthly";
type StripeEventClaim = {
  id: string;
  claimToken: string;
};

const STRIPE_EVENT_CLAIM_LEASE_SECONDS = 10 * 60;

@Injectable()
export class StripeBillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly membership: WorkspaceMembershipService,
    private readonly audit: AuditLogService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(RelayCommercialSubscriptionEntity)
    private readonly subscriptions: Repository<RelayCommercialSubscriptionEntity>,
    @InjectRepository(RelayBillingEventEntity)
    private readonly events: Repository<RelayBillingEventEntity>,
  ) {}

  async createCheckout(
    userId: string,
    workspaceId: string,
    requestedPlan: PurchasablePlan = "relay_connect_monthly",
  ) {
    this.assertEnabled();
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("USER_NOT_FOUND");
    if (!user.emailVerifiedAt) {
      throw new BadRequestException("EMAIL_VERIFICATION_REQUIRED");
    }

    const existing = await this.subscriptions.findOne({
      where: { workspaceId },
    });
    if (existing && ["trial", "active", "grace"].includes(existing.status)) {
      throw new ConflictException("RELAY_CLOUD_SUBSCRIPTION_ALREADY_ACTIVE");
    }
    if (existing?.providerSubscriptionId && existing.status !== "cancelled") {
      throw new ConflictException("RELAY_CLOUD_SUBSCRIPTION_ALREADY_EXISTS");
    }

    if (
      !["relay_connect_monthly", "relay_managed_cloud_monthly"].includes(
        requestedPlan,
      )
    ) {
      throw new BadRequestException("BILLING_PLAN_INVALID");
    }
    if (requestedPlan === "relay_managed_cloud_monthly") {
      assertManagedCloudLaunchEnabled(this.config);
    }
    const priceId =
      requestedPlan === "relay_managed_cloud_monthly"
        ? this.requiredConfig("STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID")
        : this.requiredConfig("STRIPE_RELAY_CLOUD_PRICE_ID");

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("client_reference_id", workspaceId);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set(
      "success_url",
      `${this.webOrigin()}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    );
    form.set("cancel_url", `${this.webOrigin()}/?billing=cancelled`);
    form.set("billing_address_collection", "required");
    form.set("automatic_tax[enabled]", "true");
    form.set("tax_id_collection[enabled]", "true");
    form.set("allow_promotion_codes", "true");
    form.set("metadata[workspaceId]", workspaceId);
    form.set("metadata[userId]", userId);
    form.set("metadata[plan]", requestedPlan);
    form.set("subscription_data[metadata][workspaceId]", workspaceId);
    form.set("subscription_data[metadata][userId]", userId);
    form.set("subscription_data[metadata][plan]", requestedPlan);
    if (existing?.providerCustomerId)
      form.set("customer", existing.providerCustomerId);
    else form.set("customer_email", user.email);
    const session = await this.stripeRequest(
      "/v1/checkout/sessions",
      form,
      `checkout-${workspaceId}-${randomUUID()}`,
    );
    const url = this.safeStripeUrl(session.url);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "billing.checkout.created",
      resourceType: "stripe_checkout_session",
      resourceId: this.text(session.id),
      metadata: { provider: "stripe", priceId, plan: requestedPlan },
    });
    return {
      provider: "stripe",
      checkoutUrl: url,
      sessionId: this.text(session.id),
    };
  }

  async createPortal(userId: string, workspaceId: string) {
    this.assertEnabled();
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    const subscription = await this.subscriptions.findOne({
      where: { workspaceId },
    });
    if (!subscription?.providerCustomerId)
      throw new NotFoundException("BILLING_CUSTOMER_NOT_FOUND");
    const form = new URLSearchParams();
    form.set("customer", subscription.providerCustomerId);
    form.set("return_url", `${this.webOrigin()}/?billing=return`);
    const session = await this.stripeRequest(
      "/v1/billing_portal/sessions",
      form,
      `portal-${workspaceId}-${randomUUID()}`,
    );
    return { provider: "stripe", portalUrl: this.safeStripeUrl(session.url) };
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    this.assertEnabled();
    if (!rawBody?.length)
      throw new BadRequestException("STRIPE_WEBHOOK_BODY_REQUIRED");
    const event = this.verifyAndParseEvent(rawBody, signatureHeader);
    if (!event.id || !event.type || !event.data?.object)
      throw new BadRequestException("STRIPE_EVENT_INVALID");
    const expectedLiveMode =
      this.requiredConfig("STRIPE_SECRET_KEY").startsWith("sk_live_");
    if (event.livemode !== expectedLiveMode)
      throw new BadRequestException("STRIPE_LIVE_MODE_MISMATCH");

    const payloadHash = this.hash(rawBody);
    const claim = await this.claimStripeEvent(event, payloadHash);
    if (!claim) return { received: true, duplicate: true };

    try {
      const processed = await this.processEvent(event);
      await this.completeStripeEventClaim(
        claim,
        processed ? "processed" : "ignored",
      );
      return { received: true, duplicate: false, processed };
    } catch (error) {
      await this.failStripeEventClaim(claim, error);
      throw error;
    }
  }

  private async claimStripeEvent(
    event: StripeEvent,
    payloadHash: string,
  ): Promise<StripeEventClaim | null> {
    const claimToken = randomUUID();
    const claimed = (await this.events.query(
      `
        WITH inserted AS (
          INSERT INTO "relay_billing_events" (
            provider,
            "providerEventId",
            "eventType",
            "liveMode",
            "payloadHash",
            status,
            "safeErrorCode",
            "processedAt",
            "claimToken",
            "claimExpiresAt",
            "attemptCount"
          )
          VALUES (
            'stripe', $1, $2, $3, $4, 'processing', NULL, NULL, $5,
            NOW() + ($6 * INTERVAL '1 second'), 1
          )
          ON CONFLICT (provider, "providerEventId") DO NOTHING
          RETURNING id, "claimToken"
        ),
        reclaimed AS (
          UPDATE "relay_billing_events" AS event
          SET
            status = 'processing',
            "safeErrorCode" = NULL,
            "processedAt" = NULL,
            "claimToken" = $5,
            "claimExpiresAt" = NOW() + ($6 * INTERVAL '1 second'),
            "attemptCount" = event."attemptCount" + 1
          WHERE
            NOT EXISTS (SELECT 1 FROM inserted)
            AND event.provider = 'stripe'
            AND event."providerEventId" = $1
            AND event."eventType" = $2
            AND event."liveMode" = $3
            AND event."payloadHash" = $4
            AND (
              event.status = 'failed'
              OR (
                event.status = 'processing'
                AND (
                  event."claimExpiresAt" <= NOW()
                  OR (
                    event."claimExpiresAt" IS NULL
                    AND event."createdAt" <=
                      NOW() - ($6 * INTERVAL '1 second')
                  )
                )
              )
            )
          RETURNING event.id, event."claimToken"
        )
        SELECT id, "claimToken" FROM inserted
        UNION ALL
        SELECT id, "claimToken" FROM reclaimed
        LIMIT 1
      `,
      [
        event.id,
        event.type,
        event.livemode,
        payloadHash,
        claimToken,
        STRIPE_EVENT_CLAIM_LEASE_SECONDS,
      ],
    )) as Array<{ id?: unknown; claimToken?: unknown }>;
    const row = claimed[0];
    if (
      typeof row?.id === "string" &&
      typeof row.claimToken === "string" &&
      row.claimToken === claimToken
    ) {
      return { id: row.id, claimToken };
    }

    const existing = await this.events.findOne({
      where: { provider: "stripe", providerEventId: event.id },
    });
    if (!existing) {
      throw new ConflictException("STRIPE_EVENT_IDEMPOTENCY_FAILED");
    }
    if (
      existing.eventType !== event.type ||
      existing.liveMode !== event.livemode ||
      existing.payloadHash !== payloadHash
    ) {
      throw new ConflictException("STRIPE_EVENT_PAYLOAD_MISMATCH");
    }
    if (
      ["processing", "processed", "ignored"].includes(existing.status)
    ) {
      return null;
    }
    throw new ConflictException("STRIPE_EVENT_IDEMPOTENCY_FAILED");
  }

  private async completeStripeEventClaim(
    claim: StripeEventClaim,
    status: "processed" | "ignored",
  ) {
    const result = await this.events.update(
      {
        id: claim.id,
        status: "processing",
        claimToken: claim.claimToken,
      },
      {
        status,
        safeErrorCode: null,
        processedAt: new Date(),
        claimToken: null,
        claimExpiresAt: null,
      },
    );
    if (result.affected !== 1) {
      throw new ConflictException("STRIPE_EVENT_CLAIM_LOST");
    }
  }

  private async failStripeEventClaim(
    claim: StripeEventClaim,
    error: unknown,
  ) {
    await this.events.update(
      {
        id: claim.id,
        status: "processing",
        claimToken: claim.claimToken,
      },
      {
        status: "failed",
        safeErrorCode: this.safeErrorCode(error),
        processedAt: null,
        claimToken: null,
        claimExpiresAt: null,
      },
    );
  }

  private async processEvent(event: StripeEvent): Promise<boolean> {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const workspaceId =
          this.metadataText(object, "workspaceId") ||
          this.text(object.client_reference_id);
        if (!workspaceId)
          throw new BadRequestException("STRIPE_WORKSPACE_METADATA_REQUIRED");
        const record = await this.getOrCreateSubscription(workspaceId);
        record.provider = "stripe";
        record.providerCustomerId = this.objectId(object.customer);
        record.providerSubscriptionId = this.objectId(object.subscription);
        await this.subscriptions.save(record);
        await this.auditBilling(
          workspaceId,
          "billing.checkout.completed",
          event,
          record,
        );
        return true;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed":
      case "customer.subscription.paused":
      case "customer.subscription.deleted": {
        const record = await this.subscriptionForObject(object);
        if (!record)
          throw new NotFoundException(
            "STRIPE_SUBSCRIPTION_WORKSPACE_NOT_FOUND",
          );
        this.applySubscriptionObject(
          record,
          object,
          event.type === "customer.subscription.deleted",
        );
        await this.subscriptions.save(record);
        await this.auditBilling(
          record.workspaceId,
          "billing.subscription.reconciled",
          event,
          record,
        );
        return true;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const record = await this.subscriptionForInvoice(object);
        if (!record) return false;
        record.status = "active";
        record.graceEndsAt = null;
        record.readOnlyAt = null;
        await this.subscriptions.save(record);
        await this.auditBilling(
          record.workspaceId,
          "billing.invoice.paid",
          event,
          record,
        );
        return true;
      }
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const record = await this.subscriptionForInvoice(object);
        if (!record) return false;
        const graceEndsAt = relayFailedPaymentGraceEndsAt();
        record.status = "grace";
        record.graceEndsAt = graceEndsAt;
        record.readOnlyAt = graceEndsAt;
        await this.subscriptions.save(record);
        await this.auditBilling(
          record.workspaceId,
          "billing.payment.attention_required",
          event,
          record,
        );
        return true;
      }
      case "charge.dispute.created": {
        const customerId = this.objectId(object.customer);
        if (!customerId) return false;
        const record = await this.subscriptions.findOne({
          where: { provider: "stripe", providerCustomerId: customerId },
        });
        if (!record) return false;
        record.status = "read_only";
        record.readOnlyAt = new Date();
        await this.subscriptions.save(record);
        await this.auditBilling(
          record.workspaceId,
          "billing.dispute.created",
          event,
          record,
        );
        return true;
      }
      case "charge.refunded": {
        const customerId = this.objectId(object.customer);
        if (!customerId) return false;
        const record = await this.subscriptions.findOne({
          where: { provider: "stripe", providerCustomerId: customerId },
        });
        if (!record) return false;
        const amount = Number(object.amount);
        const amountRefunded = Number(object.amount_refunded);
        if (Number.isFinite(amount) && amount > 0 && amountRefunded >= amount) {
          record.status = "read_only";
          record.readOnlyAt = new Date();
          await this.subscriptions.save(record);
        }
        await this.auditBilling(
          record.workspaceId,
          "billing.charge.refunded",
          event,
          record,
        );
        return true;
      }
      default:
        return false;
    }
  }

  private async subscriptionForObject(object: StripeObject) {
    const workspaceId = this.metadataText(object, "workspaceId");
    const subscriptionId = this.text(object.id);
    if (workspaceId) return this.getOrCreateSubscription(workspaceId);
    if (!subscriptionId) return null;
    return this.subscriptions.findOne({
      where: { provider: "stripe", providerSubscriptionId: subscriptionId },
    });
  }

  private async subscriptionForInvoice(object: StripeObject) {
    const parent = object.parent as StripeObject | undefined;
    const subscriptionDetails = parent?.subscription_details as
      | StripeObject
      | undefined;
    const subscriptionId =
      this.objectId(object.subscription) ||
      this.objectId(subscriptionDetails?.subscription);
    if (subscriptionId) {
      const bySubscription = await this.subscriptions.findOne({
        where: { provider: "stripe", providerSubscriptionId: subscriptionId },
      });
      if (bySubscription) return bySubscription;
    }
    const customerId = this.objectId(object.customer);
    return customerId
      ? this.subscriptions.findOne({
          where: { provider: "stripe", providerCustomerId: customerId },
        })
      : null;
  }

  private applySubscriptionObject(
    record: RelayCommercialSubscriptionEntity,
    object: StripeObject,
    deleted: boolean,
  ) {
    record.provider = "stripe";
    record.providerSubscriptionId =
      this.text(object.id) || record.providerSubscriptionId;
    record.providerCustomerId =
      this.objectId(object.customer) || record.providerCustomerId;
    record.plan = this.planForSubscription(object);
    const managed = record.plan === "relay_managed_cloud_monthly";
    record.features = {
      cloudControlPlane: true,
      customerRuntimeHosts: true,
      managedRuntime: managed,
    };
    record.limits = managed
      ? {
          seats: 1,
          storageBytes: 1_073_741_824,
          attachmentBytes: 52_428_800,
          runtimeDevices: 6,
          websocketConnections: 10,
          dispatchesPerMinute: 60,
          managedRuntimeMinutes: 44_640,
          managedRuntimeStorageBytes: 21_474_836_480,
        }
      : {
          seats: 1,
          storageBytes: 1_073_741_824,
          attachmentBytes: 52_428_800,
          runtimeDevices: 5,
          websocketConnections: 10,
          dispatchesPerMinute: 60,
          managedRuntimeMinutes: 0,
        };
    record.cancelAtPeriodEnd =
      Boolean(object.cancel_at_period_end) ||
      Boolean(this.unixDate(object.cancel_at));
    record.currentPeriodEndsAt = this.subscriptionPeriodEnd(object);
    record.trialEndsAt = this.unixDate(object.trial_end);
    const stripeStatus = deleted ? "canceled" : this.text(object.status);
    if (stripeStatus === "trialing") {
      record.status = "read_only";
      record.readOnlyAt = new Date();
    }
    else if (stripeStatus === "active") record.status = "active";
    else if (stripeStatus === "past_due") {
      record.status = "grace";
      record.graceEndsAt ||= relayFailedPaymentGraceEndsAt();
      record.readOnlyAt = record.graceEndsAt;
    } else if (stripeStatus === "canceled") {
      record.status = "cancelled";
      record.cancelledAt = new Date();
      record.readOnlyAt = new Date();
      record.deletionEligibleAt = relayDeletionEligibleAt();
    } else {
      record.status = "read_only";
      record.readOnlyAt ||= new Date();
    }
    if (record.status === "active") {
      record.graceEndsAt = null;
      record.readOnlyAt = null;
      record.deletionEligibleAt = null;
    }
  }

  private async getOrCreateSubscription(workspaceId: string) {
    return (
      (await this.subscriptions.findOne({ where: { workspaceId } })) ||
      this.subscriptions.create({
        workspaceId,
        provider: "stripe",
        plan: "relay_connect_monthly",
        status: "subscription_required",
        providerCustomerId: null,
        providerSubscriptionId: null,
        limits: {},
        features: {},
        trialEndsAt: null,
        graceEndsAt: null,
        readOnlyAt: null,
        deletionEligibleAt: null,
        cancelledAt: null,
        currentPeriodEndsAt: null,
        providerStateAt: null,
        cancelAtPeriodEnd: false,
      })
    );
  }

  private verifyAndParseEvent(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): StripeEvent {
    if (!signatureHeader)
      throw new UnauthorizedException("STRIPE_SIGNATURE_REQUIRED");
    const fields = signatureHeader
      .split(",")
      .map((part) => part.trim().split("=", 2));
    const timestamp = Number(fields.find(([key]) => key === "t")?.[1]);
    const signatures = fields
      .filter(([key]) => key === "v1")
      .map(([, value]) => value)
      .filter(Boolean);
    if (!Number.isFinite(timestamp) || !signatures.length)
      throw new UnauthorizedException("STRIPE_SIGNATURE_INVALID");
    const tolerance = this.configNumber(
      "STRIPE_WEBHOOK_TOLERANCE_SECONDS",
      300,
    );
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance)
      throw new UnauthorizedException("STRIPE_SIGNATURE_EXPIRED");
    const expected = createHmac(
      "sha256",
      this.requiredConfig("STRIPE_WEBHOOK_SECRET"),
    )
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex");
    const valid = signatures.some((signature) =>
      this.safeEqualHex(expected, signature),
    );
    if (!valid) throw new UnauthorizedException("STRIPE_SIGNATURE_INVALID");
    try {
      return JSON.parse(rawBody.toString("utf8")) as StripeEvent;
    } catch {
      throw new BadRequestException("STRIPE_EVENT_JSON_INVALID");
    }
  }

  private async stripeRequest(
    path: string,
    body: URLSearchParams,
    idempotencyKey: string,
  ): Promise<StripeObject> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.requiredConfig("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body,
    });
    const payload = (await response.json()) as StripeObject;
    if (!response.ok) {
      const error = payload.error as StripeObject | undefined;
      const code = this.text(error?.code) || `HTTP_${response.status}`;
      throw new BadGatewayException({
        code: "STRIPE_REQUEST_FAILED",
        providerCode: code,
      });
    }
    return payload;
  }

  private webOrigin() {
    const value =
      this.config.get<string>("RELAY_PUBLIC_WEB_ORIGIN") ||
      "https://relayconsole.work";
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new ServiceUnavailableException("RELAY_PUBLIC_WEB_ORIGIN_INVALID");
    }
    return url.origin;
  }

  private safeStripeUrl(value: unknown) {
    const url = new URL(this.text(value));
    if (
      url.protocol !== "https:" ||
      !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
    ) {
      throw new BadGatewayException("STRIPE_REDIRECT_URL_INVALID");
    }
    return url.toString();
  }

  private async auditBilling(
    workspaceId: string,
    eventType: string,
    event: StripeEvent,
    record: RelayCommercialSubscriptionEntity,
  ) {
    await this.audit.record({
      actorType: "provider",
      actorId: "stripe",
      workspaceId,
      eventType,
      resourceType: "subscription",
      resourceId: record.id || record.providerSubscriptionId,
      metadata: {
        providerEventId: event.id,
        providerEventType: event.type,
        status: record.status,
      },
    });
  }

  private metadataText(object: StripeObject, key: string) {
    return this.text((object.metadata as StripeObject | undefined)?.[key]);
  }
  private objectId(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object")
      return this.text((value as StripeObject).id) || null;
    return null;
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }
  private unixDate(value: unknown) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
      ? new Date(seconds * 1000)
      : null;
  }
  private subscriptionPeriodEnd(object: StripeObject) {
    const legacyPeriodEnd = this.unixDate(object.current_period_end);
    if (legacyPeriodEnd) return legacyPeriodEnd;

    const items = (object.items as StripeObject | undefined)?.data;
    const itemPeriodEnds = Array.isArray(items)
      ? items
          .map((item) =>
            this.unixDate(
              (item as StripeObject | undefined)?.current_period_end,
            ),
          )
          .filter((value): value is Date => Boolean(value))
      : [];
    if (itemPeriodEnds.length) {
      return new Date(
        Math.max(...itemPeriodEnds.map((value) => value.getTime())),
      );
    }

    return this.unixDate(object.cancel_at);
  }
  private planForSubscription(object: StripeObject): PurchasablePlan {
    const configuredManagedPrice = this.config
      .get<string>("STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID")
      ?.trim();
    const items = (object.items as StripeObject | undefined)?.data;
    const priceIds = Array.isArray(items)
      ? items
          .map((item) => {
            const price = (item as StripeObject | undefined)?.price;
            return this.objectId(price);
          })
          .filter(Boolean)
      : [];
    const metadataPlan = this.metadataText(object, "plan");
    if (
      metadataPlan === "relay_managed_cloud_monthly" ||
      (configuredManagedPrice && priceIds.includes(configuredManagedPrice))
    ) {
      return "relay_managed_cloud_monthly";
    }
    return "relay_connect_monthly";
  }
  private hash(value: Buffer) {
    return createHash("sha256").update(value).digest("hex");
  }
  private safeEqualHex(left: string, right: string) {
    if (!/^[a-f0-9]{64}$/i.test(right)) return false;
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private requiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException(`${key}_REQUIRED`);
    return value;
  }
  private assertEnabled() {
    const value = String(
      this.config.get<string | boolean>("RELAY_BILLING_ENABLED") ?? "",
    )
      .trim()
      .toLowerCase();
    if (!["1", "true", "yes", "on"].includes(value)) {
      throw new ServiceUnavailableException("RELAY_BILLING_NOT_ENABLED");
    }
  }
  private configNumber(key: string, fallback: number) {
    const value = Number(this.config.get<string | number>(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
  private safeErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return message.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120) || "UNKNOWN";
  }
}
