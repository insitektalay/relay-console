import type { MarketplaceConnectionEntity } from "../../entities";

const MARKETPLACE_CREDENTIAL_ENVELOPE_SCHEMA =
  "relay.marketplace-credentials.v2";

type MarketplaceCredentialBinding = Pick<
  MarketplaceConnectionEntity,
  "workspaceId" | "appSlug"
>;

export function encodeMarketplaceCredentialEnvelope(
  binding: MarketplaceCredentialBinding,
  credentials: Record<string, unknown>,
) {
  return JSON.stringify({
    schemaVersion: MARKETPLACE_CREDENTIAL_ENVELOPE_SCHEMA,
    binding: {
      workspaceId: binding.workspaceId,
      appSlug: binding.appSlug,
    },
    credentials,
  });
}

export function decodeMarketplaceCredentialEnvelope(
  binding: MarketplaceCredentialBinding,
  plaintext: string,
): Record<string, unknown> {
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid encrypted credential payload");
  }
  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== MARKETPLACE_CREDENTIAL_ENVELOPE_SCHEMA) {
    // Legacy encrypted rows remain readable until the customer next rotates
    // or replaces the credential, at which point they are written as v2.
    return value;
  }
  const envelopeBinding = value.binding as Record<string, unknown> | undefined;
  const credentials = value.credentials;
  if (
    envelopeBinding?.workspaceId !== binding.workspaceId ||
    envelopeBinding?.appSlug !== binding.appSlug ||
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  ) {
    throw new Error("credential_binding_mismatch");
  }
  return credentials as Record<string, unknown>;
}
