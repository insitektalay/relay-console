import 'reflect-metadata'
import { validate } from 'class-validator'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

describe('native auth device identity contract', () => {
  it.each([
    ['iPhone', 'iOS'],
    ['iPad', 'iPadOS'],
    ['Mac', 'macOS'],
  ])('accepts bounded non-identifying %s metadata', async (deviceName, platform) => {
    const dto = Object.assign(new LoginDto(), {
      email: 'person@example.test',
      password: 'password',
      deviceName,
      platform,
    })
    await expect(validate(dto)).resolves.toEqual([])
  })

  it('rejects unsupported platforms and oversized device labels', async () => {
    const login = Object.assign(new LoginDto(), {
      email: 'person@example.test',
      password: 'password',
      deviceName: 'x'.repeat(81),
      platform: 'Windows',
    })
    const registration = Object.assign(new RegisterDto(), {
      email: 'person@example.test',
      name: 'Person',
      password: 'correct horse battery staple',
      deviceName: 'PC',
      platform: 'Linux',
    })

    const [loginErrors, registrationErrors] = await Promise.all([
      validate(login),
      validate(registration),
    ])
    expect(loginErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['deviceName', 'platform']),
    )
    expect(registrationErrors.map((error) => error.property)).toContain('platform')
  })
})
