import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CompleteEmailChangeDto, RequestEmailChangeDto } from './email-change.dto'
import { UpdateProfileDto } from './update-profile.dto'

const strictValidate = (instance: object) =>
  validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })

describe('verified email-change DTO security', () => {
  it('rejects direct profile email mutation before service execution', async () => {
    const errors = await strictValidate(
      plainToInstance(UpdateProfileDto, {
        name: 'Alice',
        email: 'attacker@example.com',
      }),
    )

    expect(JSON.stringify(errors)).toContain('email')
    expect(JSON.stringify(errors)).toContain('should not exist')
  })

  it('accepts only the bounded reauthentication request contract', async () => {
    await expect(
      strictValidate(
        plainToInstance(RequestEmailChangeDto, {
          newEmail: 'new-owner@example.com',
          currentPassword: 'correct horse battery staple',
        }),
      ),
    ).resolves.toEqual([])
  })

  it('rejects malformed addresses and unknown request fields', async () => {
    const errors = await strictValidate(
      plainToInstance(RequestEmailChangeDto, {
        newEmail: 'not-an-email',
        currentPassword: 'password',
        userId: 'another-user',
      }),
    )

    expect(JSON.stringify(errors)).toContain('newEmail')
    expect(JSON.stringify(errors)).toContain('userId')
  })

  it('accepts a bounded opaque completion token and rejects extra fields', async () => {
    await expect(
      strictValidate(
        plainToInstance(CompleteEmailChangeDto, {
          token: 'A'.repeat(43),
        }),
      ),
    ).resolves.toEqual([])

    const errors = await strictValidate(
      plainToInstance(CompleteEmailChangeDto, {
        token: 'A'.repeat(43),
        email: 'attacker@example.com',
      }),
    )
    expect(JSON.stringify(errors)).toContain('email')
  })
})
