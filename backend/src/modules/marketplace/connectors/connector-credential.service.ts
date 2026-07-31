import { Injectable } from "@nestjs/common";
import { MarketplaceConnectionEntity } from "../../../entities";
import { EncryptionService, type EncryptedValue } from "../../security/encryption.service";
import {
  decodeMarketplaceCredentialEnvelope,
  encodeMarketplaceCredentialEnvelope,
} from "../marketplace-credential-envelope";

export type StoredConnectorCredentials = Record<string, unknown>;

@Injectable()
export class MarketplaceConnectorCredentialService {
  constructor(private readonly encryptionService: EncryptionService) {}

  encrypt(credentials: StoredConnectorCredentials) {
    return this.encryptionService.encryptString(JSON.stringify(credentials));
  }

  decrypt(connection: MarketplaceConnectionEntity): StoredConnectorCredentials | null {
    if (
      !connection.secretCiphertext ||
      !connection.secretIv ||
      !connection.secretAuthTag ||
      !connection.secretKeyVersion
    ) {
      return null;
    }
    try {
      const raw = this.encryptionService.decryptString({
        ciphertext: connection.secretCiphertext,
        iv: connection.secretIv,
        authTag: connection.secretAuthTag,
        keyVersion: connection.secretKeyVersion,
      } satisfies EncryptedValue);
      return decodeMarketplaceCredentialEnvelope(connection, raw);
    } catch {
      throw new Error("credential_decrypt_failed");
    }
  }

  decryptEncrypted(payload: EncryptedValue) {
    return this.encryptionService.decryptString(payload);
  }

  applyEncrypted(
    connection: MarketplaceConnectionEntity,
    credentials: StoredConnectorCredentials,
  ) {
    const encrypted = this.encryptionService.encryptString(
      encodeMarketplaceCredentialEnvelope(connection, credentials),
    );
    connection.secretCiphertext = encrypted.ciphertext;
    connection.secretIv = encrypted.iv;
    connection.secretAuthTag = encrypted.authTag;
    connection.secretKeyVersion = encrypted.keyVersion;
  }
}
