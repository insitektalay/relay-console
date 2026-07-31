import { ConfigService } from '@nestjs/config'
import { EncryptionService } from './encryption.service'

describe('EncryptionService', () => {
  function createService(values: Record<string, string | undefined>) {
    return new EncryptionService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService)
  }

  it('round-trips encrypted secrets with explicit base64 application keys', () => {
    const service = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 7).toString('base64')}`,
    })

    const plaintext = 'super-secret-api-key'
    const encrypted = service.encryptString(plaintext)

    expect(encrypted.keyVersion).toBe('v1')
    expect(encrypted.ciphertext).not.toContain(plaintext)
    expect(encrypted.iv).not.toContain(plaintext)
    expect(encrypted.authTag).not.toContain(plaintext)
    expect(service.decryptString(encrypted)).toBe(plaintext)
  })

  it('decrypts old ciphertext from the key ring after active key rotation', () => {
    const oldKey = Buffer.alloc(32, 1).toString('base64')
    const nextKey = Buffer.alloc(32, 2).toString('base64')
    const oldService = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${oldKey}`,
    })
    const rotatedService = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v2',
      APP_ENCRYPTION_KEY: `base64:${nextKey}`,
      APP_ENCRYPTION_KEYS: `v1:base64:${oldKey},v2:base64:${nextKey}`,
    })

    const oldEncrypted = oldService.encryptString('rotated-secret')
    const nextEncrypted = rotatedService.encryptString('next-secret')

    expect(oldEncrypted.keyVersion).toBe('v1')
    expect(rotatedService.decryptString(oldEncrypted)).toBe('rotated-secret')
    expect(nextEncrypted.keyVersion).toBe('v2')
    expect(rotatedService.decryptString(nextEncrypted)).toBe('next-secret')
  })

  it('accepts unprefixed 32-byte utf8 keys that look base64-like', () => {
    const service = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    const encrypted = service.encryptString('utf8-secret')

    expect(service.decryptString(encrypted)).toBe('utf8-secret')
  })

  it('uses a random iv so repeat encryption produces distinct payloads', () => {
    const service = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 3).toString('base64')}`,
    })

    const first = service.encryptString('same-secret')
    const second = service.encryptString('same-secret')

    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
    expect(service.decryptString(first)).toBe('same-secret')
    expect(service.decryptString(second)).toBe('same-secret')
  })

  it('rejects invalid key lengths without echoing configured key material', () => {
    const badKey = 'short-secret-key'
    const service = createService({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: badKey,
    })

    expect(() => service.encryptString('secret')).toThrow(
      'Application encryption key must be exactly 32 bytes',
    )
    try {
      service.encryptString('secret')
    } catch (error) {
      expect(String(error)).not.toContain(badKey)
    }
  })
})
