import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";

@Injectable()
export class OperationsObservabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async snapshot() {
    const now = new Date();
    const windowHours = this.configNumber(
      "RELAY_OPERATIONS_MONITOR_WINDOW_HOURS",
      24,
      1,
      720,
    );
    const bridgeRecentMinutes = this.configNumber(
      "RELAY_BRIDGE_RECENT_MINUTES",
      5,
      1,
      1_440,
    );
    const staleEventMinutes = this.configNumber(
      "RELAY_OPERATIONS_STALE_EVENT_MINUTES",
      15,
      1,
      1_440,
    );
    const windowStartedAt = new Date(now.getTime() - windowHours * 3_600_000);
    const bridgeRecentAfter = new Date(
      now.getTime() - bridgeRecentMinutes * 60_000,
    );
    const staleBefore = new Date(now.getTime() - staleEventMinutes * 60_000);

    const [
      bridgeDeviceRows,
      bridgeEventRows,
      runtimeBindingRows,
      runtimeDispatchRows,
      oauthRows,
      marketplaceConnectionRows,
    ] = await Promise.all([
      this.dataSource.query(
        `
          SELECT
            COUNT(*)::int AS "totalCount",
            COUNT(*) FILTER (WHERE status = 'active')::int AS "activeCount",
            COUNT(*) FILTER (WHERE status = 'revoked')::int AS "revokedCount",
            COUNT(*) FILTER (
              WHERE status = 'active' AND "lastSeenAt" >= $1
            )::int AS "recentCount",
            COUNT(*) FILTER (
              WHERE status = 'active' AND "lastSeenAt" IS NOT NULL AND "lastSeenAt" < $1
            )::int AS "staleCount",
            COUNT(*) FILTER (
              WHERE status = 'active' AND "lastSeenAt" IS NULL
            )::int AS "neverSeenCount"
          FROM bridge_devices
        `,
        [bridgeRecentAfter],
      ),
      this.dataSource.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS "inWindowCount",
            COUNT(*) FILTER (
              WHERE status = 'failed' AND "createdAt" >= $1
            )::int AS "failedInWindowCount",
            COUNT(*) FILTER (
              WHERE status = 'retrying' AND "createdAt" >= $1
            )::int AS "retryingInWindowCount",
            COUNT(*) FILTER (
              WHERE status = 'pending' AND "createdAt" < $2
            )::int AS "stalePendingCount"
          FROM bridge_events
        `,
        [windowStartedAt, staleBefore],
      ),
      this.dataSource.query(`
        SELECT
          COUNT(*)::int AS "totalCount",
          COUNT(*) FILTER (WHERE "isEnabled" = true)::int AS "enabledCount",
          COUNT(*) FILTER (
            WHERE "isEnabled" = true
              AND LOWER("healthStatus") IN ('ready', 'healthy', 'online', 'available', 'ok')
          )::int AS "healthyCount",
          COUNT(*) FILTER (
            WHERE "isEnabled" = true
              AND LOWER("healthStatus") NOT IN ('ready', 'healthy', 'online', 'available', 'ok')
          )::int AS "unhealthyCount"
        FROM runtime_bindings
      `),
      this.dataSource.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS "inWindowCount",
            COUNT(*) FILTER (
              WHERE status = 'failed' AND "createdAt" >= $1
            )::int AS "failedInWindowCount",
            COUNT(*) FILTER (
              WHERE status IN ('queued', 'started') AND "updatedAt" < $2
            )::int AS "staleActiveCount"
          FROM runtime_dispatches
        `,
        [windowStartedAt, staleBefore],
      ),
      this.dataSource.query(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE "eventType" LIKE 'marketplace.%.oauth.denied'
                AND "createdAt" >= $1
            )::int AS "deniedInWindowCount",
            COUNT(*) FILTER (
              WHERE (
                "eventType" LIKE 'marketplace.%.oauth.refresh_failed'
                OR "eventType" LIKE 'marketplace.%.token.refresh_failed'
              ) AND "createdAt" >= $1
            )::int AS "refreshFailedInWindowCount"
          FROM audit_logs
        `,
        [windowStartedAt],
      ),
      this.dataSource.query(`
        SELECT
          COUNT(*)::int AS "totalCount",
          COUNT(*) FILTER (WHERE status = 'ready')::int AS "readyCount",
          COUNT(*) FILTER (WHERE status = 'error')::int AS "errorCount",
          COUNT(*) FILTER (WHERE status = 'needs_credentials')::int AS "needsCredentialsCount"
        FROM marketplace_connections
      `),
    ]);

    const bridgeDevices = this.first(bridgeDeviceRows);
    const bridgeEvents = this.first(bridgeEventRows);
    const runtimeBindings = this.first(runtimeBindingRows);
    const runtimeDispatches = this.first(runtimeDispatchRows);
    const oauth = this.first(oauthRows);
    const marketplaceConnections = this.first(marketplaceConnectionRows);
    const alerts = [
      ...(this.asCount(bridgeEvents.failedInWindowCount) > 0
        ? ["BRIDGE_EVENT_FAILURES"]
        : []),
      ...(this.asCount(bridgeEvents.stalePendingCount) > 0
        ? ["BRIDGE_EVENTS_STUCK"]
        : []),
      ...(this.asCount(runtimeDispatches.staleActiveCount) > 0
        ? ["RUNTIME_DISPATCHES_STUCK"]
        : []),
      ...(this.asCount(oauth.refreshFailedInWindowCount) > 0
        ? ["OAUTH_REFRESH_FAILURES"]
        : []),
    ];

    return {
      schemaVersion: "relay.operations-observability.v1",
      generatedAt: now.toISOString(),
      status: alerts.length > 0 ? "attention" : "healthy",
      window: {
        hours: windowHours,
        startedAt: windowStartedAt.toISOString(),
        bridgeRecentMinutes,
        staleEventMinutes,
      },
      bridge: {
        devices: this.counts(bridgeDevices, [
          "totalCount",
          "activeCount",
          "revokedCount",
          "recentCount",
          "staleCount",
          "neverSeenCount",
        ]),
        events: this.counts(bridgeEvents, [
          "inWindowCount",
          "failedInWindowCount",
          "retryingInWindowCount",
          "stalePendingCount",
        ]),
        offlineDevicesAreCustomerAvailabilitySignals: true,
      },
      runtimes: {
        bindings: this.counts(runtimeBindings, [
          "totalCount",
          "enabledCount",
          "healthyCount",
          "unhealthyCount",
        ]),
        dispatches: this.counts(runtimeDispatches, [
          "inWindowCount",
          "failedInWindowCount",
          "staleActiveCount",
        ]),
      },
      marketplace: {
        oauth: this.counts(oauth, [
          "deniedInWindowCount",
          "refreshFailedInWindowCount",
        ]),
        connections: this.counts(marketplaceConnections, [
          "totalCount",
          "readyCount",
          "errorCount",
          "needsCredentialsCount",
        ]),
        deniedConsentIsNotAnOperationalAlert: true,
      },
      alerts,
      privacy: {
        workspaceIdsIncluded: false,
        customerIdentifiersIncluded: false,
        deviceIdentifiersIncluded: false,
        providerConnectionIdentifiersIncluded: false,
        eventPayloadsIncluded: false,
        errorMessagesIncluded: false,
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

  private counts(row: Record<string, unknown>, keys: string[]) {
    return Object.fromEntries(keys.map((key) => [key, this.asCount(row[key])]));
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
