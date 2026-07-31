import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'

const DAY_MS = 86_400_000

@Injectable()
export class DataRetentionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 3 * * *')
  async purgeExpiredRecords(now = new Date()) {
    const authAuditCutoff = new Date(
      now.getTime() -
        this.days('RELAY_AUTH_AUDIT_RETENTION_DAYS', 30, 30) * DAY_MS,
    )
    const auditCutoff = new Date(
      now.getTime() - this.days('RELAY_AUDIT_RETENTION_DAYS', 90, 90) * DAY_MS,
    )
    const dispatchPayloadCutoff = new Date(
      now.getTime() -
        this.days('RELAY_RUNTIME_DISPATCH_PAYLOAD_RETENTION_DAYS', 1, 7) *
          DAY_MS,
    )
    const dispatchCutoff = new Date(
      now.getTime() -
        this.days('RELAY_RUNTIME_DISPATCH_RETENTION_DAYS', 30, 30) * DAY_MS,
    )
    const syncChangeCutoff = new Date(
      now.getTime() -
        this.days('RELAY_SYNC_CHANGE_RETENTION_DAYS', 7, 30) * DAY_MS,
    )
    const billingCutoff = new Date(
      now.getTime() -
        this.days('RELAY_BILLING_LEDGER_RETENTION_DAYS', 2557, 2557) * DAY_MS,
    )
    const tokenCutoff = new Date(
      now.getTime() -
        this.days('RELAY_ACCOUNT_TOKEN_CLEANUP_DAYS', 7, 30) * DAY_MS,
    )

    return this.dataSource.transaction(async (manager) => {
      const authAudit = (await manager.query(
        `DELETE FROM audit_logs
         WHERE "eventType" LIKE 'auth.%' AND "createdAt" < $1`,
        [authAuditCutoff],
      )) as [unknown[], number]
      const audit = (await manager.query(
        `DELETE FROM audit_logs WHERE "createdAt" < $1`,
        [auditCutoff],
      )) as [unknown[], number]
      const dispatchPayloads = (await manager.query(
        `UPDATE runtime_dispatches
         SET "resultSummary" = NULL,
             "resultMetadata" = '{}'::jsonb,
             "updatedAt" = "updatedAt"
         WHERE status IN ('completed', 'failed', 'cancelled')
           AND "updatedAt" < $1
           AND ("resultSummary" IS NOT NULL OR "resultMetadata" <> '{}'::jsonb)`,
        [dispatchPayloadCutoff],
      )) as [unknown[], number]
      const dispatches = (await manager.query(
        `DELETE FROM runtime_dispatches
         WHERE status IN ('completed', 'failed', 'cancelled')
           AND "updatedAt" < $1`,
        [dispatchCutoff],
      )) as [unknown[], number]
      const syncChanges = (await manager.query(
        `DELETE FROM relay_workspace_changes AS change
         WHERE change."createdAt" < $1
           AND change.sequence < (
             SELECT MAX(latest.sequence)
             FROM relay_workspace_changes AS latest
             WHERE latest."workspaceId" = change."workspaceId"
           )`,
        [syncChangeCutoff],
      )) as [unknown[], number]
      const mutationReceipts = (await manager.query(
        `DELETE FROM relay_client_mutation_receipts
         WHERE "createdAt" < $1`,
        [dispatchCutoff],
      )) as [unknown[], number]
      const billing = (await manager.query(
        `DELETE FROM relay_billing_events
         WHERE "createdAt" < $1 AND status IN ('processed', 'ignored', 'failed')`,
        [billingCutoff],
      )) as [unknown[], number]
      const tokens = (await manager.query(
        `DELETE FROM account_action_tokens WHERE "expiresAt" < $1`,
        [tokenCutoff],
      )) as [unknown[], number]
      return {
        authAuditRecordsDeleted: this.affected(authAudit),
        auditRecordsDeleted: this.affected(audit),
        dispatchPayloadsCompacted: this.affected(dispatchPayloads),
        runtimeDispatchesDeleted: this.affected(dispatches),
        syncChangesDeleted: this.affected(syncChanges),
        mutationReceiptsDeleted: this.affected(mutationReceipts),
        billingEventsDeleted: this.affected(billing),
        accountTokensDeleted: this.affected(tokens),
        cutoffs: {
          authAudit: authAuditCutoff,
          audit: auditCutoff,
          dispatchPayload: dispatchPayloadCutoff,
          dispatch: dispatchCutoff,
          syncChange: syncChangeCutoff,
          billing: billingCutoff,
          accountTokens: tokenCutoff,
        },
      }
    })
  }

  private days(key: string, fallback: number, maximum: number) {
    const value = Number(this.config.get<string | number>(key))
    return Number.isInteger(value) && value > 0 && value <= maximum
      ? value
      : fallback
  }

  private affected(result: [unknown[], number] | unknown) {
    return Array.isArray(result) && typeof result[1] === 'number'
      ? result[1]
      : 0
  }
}
