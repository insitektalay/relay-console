import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '../../../..')

function readDoc(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

describe('beta auth lifecycle docs', () => {
  it('documents public beta auth and account lifecycle support paths', () => {
    const content = readDoc('docs/beta-auth-account-lifecycle.md')

    expect(content).toContain('CLAWCHAT_BETA_SIGNUP_MODE=invite')
    expect(content).toContain('CLAWCHAT_BETA_INVITE_CODES')
    expect(content).toContain('/api/v1/auth/web/register')
    expect(content).toContain('/api/v1/auth/web/login')
    expect(content).toContain('/api/v1/auth/web/refresh')
    expect(content).toContain('/api/v1/auth/web/logout')
    expect(content).toContain('x-csrf-token')
    expect(content).toContain('SameSite=Lax')
    expect(content).toContain('Authorization: Bearer')
    expect(content).toContain('/api/v1/waitlist')
    expect(content).toContain('/api/v1/auth/password-reset/request')
    expect(content).toContain('/api/v1/auth/account/export')
    expect(content).toContain('DELETE /api/v1/auth/account')
  })

  it('documents invite-code issue, rotate, and revoke through Railway env management', () => {
    const content = readDoc('docs/beta-auth-account-lifecycle.md')

    expect(content).toContain('There is no in-app invite-code admin API')
    expect(content).toContain('Issue: generate a new high-entropy beta invite seed')
    expect(content).toContain('bounded `beta_invites` records')
    expect(content).toContain('auth.invite.accepted')
    expect(content).toContain('rejects later reuse')
    expect(content).toContain('Rotate: add a new seed first')
    expect(content).toContain('Revoke: remove the seed')
    expect(content).toContain('Railway backend')
    expect(content).toContain('Do not print invite-code values')
  })

  it('documents the self-service reset, export, and deletion operating model', () => {
    const content = readDoc('docs/beta-auth-account-lifecycle.md')

    expect(content).toContain('Password reset and email verification are self-service')
    expect(content).toContain('30 minutes')
    expect(content).toContain("eventType = 'auth.password_reset.requested'")
    expect(content).toContain("actorType = 'anonymous'")
    expect(content).toContain('genuine self-service operations')
    expect(content).toContain('current password')
    expect(content).toContain('pseudonymized')
    expect(content).toContain('retention schedule')
  })

  it('links the lifecycle runbook from beta operations and roadmap docs', () => {
    expect(readDoc('docs/BETA_OPERATIONS.md')).toContain(
      'docs/beta-auth-account-lifecycle.md',
    )
    expect(readDoc('web/docs/beta-launch-roadmap.md')).toContain(
      '../../docs/beta-auth-account-lifecycle.md',
    )
  })
})
