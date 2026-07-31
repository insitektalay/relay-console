import { ConfigService } from '@nestjs/config'
import { MarketplaceConnectionEntity } from '../../../entities'
import { EncryptionService } from '../../security/encryption.service'
import { MarketplaceConnectorCredentialService } from './connector-credential.service'

describe('MarketplaceConnectorCredentialService key rotation', () => {
  function encryption(values: Record<string, string>) {
    return new EncryptionService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService)
  }

  it('reads old stored credentials and writes only with the new active key', () => {
    const oldKey = Buffer.alloc(32, 21).toString('base64')
    const nextKey = Buffer.alloc(32, 22).toString('base64')
    const oldCredentials = new MarketplaceConnectorCredentialService(encryption({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${oldKey}`,
    }))
    const rotatedCredentials = new MarketplaceConnectorCredentialService(encryption({
      APP_ENCRYPTION_KEY_VERSION: 'v2',
      APP_ENCRYPTION_KEY: `base64:${nextKey}`,
      APP_ENCRYPTION_KEYS: `v1:base64:${oldKey},v2:base64:${nextKey}`,
    }))
    const connection = {
      workspaceId: 'workspace-1',
      appSlug: 'example',
      secretCiphertext: null,
      secretIv: null,
      secretAuthTag: null,
      secretKeyVersion: null,
    } as MarketplaceConnectionEntity

    oldCredentials.applyEncrypted(connection, { apiKey: 'old-customer-key' })
    expect(connection.secretKeyVersion).toBe('v1')
    expect(rotatedCredentials.decrypt(connection)).toEqual({ apiKey: 'old-customer-key' })

    rotatedCredentials.applyEncrypted(connection, { apiKey: 'rotated-customer-key' })
    expect(connection.secretKeyVersion).toBe('v2')
    expect(rotatedCredentials.decrypt(connection)).toEqual({ apiKey: 'rotated-customer-key' })
    expect(JSON.stringify(connection)).not.toContain('customer-key')
  })

  it('binds new encrypted credentials to the owning workspace and provider', () => {
    const service = new MarketplaceConnectorCredentialService(encryption({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 25).toString('base64')}`,
    }))
    const connection = {
      workspaceId: 'workspace-1',
      appSlug: 'example',
      secretCiphertext: null,
      secretIv: null,
      secretAuthTag: null,
      secretKeyVersion: null,
    } as MarketplaceConnectionEntity
    service.applyEncrypted(connection, { apiKey: 'bound-secret' })

    expect(service.decrypt(connection)).toEqual({ apiKey: 'bound-secret' })
    expect(() => service.decrypt({
      ...connection,
      workspaceId: 'workspace-2',
    } as MarketplaceConnectionEntity)).toThrow('credential_decrypt_failed')
    expect(() => service.decrypt({
      ...connection,
      appSlug: 'different-provider',
    } as MarketplaceConnectionEntity)).toThrow('credential_decrypt_failed')
  })

  it('fails closed after an old key is deliberately removed from the key ring', () => {
    const oldKey = Buffer.alloc(32, 23).toString('base64')
    const nextKey = Buffer.alloc(32, 24).toString('base64')
    const oldCredentials = new MarketplaceConnectorCredentialService(encryption({
      APP_ENCRYPTION_KEY_VERSION: 'v1',
      APP_ENCRYPTION_KEY: `base64:${oldKey}`,
    }))
    const afterRetirement = new MarketplaceConnectorCredentialService(encryption({
      APP_ENCRYPTION_KEY_VERSION: 'v2',
      APP_ENCRYPTION_KEY: `base64:${nextKey}`,
      APP_ENCRYPTION_KEYS: `v2:base64:${nextKey}`,
    }))
    const connection = {
      workspaceId: 'workspace-1',
      appSlug: 'example',
    } as MarketplaceConnectionEntity
    oldCredentials.applyEncrypted(connection, { token: 'retired-key-secret' })

    expect(() => afterRetirement.decrypt(connection)).toThrow('credential_decrypt_failed')
  })
})
