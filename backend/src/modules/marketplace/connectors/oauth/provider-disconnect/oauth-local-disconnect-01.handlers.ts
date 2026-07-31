import type {
  OAuthLocalDisconnectHandler,
  OAuthLocalDisconnectHandlerMap,
} from "./oauth-provider-disconnect-handler";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";

const OAuthLocalDisconnect001: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "wiza",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "wiza_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Wiza API-key copy was deleted. Rotate the dedicated key in Wiza API settings.";
  connection.metadata = {
    provider: "wiza",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.wiza.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect002: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "uplead",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "uplead_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted UpLead API-key copy was deleted. Rotate the dedicated key in UpLead account settings.";
  connection.metadata = {
    provider: "uplead",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.uplead.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect003: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "rocketreach",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "rocketreach_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted RocketReach API-key copy was deleted. Rotate the dedicated key on the RocketReach API account page.";
  connection.metadata = {
    provider: "rocketreach",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.rocketreach.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect004: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "seamless-ai",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "seamless_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Seamless.AI API-key copy was deleted. Rotate the dedicated key in Seamless.AI Public API settings.";
  connection.metadata = {
    provider: "seamless-ai",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.seamless_ai.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect005: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "leadiq",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "leadiq_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted LeadIQ API-key copy was deleted. Rotate the dedicated key in LeadIQ Settings.";
  connection.metadata = {
    provider: "leadiq",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.leadiq.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect006: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "lusha",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "lusha_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Lusha API-key copy was deleted. Rotate the dedicated key in Lusha API Hub.";
  connection.metadata = {
    provider: "lusha",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.lusha.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect007: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "snov-io",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "snov_client_credentials_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Snov.io client-credential copy was deleted. Rotate the API Secret in Snov.io.";
  connection.metadata = {
    provider: "snov-io",
    tokenStatus: "disconnected",
    providerRotationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.snov.client_credentials.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRotationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect008: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "hunter-io",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "hunter_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Hunter API-key copy was deleted. Delete the dedicated key in Hunter.";
  connection.metadata = {
    provider: "hunter-io",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.hunter.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect009: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "apollo-graphql-studio",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "apollo_graphos_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Apollo GraphOS credential copy was deleted. Delete the dedicated graph key in GraphOS Studio.";
  connection.metadata = {
    provider: "apollo-graphql-studio",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.apollo_graphos.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect010: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "fred",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "fred_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted FRED API-key copy was deleted. Replace or revoke the key from your FRED account.";
  connection.metadata = {
    provider: "fred",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.fred.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect011: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "messagebird",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "messagebird_access_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Bird credential copy was deleted. Delete the dedicated AccessKey in Bird Security settings.";
  connection.metadata = {
    provider: "messagebird",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.messagebird.access_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect012: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "vonage",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "vonage_api_secret_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Vonage credential copy was deleted. Revoke the dedicated secondary secret in Vonage Dashboard API Settings.";
  connection.metadata = {
    provider: "vonage",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.vonage.api_secret.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect013: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "twilio",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "twilio_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Twilio credential copy was deleted. Delete the Restricted API key in Twilio Console to revoke provider access.";
  connection.metadata = {
    provider: "twilio",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.twilio.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

const OAuthLocalDisconnect014: OAuthLocalDisconnectHandler = async function (
  this: MarketplaceConnectorOAuthService,
  workspaceId,
  userId,
  _appSlug,
  connectionId,
) {
  const connection = await this.getConnectionWithSecrets(
    workspaceId,
    "openphone",
    connectionId,
  );
  connection.secretCiphertext = null;
  connection.secretIv = null;
  connection.secretAuthTag = null;
  connection.secretKeyVersion = null;
  connection.status = "needs_credentials";
  connection.lastValidatedAt = null;
  connection.lastErrorCode = "openphone_api_key_disconnected";
  connection.lastErrorMessage =
    "Relay's encrypted Quo API-key copy was deleted. Revoke the key manually in Quo Workspace Settings.";
  connection.metadata = {
    provider: "openphone",
    currentProviderName: "Quo",
    legacyProviderName: "OpenPhone",
    tokenStatus: "disconnected",
    providerRevocationRequired: true,
    disconnectedAt: new Date().toISOString(),
  };
  connection.updatedByUserId = userId;
  const saved = await this.connectionRepo.save(connection);
  await this.auditLogService.record({
    actorType: "user",
    actorId: userId,
    workspaceId,
    eventType: "marketplace.openphone.api_key.disconnected",
    resourceType: "marketplace_connection",
    resourceId: connection.id,
    metadata: {
      encryptedCredentialDeleted: true,
      providerRevocationRequired: true,
    },
  });
  return this.toConnectionView(saved);
};

export const OAuthLocalDisconnectHandlers01: OAuthLocalDisconnectHandlerMap =
  Object.freeze({
    wiza: OAuthLocalDisconnect001,
    uplead: OAuthLocalDisconnect002,
    rocketreach: OAuthLocalDisconnect003,
    "seamless-ai": OAuthLocalDisconnect004,
    leadiq: OAuthLocalDisconnect005,
    lusha: OAuthLocalDisconnect006,
    "snov-io": OAuthLocalDisconnect007,
    "hunter-io": OAuthLocalDisconnect008,
    "apollo-graphql-studio": OAuthLocalDisconnect009,
    fred: OAuthLocalDisconnect010,
    messagebird: OAuthLocalDisconnect011,
    vonage: OAuthLocalDisconnect012,
    twilio: OAuthLocalDisconnect013,
    openphone: OAuthLocalDisconnect014,
  });
