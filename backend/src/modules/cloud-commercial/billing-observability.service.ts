import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";

type CountRow = Record<string, unknown> & { count?: unknown };

const SAFE_DIMENSIONS: Record<string, ReadonlySet<string>> = {
  provider: new Set(["stripe", "apple", "relay_migration"]),
  plan: new Set([
    "relay_cloud_monthly",
    "relay_connect_monthly",
    "relay_managed_cloud_monthly",
    "relay_cloud_migration_grace",
  ]),
  status: new Set([
    "subscription_required",
    "trial",
    "trialing",
    "active",
    "grace",
    "past_due",
    "read_only",
    "cancelled",
    "processing",
    "processed",
    "ignored",
    "failed",
  ]),
};

@Injectable()
export class BillingObservabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async snapshot() {
    const now = new Date();
    const windowHours = this.configNumber(
      "RELAY_BILLING_MONITOR_WINDOW_HOURS",
      24,
      1,
      720,
    );
    const staleProcessingMinutes = this.configNumber(
      "RELAY_BILLING_STALE_EVENT_MINUTES",
      10,
      1,
      1_440,
    );
    const windowStartedAt = new Date(now.getTime() - windowHours * 3_600_000);
    const staleBefore = new Date(
      now.getTime() - staleProcessingMinutes * 60_000,
    );
    const migrationGraceAlertHours = this.configNumber(
      "RELAY_MIGRATION_GRACE_ALERT_HOURS",
      24,
      1,
      168,
    );
    const migrationGraceAlertAt = new Date(
      now.getTime() + migrationGraceAlertHours * 3_600_000,
    );

    const [
      subscriptionGroups,
      subscriptionSummaryRows,
      mismatchRows,
      eventGroups,
      eventSummaryRows,
    ] = await Promise.all([
      this.dataSource.query(`
          SELECT provider, plan, status, COUNT(*)::int AS count
          FROM relay_commercial_subscriptions
          GROUP BY provider, plan, status
          ORDER BY provider, plan, status
        `),
      this.dataSource.query(
        `
            SELECT
              COUNT(*)::int AS "totalCount",
              COUNT(*) FILTER (WHERE status = 'active' AND provider IN ('stripe', 'apple'))::int AS "activePaidCount",
              COUNT(*) FILTER (WHERE "cancelAtPeriodEnd" = true)::int AS "scheduledCancellationCount",
              COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS "createdInWindowCount",
              COUNT(*) FILTER (WHERE "cancelledAt" >= $1)::int AS "cancelledInWindowCount",
              COUNT(*) FILTER (
                WHERE provider = 'relay_migration'
                  AND plan = 'relay_cloud_migration_grace'
                  AND status = 'grace'
              )::int AS "migrationGraceCount",
              COUNT(*) FILTER (
                WHERE provider = 'relay_migration'
                  AND plan = 'relay_cloud_migration_grace'
                  AND status = 'grace'
                  AND "readOnlyAt" > NOW()
                  AND "readOnlyAt" <= $2
              )::int AS "migrationGraceExpiringCount",
              COUNT(*) FILTER (
                WHERE provider = 'relay_migration'
                  AND plan = 'relay_cloud_migration_grace'
                  AND status = 'grace'
                  AND "readOnlyAt" <= NOW()
              )::int AS "migrationGraceExpiredCount"
            FROM relay_commercial_subscriptions
          `,
        [windowStartedAt, migrationGraceAlertAt],
      ),
      this.dataSource.query(`
          SELECT mismatch.code, COUNT(*)::int AS count
          FROM relay_commercial_subscriptions subscription
          CROSS JOIN LATERAL (
            VALUES
              ('WRITABLE_MISSING_PROVIDER_SUBSCRIPTION',
                subscription.status IN ('active', 'trial', 'grace')
                AND subscription."providerSubscriptionId" IS NULL
                AND NOT (
                  (subscription.provider = 'relay_migration'
                    AND subscription.plan = 'relay_cloud_migration_grace'
                    AND subscription.status = 'grace')
                  OR
                  (subscription.provider = 'relay_complimentary'
                    AND subscription.plan = 'relay_cloud_complimentary_lifetime'
                    AND subscription.status = 'active')
                )),
              ('ACTIVE_HAS_READ_ONLY_TIMESTAMP',
                subscription.status IN ('active', 'trial')
                AND subscription."readOnlyAt" IS NOT NULL),
              ('GRACE_MISSING_DEADLINE',
                subscription.status = 'grace'
                AND (subscription."graceEndsAt" IS NULL OR subscription."readOnlyAt" IS NULL)),
              ('READ_ONLY_MISSING_TIMESTAMP',
                subscription.status IN ('read_only', 'past_due', 'cancelled')
                AND subscription."readOnlyAt" IS NULL),
              ('CANCELLED_MISSING_TIMESTAMP',
                subscription.status = 'cancelled'
                AND subscription."cancelledAt" IS NULL),
              ('ACTIVE_PERIOD_EXPIRED',
                subscription.status IN ('active', 'trial')
                AND subscription."currentPeriodEndsAt" IS NOT NULL
                AND subscription."currentPeriodEndsAt" < NOW()),
              ('UNEXPECTED_BILLING_PROVIDER',
                subscription.provider NOT IN ('stripe', 'apple', 'relay_migration', 'relay_complimentary')),
              ('INVALID_MIGRATION_GRACE',
                subscription.provider = 'relay_migration'
                AND (
                  subscription.plan <> 'relay_cloud_migration_grace'
                  OR subscription.status <> 'grace'
                  OR subscription."providerCustomerId" IS NOT NULL
                  OR subscription."providerSubscriptionId" IS NOT NULL
                  OR subscription."graceEndsAt" IS NULL
                  OR subscription."readOnlyAt" IS NULL
                  OR subscription."graceEndsAt" <> subscription."readOnlyAt"
                )),
              ('INVALID_COMPLIMENTARY_LIFETIME',
                subscription.provider = 'relay_complimentary'
                AND (
                  subscription.plan <> 'relay_cloud_complimentary_lifetime'
                  OR subscription.status <> 'active'
                  OR subscription."providerCustomerId" IS NOT NULL
                  OR subscription."providerSubscriptionId" IS NOT NULL
                  OR subscription."currentPeriodEndsAt" IS NOT NULL
                  OR subscription."readOnlyAt" IS NOT NULL
                ))
          ) AS mismatch(code, violated)
          WHERE mismatch.violated
          GROUP BY mismatch.code
          ORDER BY mismatch.code
        `),
      this.dataSource.query(
        `
            SELECT provider, status, "eventType", "safeErrorCode", COUNT(*)::int AS count
            FROM relay_billing_events
            WHERE "createdAt" >= $1
            GROUP BY provider, status, "eventType", "safeErrorCode"
            ORDER BY provider, status, "eventType", "safeErrorCode"
          `,
        [windowStartedAt],
      ),
      this.dataSource.query(
        `
            SELECT
              COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS "eventsInWindowCount",
              COUNT(*) FILTER (WHERE status = 'failed' AND "createdAt" >= $1)::int AS "failedInWindowCount",
              COUNT(*) FILTER (
                WHERE
                  status = 'processing'
                  AND "createdAt" >= $1
                  AND (
                    ("claimExpiresAt" IS NOT NULL AND "claimExpiresAt" < $2)
                    OR (
                      "claimExpiresAt" IS NULL
                      AND "createdAt" < $3
                    )
                  )
              )::int AS "staleProcessingCount"
            FROM relay_billing_events
          `,
        [windowStartedAt, now, staleBefore],
      ),
    ]);

    const subscriptionSummary = this.first(subscriptionSummaryRows);
    const eventSummary = this.first(eventSummaryRows);
    const mismatchCounts = this.countsBy(mismatchRows, "code", true);
    const failedSafeCodes = this.failedSafeCodes(eventGroups);
    const paymentAttentionCount = this.paymentAttentionCount(eventGroups);
    const failedInWindowCount = this.asCount(eventSummary.failedInWindowCount);
    const staleProcessingCount = this.asCount(
      eventSummary.staleProcessingCount,
    );
    const migrationGraceExpiringCount = this.asCount(
      subscriptionSummary.migrationGraceExpiringCount,
    );
    const migrationGraceExpiredCount = this.asCount(
      subscriptionSummary.migrationGraceExpiredCount,
    );
    const entitlementMismatchCount = Object.values(mismatchCounts).reduce(
      (total, count) => total + count,
      0,
    );
    const alerts = [
      ...(failedInWindowCount > 0 ? ["BILLING_EVENT_FAILURES"] : []),
      ...(staleProcessingCount > 0 ? ["BILLING_EVENT_STUCK"] : []),
      ...(paymentAttentionCount > 0 ? ["PAYMENT_ATTENTION_REQUIRED"] : []),
      ...(entitlementMismatchCount > 0 ? ["ENTITLEMENT_MISMATCHES"] : []),
      ...(migrationGraceExpiringCount > 0 ? ["MIGRATION_GRACE_EXPIRING"] : []),
      ...(migrationGraceExpiredCount > 0 ? ["MIGRATION_GRACE_EXPIRED"] : []),
    ];

    return {
      schemaVersion: "relay.billing-observability.v1",
      generatedAt: now.toISOString(),
      status: alerts.length > 0 ? "attention" : "healthy",
      window: {
        hours: windowHours,
        startedAt: windowStartedAt.toISOString(),
        staleProcessingMinutes,
        migrationGraceAlertHours,
      },
      subscriptions: {
        total: this.asCount(subscriptionSummary.totalCount),
        activePaid: this.asCount(subscriptionSummary.activePaidCount),
        scheduledCancellation: this.asCount(
          subscriptionSummary.scheduledCancellationCount,
        ),
        createdInWindow: this.asCount(subscriptionSummary.createdInWindowCount),
        cancelledInWindow: this.asCount(
          subscriptionSummary.cancelledInWindowCount,
        ),
        migrationGrace: this.asCount(subscriptionSummary.migrationGraceCount),
        migrationGraceExpiring: migrationGraceExpiringCount,
        migrationGraceExpired: migrationGraceExpiredCount,
        byProvider: this.countsBy(subscriptionGroups, "provider"),
        byPlan: this.countsBy(subscriptionGroups, "plan"),
        byStatus: this.countsBy(subscriptionGroups, "status"),
      },
      billingEvents: {
        inWindow: this.asCount(eventSummary.eventsInWindowCount),
        failedInWindow: failedInWindowCount,
        staleProcessing: staleProcessingCount,
        paymentAttention: paymentAttentionCount,
        byProvider: this.countsBy(eventGroups, "provider"),
        byStatus: this.countsBy(eventGroups, "status"),
        failedSafeCodes,
      },
      entitlementConsistency: {
        mismatchCount: entitlementMismatchCount,
        byCode: mismatchCounts,
      },
      revenue: {
        sourceOfTruth: "billing_provider",
        trackedSignal: "active_paid_subscription_count",
        activePaidSubscriptions: this.asCount(
          subscriptionSummary.activePaidCount,
        ),
        currencyAmountsIncluded: false,
        reason: "PRICE_CURRENCY_AND_TAX_ARE_NOT_STORED_IN_RELAY_SUBSCRIPTIONS",
      },
      alerts,
      privacy: {
        workspaceIdsIncluded: false,
        customerIdentifiersIncluded: false,
        providerSubscriptionIdentifiersIncluded: false,
        emailsIncluded: false,
        payloadHashesIncluded: false,
        customerContentIncluded: false,
        secretValuesIncluded: false,
      },
    };
  }

  private first(rows: unknown): Record<string, unknown> {
    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
      ? (rows[0] as Record<string, unknown>)
      : {};
  }

  private countsBy(rows: unknown, key: string, uppercase = false) {
    const result: Record<string, number> = {};
    if (!Array.isArray(rows)) return result;
    for (const row of rows as CountRow[]) {
      const dimension = this.safeDimension(row?.[key], key, uppercase);
      result[dimension] = (result[dimension] || 0) + this.asCount(row?.count);
    }
    return Object.fromEntries(
      Object.entries(result).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }

  private failedSafeCodes(rows: unknown) {
    if (!Array.isArray(rows)) return {};
    return this.countsBy(
      (rows as CountRow[]).filter((row) => row.status === "failed"),
      "safeErrorCode",
      true,
    );
  }

  private paymentAttentionCount(rows: unknown) {
    if (!Array.isArray(rows)) return 0;
    return (rows as CountRow[]).reduce((total, row) => {
      const eventType = typeof row.eventType === "string" ? row.eventType : "";
      return /payment_failed|payment_action_required|billing_retry|grace_period/i.test(
        eventType,
      )
        ? total + this.asCount(row.count)
        : total;
    }, 0);
  }

  private safeDimension(value: unknown, key: string, uppercase = false) {
    if (typeof value !== "string")
      return uppercase ? "UNKNOWN_SAFE_CODE" : "unknown";
    const normalized = value.trim();
    if (uppercase) {
      return /^[A-Z0-9_-]{1,80}$/.test(normalized)
        ? normalized
        : "UNKNOWN_SAFE_CODE";
    }
    return SAFE_DIMENSIONS[key]?.has(normalized) ? normalized : "unknown";
  }

  private asCount(value: unknown) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(number));
  }

  private configNumber(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    return Number.isFinite(value) && value >= minimum && value <= maximum
      ? Math.floor(value)
      : fallback;
  }
}
