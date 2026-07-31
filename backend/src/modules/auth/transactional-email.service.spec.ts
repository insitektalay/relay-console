import { TransactionalEmailService } from './transactional-email.service'

describe('TransactionalEmailService', () => {
  const values: Record<string, string> = {
    RELAY_TRANSACTIONAL_EMAIL_ENABLED: 'true',
    RESEND_API_KEY: 're_test_server_only',
    RELAY_EMAIL_FROM: 'Relay Console <account@relayconsole.work>',
    RELAY_PUBLIC_WEB_ORIGIN: 'https://relayconsole.work',
  }

  afterEach(() => jest.restoreAllMocks())

  it('sends a bounded one-time reset link through Resend without exposing the API key', async () => {
    const config = { get: jest.fn((key: string) => values[key]) } as any
    const service = new TransactionalEmailService(config)
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-1' }),
    } as Response)

    await service.sendPasswordReset(
      'person@example.com',
      'Person <Admin>',
      'one-time-reset-token',
    )

    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer re_test_server_only',
    })
    const body = JSON.parse(String(request?.body))
    expect(body.to).toEqual(['person@example.com'])
    expect(body.text).toContain('reset_password=one-time-reset-token')
    expect(body.html).toContain('Person &lt;Admin&gt;')
    expect(JSON.stringify(body)).not.toContain('re_test_server_only')
  })

  it('fails closed when transactional email is disabled', async () => {
    const config = { get: jest.fn((key: string) =>
      key === 'RELAY_TRANSACTIONAL_EMAIL_ENABLED' ? 'false' : values[key],
    ) } as any
    const service = new TransactionalEmailService(config)

    await expect(service.sendEmailVerification(
      'person@example.com', 'Person', 'verification-token',
    )).rejects.toThrow('TRANSACTIONAL_EMAIL_NOT_ENABLED')
  })

  it('sends a one-time new-address link and a separate old-address warning', async () => {
    const config = { get: jest.fn((key: string) => values[key]) } as any
    const service = new TransactionalEmailService(config)
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-1' }),
    } as Response)

    await service.sendEmailChangeVerification(
      'new@example.com',
      'Person',
      'one-time-email-change-token',
    )
    await service.sendEmailChangeSecurityNotice(
      'current@example.com',
      'Person',
    )

    const verificationBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    )
    const warningBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(verificationBody.to).toEqual(['new@example.com'])
    expect(verificationBody.text).toContain(
      'change_email=one-time-email-change-token',
    )
    expect(warningBody.to).toEqual(['current@example.com'])
    expect(warningBody.text).not.toContain('new@example.com')
    expect(warningBody.text).not.toContain('one-time-email-change-token')
  })
})
