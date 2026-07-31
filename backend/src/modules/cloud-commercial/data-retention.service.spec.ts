import { DataRetentionService } from './data-retention.service'

describe('DataRetentionService', () => {
  it('purges auth audit earlier than general audit, billing, and account tokens', async () => {
    const query = jest.fn().mockResolvedValue([[], 2])
    const manager = { query }
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => unknown) =>
          callback(manager),
      ),
    } as any
    const config = { get: jest.fn(() => undefined) } as any
    const service = new DataRetentionService(dataSource, config)

    const result = await service.purgeExpiredRecords(
      new Date('2026-07-14T12:00:00.000Z'),
    )

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`"eventType" LIKE 'auth.%'`),
      [new Date('2026-06-14T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM audit_logs'),
      [new Date('2026-04-15T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE runtime_dispatches'),
      [new Date('2026-07-13T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('DELETE FROM runtime_dispatches'),
      [new Date('2026-06-14T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('DELETE FROM relay_workspace_changes'),
      [new Date('2026-07-07T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('DELETE FROM relay_client_mutation_receipts'),
      [new Date('2026-06-14T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("status IN ('processed', 'ignored', 'failed')"),
      [new Date('2019-07-14T12:00:00.000Z')],
    )
    expect(query).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining('DELETE FROM account_action_tokens'),
      [new Date('2026-07-07T12:00:00.000Z')],
    )
    expect(result).toMatchObject({
      authAuditRecordsDeleted: 2,
      auditRecordsDeleted: 2,
      dispatchPayloadsCompacted: 2,
      runtimeDispatchesDeleted: 2,
      syncChangesDeleted: 2,
      mutationReceiptsDeleted: 2,
      billingEventsDeleted: 2,
      accountTokensDeleted: 2,
    })
  })

  it('accepts positive configured retention periods and rejects unsafe values', async () => {
    const query = jest.fn().mockResolvedValue([[], 0])
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: { query: typeof query }) => unknown) =>
          callback({ query }),
      ),
    } as any
    const config = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              RELAY_AUDIT_RETENTION_DAYS: '30',
              RELAY_AUTH_AUDIT_RETENTION_DAYS: '14',
              RELAY_BILLING_LEDGER_RETENTION_DAYS: '365',
              RELAY_ACCOUNT_TOKEN_CLEANUP_DAYS: '0',
              RELAY_RUNTIME_DISPATCH_PAYLOAD_RETENTION_DAYS: '2',
              RELAY_RUNTIME_DISPATCH_RETENTION_DAYS: '14',
              RELAY_SYNC_CHANGE_RETENTION_DAYS: '3',
            }) as Record<string, string>
          )[key],
      ),
    } as any
    const service = new DataRetentionService(dataSource, config)

    await service.purgeExpiredRecords(new Date('2026-07-14T12:00:00.000Z'))

    expect(query.mock.calls[0][1][0]).toEqual(
      new Date('2026-06-30T12:00:00.000Z'),
    )
    expect(query.mock.calls[1][1][0]).toEqual(
      new Date('2026-06-14T12:00:00.000Z'),
    )
    expect(query.mock.calls[2][1][0]).toEqual(
      new Date('2026-07-12T12:00:00.000Z'),
    )
    expect(query.mock.calls[3][1][0]).toEqual(
      new Date('2026-06-30T12:00:00.000Z'),
    )
    expect(query.mock.calls[4][1][0]).toEqual(
      new Date('2026-07-11T12:00:00.000Z'),
    )
    expect(query.mock.calls[5][1][0]).toEqual(
      new Date('2026-06-30T12:00:00.000Z'),
    )
    expect(query.mock.calls[6][1][0]).toEqual(
      new Date('2025-07-14T12:00:00.000Z'),
    )
    expect(query.mock.calls[7][1][0]).toEqual(
      new Date('2026-07-07T12:00:00.000Z'),
    )
  })

  it('does not accept retention values above the privacy maxima', async () => {
    const query = jest.fn().mockResolvedValue([[], 0])
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: { query: typeof query }) => unknown) =>
          callback({ query }),
      ),
    } as any
    const config = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              RELAY_AUTH_AUDIT_RETENTION_DAYS: '31',
              RELAY_AUDIT_RETENTION_DAYS: '365',
            }) as Record<string, string>
          )[key],
      ),
    } as any
    const service = new DataRetentionService(dataSource, config)

    await service.purgeExpiredRecords(new Date('2026-07-14T12:00:00.000Z'))

    expect(query.mock.calls[0][1][0]).toEqual(
      new Date('2026-06-14T12:00:00.000Z'),
    )
    expect(query.mock.calls[1][1][0]).toEqual(
      new Date('2026-04-15T12:00:00.000Z'),
    )
  })
})
