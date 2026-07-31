import { WaitlistService } from './waitlist.service'

describe('WaitlistService', () => {
  it('persists or refreshes landing-page waitlist signups by email', async () => {
    const waitlistEntries = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'waitlist-001',
          email: 'alex@example.com',
        },
      ]),
    }
    const service = new WaitlistService(waitlistEntries as any)

    const result = await service.createOrRefreshSignup(
      {
        email: ' Alex@Example.com ',
        source: ' landing ',
      },
      {
        origin: 'https://beta.clawchat.example',
        userAgent: 'Test Browser',
        ipAddress: '203.0.113.40',
      },
    )

    expect(result).toEqual({
      id: 'waitlist-001',
      email: 'alex@example.com',
    })
    expect(waitlistEntries.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (email) DO UPDATE'),
      [
        'alex@example.com',
        'landing',
        'https://beta.clawchat.example',
        'Test Browser',
        '203.0.113.40',
      ],
    )
  })
})
