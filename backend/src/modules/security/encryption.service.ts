import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export interface EncryptedValue {
  ciphertext: string
  iv: string
  authTag: string
  keyVersion: string
}

@Injectable()
export class EncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encryptString(value: string): EncryptedValue {
    const material = this.getActiveKeyMaterial()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', material.key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyVersion: material.version,
    }
  }

  decryptString(payload: EncryptedValue): string {
    const material = this.getKeyMaterial(payload.keyVersion)
    const decipher = createDecipheriv(
      'aes-256-gcm',
      material.key,
      Buffer.from(payload.iv, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ])

    return plaintext.toString('utf8')
  }

  private getActiveKeyMaterial() {
    const version =
      this.configService.get<string>('APP_ENCRYPTION_KEY_VERSION') || 'v1'
    return this.getKeyMaterial(version)
  }

  private getKeyMaterial(version: string) {
    const directKey = this.configService.get<string>('APP_ENCRYPTION_KEY')
    const configuredVersion =
      this.configService.get<string>('APP_ENCRYPTION_KEY_VERSION') || 'v1'

    if (directKey && version === configuredVersion) {
      return {
        version,
        key: this.parseKey(directKey),
      }
    }

    const keyMap = this.parseVersionedKeys(
      this.configService.get<string>('APP_ENCRYPTION_KEYS'),
    )
    const resolved = keyMap.get(version)
    if (!resolved) {
      throw new InternalServerErrorException(
        'Secret encryption is not configured on the server. Ask an admin to configure encryption before saving credentials.',
      )
    }

    return {
      version,
      key: this.parseKey(resolved),
    }
  }

  private parseVersionedKeys(raw?: string) {
    const keys = new Map<string, string>()

    for (const entry of (raw || '').split(',')) {
      const trimmed = entry.trim()
      if (!trimmed) continue
      const separatorIndex = trimmed.indexOf(':')
      if (separatorIndex <= 0) continue
      const version = trimmed.slice(0, separatorIndex)
      const key = trimmed.slice(separatorIndex + 1)
      if (!version || !key) continue
      keys.set(version.trim(), key.trim())
    }

    return keys
  }

  private parseKey(value: string) {
    const normalized = value.trim()
    if (normalized.startsWith('base64:')) {
      return this.requireValidKey(
        this.parseBase64Key(normalized.slice('base64:'.length).trim()),
      )
    }

    if (normalized.startsWith('utf8:')) {
      return this.requireValidKey(
        Buffer.from(normalized.slice('utf8:'.length), 'utf8'),
      )
    }

    const base64Key = this.parseBase64Key(normalized)
    if (base64Key?.length === 32) {
      return base64Key
    }

    return this.requireValidKey(Buffer.from(normalized, 'utf8'))
  }

  private parseBase64Key(value: string) {
    const normalized = value.trim()
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null
    if (normalized.length % 4 === 1) return null
    const buffer = Buffer.from(normalized, 'base64')
    const withoutPadding = (candidate: string) => candidate.replace(/=+$/, '')
    if (withoutPadding(buffer.toString('base64')) !== withoutPadding(normalized)) {
      return null
    }
    return buffer
  }

  private requireValidKey(buffer: Buffer | null) {
    if (!buffer || buffer.length !== 32) {
      throw new InternalServerErrorException(
        'Application encryption key must be exactly 32 bytes',
      )
    }

    return buffer
  }
}
