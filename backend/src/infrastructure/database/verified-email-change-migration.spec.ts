import { AddVerifiedEmailChangeWorkflow1785182600069 } from '../../migrations/069_add_verified_email_change_workflow'

describe('AddVerifiedEmailChangeWorkflow migration', () => {
  it('creates a hashed, expiring, one-active-request schema', async () => {
    const query = jest.fn().mockResolvedValue(undefined)
    await new AddVerifiedEmailChangeWorkflow1785182600069().up({
      query,
    } as never)

    const sql = query.mock.calls.map(([statement]) => statement).join('\n')
    expect(sql).toContain('CREATE TABLE "email_change_requests"')
    expect(sql).toContain('"tokenHash" varchar(64) NOT NULL')
    expect(sql).not.toMatch(/"token"\s/)
    expect(sql).toContain('"expiresAt" timestamptz NOT NULL')
    expect(sql).toContain('"completedAt" IS NULL AND "cancelledAt" IS NULL')
    expect(sql).toContain('"UQ_email_change_active_user"')
    expect(sql).toContain('"UQ_email_change_active_new_email"')
    expect(sql).toContain('"currentEmail" = lower("currentEmail")')
  })

  it('has a deterministic rollback that removes only the new table', async () => {
    const query = jest.fn().mockResolvedValue(undefined)
    await new AddVerifiedEmailChangeWorkflow1785182600069().down({
      query,
    } as never)

    expect(query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "email_change_requests"',
    )
  })
})
