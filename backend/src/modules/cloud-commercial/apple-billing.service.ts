import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  AutoRenewStatus,
  Environment,
  JWSTransactionDecodedPayload,
  JWSRenewalInfoDecodedPayload,
  NotificationTypeV2,
  OfferDiscountType,
  ResponseBodyV2DecodedPayload,
  SignedDataVerifier,
  Status,
  Subtype,
} from "@apple/app-store-server-library";
import { createHash, randomUUID } from "crypto";
import { Repository } from "typeorm";
import {
  RelayBillingEventEntity,
  RelayCommercialSubscriptionEntity,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { CloudCommercialService } from "./cloud-commercial.service";
import {
  capRelayFailedPaymentGrace,
  relayDeletionEligibleAt,
} from "./subscription-commercial-policy";

type VerifiedNotification = {
  notification: ResponseBodyV2DecodedPayload;
  environment: Environment;
};
type AppleEventClaim = {
  id: string;
  claimToken: string;
};

const APPLE_EVENT_CLAIM_LEASE_SECONDS = 10 * 60;

@Injectable()
export class AppleBillingService {
  private readonly verifiers = new Map<Environment, SignedDataVerifier>();

  constructor(
    private readonly config: ConfigService,
    private readonly membership: WorkspaceMembershipService,
    private readonly audit: AuditLogService,
    private readonly cloud: CloudCommercialService,
    @InjectRepository(RelayCommercialSubscriptionEntity)
    private readonly subscriptions: Repository<RelayCommercialSubscriptionEntity>,
    @InjectRepository(RelayBillingEventEntity)
    private readonly events: Repository<RelayBillingEventEntity>,
  ) {}

  async submitTransaction(
    userId: string,
    workspaceId: string,
    signedTransaction: string,
  ) {
    this.assertEnabled();
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    const transaction = await this.verifyAnyTransaction(signedTransaction);
    this.assertTransactionContract(transaction, workspaceId);

    const originalTransactionId = this.requiredText(
      transaction.originalTransactionId,
      "APPLE_ORIGINAL_TRANSACTION_ID_REQUIRED",
    );
    const transactionId = this.requiredText(
      transaction.transactionId,
      "APPLE_TRANSACTION_ID_REQUIRED",
    );
    const byOriginal = await this.subscriptions.findOne({
      where: {
        provider: "apple",
        providerSubscriptionId: originalTransactionId,
      },
    });
    if (byOriginal && byOriginal.workspaceId !== workspaceId) {
      throw new ConflictException("APPLE_SUBSCRIPTION_ALREADY_BOUND");
    }

    let record = await this.subscriptions.findOne({ where: { workspaceId } });
    if (
      record &&
      record.provider !== "apple" &&
      ["trial", "active", "grace", "past_due", "read_only"].includes(
        record.status,
      )
    ) {
      throw new ConflictException("RELAY_CLOUD_SUBSCRIPTION_PROVIDER_CONFLICT");
    }
    record ||= this.newAppleSubscription(workspaceId);

    const event = await this.beginEvent(
      `transaction:${transactionId}`,
      "TRANSACTION_SUBMITTED",
      transaction.environment === Environment.PRODUCTION,
      signedTransaction,
    );
    if (!event.duplicate) {
      try {
        const providerStateAt = this.providerStateDate(
          transaction.signedDate,
          transaction.purchaseDate,
          transaction.originalPurchaseDate,
        );
        if (this.isStaleProviderState(record, providerStateAt)) {
          await this.completeEvent(event.record, "ignored");
          return this.cloud.entitlements(userId, workspaceId);
        }
        this.applyTransactionState(record, transaction);
        record.providerStateAt = providerStateAt;
        record = await this.subscriptions.save(record);
        await this.audit.record({
          actorType: "user",
          actorId: userId,
          workspaceId,
          eventType: "billing.apple.transaction.verified",
          resourceType: "subscription",
          resourceId: record.id || originalTransactionId,
          metadata: {
            provider: "apple",
            transactionId,
            originalTransactionId,
            status: record.status,
          },
        });
        await this.completeEvent(event.record, "processed");
      } catch (error) {
        await this.failEvent(event.record, error);
        throw error;
      }
    }
    return this.cloud.entitlements(userId, workspaceId);
  }

  async handleNotification(signedPayload: string) {
    this.assertEnabled();
    const { notification, environment } =
      await this.verifyAnyNotification(signedPayload);
    const notificationId = this.requiredText(
      notification.notificationUUID,
      "APPLE_NOTIFICATION_UUID_REQUIRED",
    );
    const event = await this.beginEvent(
      `notification:${notificationId}`,
      String(notification.notificationType || "UNKNOWN"),
      environment === Environment.PRODUCTION,
      signedPayload,
    );
    if (event.duplicate) return { received: true, duplicate: true };

    try {
      if (notification.notificationType === NotificationTypeV2.TEST) {
        await this.completeEvent(event.record, "ignored");
        return { received: true, duplicate: false, processed: false };
      }
      const signedTransaction = notification.data?.signedTransactionInfo;
      if (!signedTransaction) {
        await this.completeEvent(event.record, "ignored");
        return { received: true, duplicate: false, processed: false };
      }

      const transaction =
        await this.verifier(environment).verifyAndDecodeTransaction(
          signedTransaction,
        );
      this.assertTransactionContract(transaction);
      const renewal = notification.data?.signedRenewalInfo
        ? await this.verifier(environment).verifyAndDecodeRenewalInfo(
            notification.data.signedRenewalInfo,
          )
        : undefined;
      const originalTransactionId = this.requiredText(
        transaction.originalTransactionId || renewal?.originalTransactionId,
        "APPLE_ORIGINAL_TRANSACTION_ID_REQUIRED",
      );
      let record = await this.subscriptions.findOne({
        where: {
          provider: "apple",
          providerSubscriptionId: originalTransactionId,
        },
      });
      const tokenWorkspaceId = this.normalizedUuid(
        transaction.appAccountToken || renewal?.appAccountToken,
      );
      if (
        record &&
        tokenWorkspaceId &&
        record.workspaceId !== tokenWorkspaceId
      ) {
        throw new ConflictException("APPLE_SUBSCRIPTION_WORKSPACE_MISMATCH");
      }
      if (!record && tokenWorkspaceId) {
        const workspaceRecord = await this.subscriptions.findOne({
          where: { workspaceId: tokenWorkspaceId },
        });
        if (workspaceRecord && workspaceRecord.provider !== "apple") {
          throw new ConflictException(
            "RELAY_CLOUD_SUBSCRIPTION_PROVIDER_CONFLICT",
          );
        }
        record = workspaceRecord || this.newAppleSubscription(tokenWorkspaceId);
      }
      if (!record)
        throw new NotFoundException("APPLE_SUBSCRIPTION_WORKSPACE_NOT_FOUND");

      const providerStateAt = this.providerStateDate(
        notification.signedDate,
        transaction.signedDate,
        transaction.purchaseDate,
      );
      if (this.isStaleProviderState(record, providerStateAt)) {
        await this.audit.record({
          actorType: "provider",
          actorId: "apple",
          workspaceId: record.workspaceId,
          eventType: "billing.apple.notification.stale_ignored",
          resourceType: "subscription",
          resourceId: record.id || originalTransactionId,
          metadata: {
            notificationId,
            notificationType: notification.notificationType,
            status: record.status,
          },
        });
        await this.completeEvent(event.record, "ignored");
        return {
          received: true,
          duplicate: false,
          processed: false,
          stale: true,
        };
      }
      this.applyNotificationState(record, transaction, renewal, notification);
      record.providerStateAt = providerStateAt;
      record = await this.subscriptions.save(record);
      await this.audit.record({
        actorType: "provider",
        actorId: "apple",
        workspaceId: record.workspaceId,
        eventType: "billing.apple.notification.reconciled",
        resourceType: "subscription",
        resourceId: record.id || originalTransactionId,
        metadata: {
          notificationId,
          notificationType: notification.notificationType,
          subtype: notification.subtype || null,
          originalTransactionId,
          status: record.status,
        },
      });
      await this.completeEvent(event.record, "processed");
      return { received: true, duplicate: false, processed: true };
    } catch (error) {
      await this.failEvent(event.record, error);
      throw error;
    }
  }

  private applyTransactionState(
    record: RelayCommercialSubscriptionEntity,
    transaction: JWSTransactionDecodedPayload,
  ) {
    this.applyIdentity(record, transaction);
    const expiresAt = this.millisDate(transaction.expiresDate);
    record.currentPeriodEndsAt = expiresAt;
    if (transaction.revocationDate || (expiresAt && expiresAt <= new Date())) {
      this.makeReadOnly(record);
      return;
    }
    this.makeActive(record);
  }

  private applyNotificationState(
    record: RelayCommercialSubscriptionEntity,
    transaction: JWSTransactionDecodedPayload,
    renewal: JWSRenewalInfoDecodedPayload | undefined,
    notification: ResponseBodyV2DecodedPayload,
  ) {
    this.applyIdentity(record, transaction);
    record.currentPeriodEndsAt =
      this.millisDate(transaction.expiresDate) ||
      this.millisDate(renewal?.renewalDate) ||
      record.currentPeriodEndsAt;
    if (renewal?.autoRenewStatus !== undefined) {
      record.cancelAtPeriodEnd =
        renewal.autoRenewStatus === AutoRenewStatus.OFF;
    }

    const type = notification.notificationType;
    const subtype = notification.subtype;
    const providerStatus = Number(notification.data?.status);
    if (
      transaction.revocationDate ||
      type === NotificationTypeV2.REFUND ||
      type === NotificationTypeV2.REVOKE ||
      providerStatus === Status.REVOKED
    ) {
      this.makeReadOnly(record);
      return;
    }
    if (
      providerStatus === Status.BILLING_GRACE_PERIOD ||
      subtype === Subtype.GRACE_PERIOD
    ) {
      record.status = "grace";
      record.graceEndsAt = capRelayFailedPaymentGrace(
        this.millisDate(renewal?.gracePeriodExpiresDate),
      );
      record.readOnlyAt = record.graceEndsAt;
      record.deletionEligibleAt = null;
      record.cancelledAt = null;
      return;
    }
    if (
      providerStatus === Status.BILLING_RETRY ||
      subtype === Subtype.BILLING_RETRY
    ) {
      record.status = "grace";
      record.graceEndsAt = capRelayFailedPaymentGrace(null);
      record.readOnlyAt = record.graceEndsAt;
      record.deletionEligibleAt = null;
      return;
    }
    if (
      providerStatus === Status.EXPIRED ||
      type === NotificationTypeV2.EXPIRED ||
      type === NotificationTypeV2.GRACE_PERIOD_EXPIRED
    ) {
      this.makeCancelled(record);
      return;
    }
    const expiresAt = record.currentPeriodEndsAt;
    if (
      providerStatus === Status.ACTIVE ||
      !expiresAt ||
      expiresAt > new Date()
    ) {
      this.makeActive(record);
      return;
    }
    this.makeCancelled(record);
  }

  private applyIdentity(
    record: RelayCommercialSubscriptionEntity,
    transaction: JWSTransactionDecodedPayload,
  ) {
    record.provider = "apple";
    record.plan = "relay_connect_monthly";
    record.providerCustomerId = null;
    record.providerSubscriptionId = this.requiredText(
      transaction.originalTransactionId,
      "APPLE_ORIGINAL_TRANSACTION_ID_REQUIRED",
    );
  }

  private makeActive(record: RelayCommercialSubscriptionEntity) {
    record.status = "active";
    record.graceEndsAt = null;
    record.readOnlyAt = null;
    record.deletionEligibleAt = null;
    record.cancelledAt = null;
  }

  private makeReadOnly(record: RelayCommercialSubscriptionEntity) {
    record.status = "read_only";
    record.graceEndsAt = null;
    record.readOnlyAt = new Date();
    record.cancelledAt = new Date();
    record.deletionEligibleAt = relayDeletionEligibleAt();
  }

  private makeCancelled(record: RelayCommercialSubscriptionEntity) {
    record.status = "cancelled";
    record.graceEndsAt = null;
    record.readOnlyAt = new Date();
    record.cancelledAt = new Date();
    record.deletionEligibleAt = relayDeletionEligibleAt();
  }

  private assertTransactionContract(
    transaction: JWSTransactionDecodedPayload,
    expectedWorkspaceId?: string,
  ) {
    if (
      transaction.productId !==
      this.requiredConfig("APPLE_RELAY_CLOUD_PRODUCT_ID")
    ) {
      throw new BadRequestException("APPLE_PRODUCT_ID_MISMATCH");
    }
    if (transaction.bundleId !== this.requiredConfig("APPLE_BUNDLE_ID")) {
      throw new BadRequestException("APPLE_BUNDLE_ID_MISMATCH");
    }
    if (transaction.offerDiscountType === OfferDiscountType.FREE_TRIAL) {
      throw new BadRequestException("APPLE_FREE_TRIAL_NOT_ALLOWED");
    }
    if (expectedWorkspaceId) {
      const token = this.normalizedUuid(transaction.appAccountToken);
      if (!token || token !== this.normalizedUuid(expectedWorkspaceId)) {
        throw new BadRequestException("APPLE_APP_ACCOUNT_TOKEN_MISMATCH");
      }
    }
  }

  private async verifyAnyTransaction(signedTransaction: string) {
    let lastError: unknown;
    for (const environment of this.environments()) {
      try {
        return await this.verifier(environment).verifyAndDecodeTransaction(
          signedTransaction,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw new BadRequestException({
      code: "APPLE_TRANSACTION_VERIFICATION_FAILED",
      cause: this.safeErrorCode(lastError),
    });
  }

  private async verifyAnyNotification(
    signedPayload: string,
  ): Promise<VerifiedNotification> {
    let lastError: unknown;
    for (const environment of this.environments()) {
      try {
        return {
          notification:
            await this.verifier(environment).verifyAndDecodeNotification(
              signedPayload,
            ),
          environment,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new BadRequestException({
      code: "APPLE_NOTIFICATION_VERIFICATION_FAILED",
      cause: this.safeErrorCode(lastError),
    });
  }

  private verifier(environment: Environment) {
    const cached = this.verifiers.get(environment);
    if (cached) return cached;
    const roots = this.appleRoots();
    const bundleId = this.requiredConfig("APPLE_BUNDLE_ID");
    const appAppleId =
      environment === Environment.PRODUCTION
        ? Number(this.requiredConfig("APPLE_APP_ID"))
        : undefined;
    const verifier = new SignedDataVerifier(
      roots,
      true,
      environment,
      bundleId,
      appAppleId,
    );
    this.verifiers.set(environment, verifier);
    return verifier;
  }

  private environments() {
    const result = [Environment.PRODUCTION];
    if (this.configBoolean("RELAY_APPLE_ALLOW_SANDBOX", false)) {
      result.push(Environment.SANDBOX);
    }
    return result;
  }

  private appleRoots() {
    const raw = this.requiredConfig("APPLE_ROOT_CA_BASE64_JSON");
    let values: unknown;
    try {
      values = JSON.parse(raw);
    } catch {
      throw new ServiceUnavailableException("APPLE_ROOT_CA_CONFIG_INVALID");
    }
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.some((value) => typeof value !== "string" || !value.trim())
    ) {
      throw new ServiceUnavailableException("APPLE_ROOT_CA_CONFIG_INVALID");
    }
    return values.map((value) => Buffer.from(String(value), "base64"));
  }

  private async beginEvent(
    providerEventId: string,
    eventType: string,
    liveMode: boolean,
    payload: string,
  ) {
    const payloadHash = createHash("sha256").update(payload).digest("hex");
    const claimToken = randomUUID();
    const rows = (await this.events.query(
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
            'apple', $1, $2, $3, $4, 'processing', NULL, NULL, $5,
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
            AND event.provider = 'apple'
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
        providerEventId,
        eventType,
        liveMode,
        payloadHash,
        claimToken,
        APPLE_EVENT_CLAIM_LEASE_SECONDS,
      ],
    )) as Array<{ id?: unknown; claimToken?: unknown }>;
    if (
      typeof rows[0]?.id === "string" &&
      rows[0].claimToken === claimToken
    ) {
      return {
        record: { id: rows[0].id, claimToken },
        duplicate: false,
      };
    }

    const existing = await this.events.findOne({
      where: { provider: "apple", providerEventId },
    });
    if (!existing) {
      throw new ConflictException("APPLE_EVENT_IDEMPOTENCY_FAILED");
    }
    if (
      existing.eventType !== eventType ||
      existing.liveMode !== liveMode ||
      existing.payloadHash !== payloadHash
    ) {
      throw new ConflictException("APPLE_EVENT_PAYLOAD_MISMATCH");
    }
    if (["processing", "processed", "ignored"].includes(existing.status)) {
      return {
        record: {
          id: existing.id,
          claimToken: existing.claimToken ?? "",
        },
        duplicate: true,
      };
    }
    throw new ConflictException("APPLE_EVENT_IDEMPOTENCY_FAILED");
  }

  private async completeEvent(
    record: AppleEventClaim,
    status: "processed" | "ignored",
  ) {
    const result = await this.events.update(
      {
        id: record.id,
        status: "processing",
        claimToken: record.claimToken,
      },
      {
        status,
        processedAt: new Date(),
        safeErrorCode: null,
        claimToken: null,
        claimExpiresAt: null,
      },
    );
    if (result.affected !== 1) {
      throw new ConflictException("APPLE_EVENT_CLAIM_LOST");
    }
  }

  private async failEvent(record: AppleEventClaim, error: unknown) {
    await this.events.update(
      {
        id: record.id,
        status: "processing",
        claimToken: record.claimToken,
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

  private newAppleSubscription(workspaceId: string) {
    return this.subscriptions.create({
      workspaceId,
      provider: "apple",
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
    });
  }

  private providerStateDate(...values: unknown[]) {
    for (const value of values) {
      const date = this.millisDate(value);
      if (date) return date;
    }
    return new Date();
  }

  private isStaleProviderState(
    record: RelayCommercialSubscriptionEntity,
    providerStateAt: Date,
  ) {
    return (
      record.providerStateAt instanceof Date &&
      providerStateAt.getTime() < record.providerStateAt.getTime()
    );
  }

  private normalizedUuid(value: unknown) {
    const text = typeof value === "string" ? value.trim().toLowerCase() : "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      text,
    )
      ? text
      : null;
  }

  private millisDate(value: unknown) {
    const milliseconds = Number(value);
    return Number.isFinite(milliseconds) && milliseconds > 0
      ? new Date(milliseconds)
      : null;
  }

  private requiredText(value: unknown, code: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new BadRequestException(code);
    return text;
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException(`${key}_REQUIRED`);
    return value;
  }

  private assertEnabled() {
    if (!this.configBoolean("RELAY_APPLE_BILLING_ENABLED", false)) {
      throw new ServiceUnavailableException("RELAY_APPLE_BILLING_NOT_ENABLED");
    }
  }

  private configBoolean(key: string, fallback: boolean) {
    const value = this.config.get<string | boolean>(key);
    if (value === undefined || value === null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(
      String(value).trim().toLowerCase(),
    );
  }

  private safeErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return message.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120) || "UNKNOWN";
  }
}
