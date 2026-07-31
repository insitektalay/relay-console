import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '../../../..')

function readDoc(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

describe('beta support incident runbooks', () => {
  it('documents bridge pairing failure support without collecting secrets', () => {
    const content = readDoc('docs/beta-support-incident-runbooks.md')

    expect(content).toContain('Bridge Pairing Failure')
    expect(content).toContain('bridge.enrollment.failed')
    expect(content).toContain('bridge.device.auth.failed')
    expect(content).toContain('POST /api/v1/bridge/devices/<device-id>/revoke')
    expect(content).toContain(
      'POST /api/v1/bridge/workspaces/<workspace-id>/devices/revoke-all',
    )
    expect(content).toContain('Do not ask testers to paste pairing codes')
    expect(content).toContain('Do not point beta web, API, or websocket traffic at a loopback backend')
  })

  it('documents marketplace removal containment and rollback using supported controls', () => {
    const content = readDoc('docs/beta-support-incident-runbooks.md')

    expect(content).toContain('Marketplace App Removal Incident')
    expect(content).toContain('CLAWCHAT_MARKETPLACE_BLOCKED_APPS')
    expect(content).toContain('CLAWCHAT_MARKETPLACE_ALLOWED_APPS')
    expect(content).toContain('DELETE /api/v1/workspaces/<workspace-id>/marketplace/installs/<install-id>')
    expect(content).toContain('marketplace.install.unconfigured')
    expect(content).toContain('Do not claim containment is live until the Railway backend deployment')
    expect(content).toContain('Do not delete production database rows as a rollback step')
    expect(content).toContain('Rollback Criteria')
  })

  it('covers every production support and incident journey with scoped recovery controls', () => {
    const content = readDoc('docs/beta-support-incident-runbooks.md')

    for (const heading of [
      'Login, Verification, And Password-Reset Failure',
      'Billing And Entitlement Failure',
      'Bridge Pairing Failure',
      'Runtime Offline Or Not Responding',
      'Marketplace OAuth Or Connection Failure',
      'Compromised Runtime Device',
      'Compromised Marketplace Provider Connection',
      'Account Export And Deletion Support',
      'Marketplace App Removal Incident',
      'Relay Control Plane Or Web Outage',
      'Backup Restore Or Data-Recovery Incident',
    ]) {
      expect(content).toContain(`## ${heading}`)
    }

    for (const supportedControl of [
      'POST /api/v1/auth/password-reset/request',
      'GET /api/v1/workspaces/<workspace-id>/billing/status',
      'GET /api/v1/workspaces/<workspace-id>/agent-ops/runtime-overview',
      'POST /api/v1/bridge/devices/<device-id>/revoke',
      'POST /api/v1/workspaces/<workspace-id>/marketplace/connectors/<slug>/connections/<connection-id>/oauth/reauthorize',
      'POST /api/v1/workspaces/<workspace-id>/marketplace/connectors/<slug>/connections/<connection-id>/disconnect',
      'GET /api/v1/auth/account/export',
      'DELETE /api/v1/auth/account',
      'npm run cloud:restore',
    ]) {
      expect(content).toContain(supportedControl)
    }

    expect(content).toContain('Do not synthesize provider events or edit subscription or')
    expect(content).toContain('Never create a second execution just')
    expect(content).toContain('A Relay-side disconnect is not proof of provider-side revocation')
    expect(content).toContain('Do not switch')
    expect(content).toContain('the web application to a local or loopback backend')
    expect(content).toContain('Never test a restore by overwriting the live Railway')
  })

  it('links the runbooks from beta operations and roadmap docs', () => {
    expect(readDoc('docs/BETA_OPERATIONS.md')).toContain(
      'docs/beta-support-incident-runbooks.md',
    )
    expect(readDoc('web/docs/beta-launch-roadmap.md')).toContain(
      '../../docs/beta-support-incident-runbooks.md',
    )
  })
})
