import type {
  MarketplaceActionPolicy,
  MarketplaceCapability,
} from "../catalog/marketplace-catalog.types";

export type MarketplaceConnectorType =
  | "native_clawchat"
  | "mcp_backed"
  | "openapi_generated"
  | "browser_automation"
  | "local_script"
  | "webhook_automation_platform";

export type MarketplaceConnectorSafeErrorCode =
  | "credential_missing"
  | "credential_decrypt_failed"
  | "token_expired"
  | "token_refresh_failed"
  | "insufficient_scope"
  | "connection_not_ready"
  | "tool_not_granted"
  | "approval_required"
  | "approval_mismatch"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_validation_error"
  | "sender_identity_not_approved"
  | "sender_identity_unavailable"
  | "recipient_blocked"
  | "policy_blocked"
  | "scope_not_granted"
  | "tool_unavailable"
  | "graph_error";

export type MarketplaceConnectorAuthConfig = {
  type:
    | "oauth1"
    | "oauth2_authorization_code"
    | "api_key"
    | "pat"
    | "mcp"
    | "custom";
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    revocationUrl?: string;
    authority?: {
      provider: "microsoft";
      defaultMode: "single_tenant" | "multi_tenant_org" | "multi_tenant_common";
      tenantIdEnv?: string;
    };
    userInfoUrl?: string;
    requiredScopes: string[];
    optionalScopes?: string[];
    accessOptions?: Array<{
      id: string;
      label: string;
      description: string;
      scopes: string[];
      capabilityIds: string[];
      defaultSelected: boolean;
    }>;
    pkce: boolean;
    supportsRefresh: boolean;
  };
  credentialSchema: Array<{
    name: string;
    label: string;
    required: boolean;
    secret: boolean;
    storedIn: "encrypted_secret" | "metadata";
    requiredForAuthTypes?: string[];
    helpText?: string;
  }>;
};

export type MarketplaceConnectorRuntimeTool = {
  name: string;
  functionName: string;
  aliases?: string[];
  capability: string;
  platformCapability: string;
  action: "read" | "draft" | "write" | "admin";
  approvalRequired: boolean;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MarketplaceConnectorManifest = {
  slug: string;
  name: string;
  connectorType: MarketplaceConnectorType;
  providerDocsUrl: string;
  providerWebsiteUrl: string;
  capabilities: Array<MarketplaceCapability & { platformCapability?: string }>;
  auth: MarketplaceConnectorAuthConfig;
  tools: MarketplaceConnectorRuntimeTool[];
  approvalProfiles: Array<{
    id: string;
    label: string;
    description: string;
    defaultSelected: boolean;
    allowedActions: MarketplaceActionPolicy[];
    approvalRequiredActions: MarketplaceActionPolicy[];
    blockedActions: MarketplaceActionPolicy[];
  }>;
  healthChecks: Array<{ id: string; label: string; requiredScopes?: string[] }>;
};

export type MarketplaceConnectorHealth = {
  status: "ready" | "needs_auth" | "missing_scope" | "error";
  connectionId: string;
  appSlug: string;
  tokenValid: boolean;
  refreshAvailable: boolean;
  grantedScopes: string[];
  missingScopes: string[];
  accountLabel?: string | null;
  lastCheckedAt: string;
  errorCode?: MarketplaceConnectorSafeErrorCode | null;
  message?: string | null;
};

export type MarketplaceConnectorExecutorRequest = {
  workspaceId: string;
  dispatchId: string;
  agentId: string;
  userId: string | null;
  appSlug: string;
  toolName: string;
  connectionId: string;
  installMetadata?: Record<string, unknown> | null;
  input: Record<string, unknown>;
};

export type MarketplaceConnectorExecutorResult = {
  ok: boolean;
  statusCode?: number;
  data?: unknown;
  safeSummary?: string;
  auditMetadata?: Record<string, unknown>;
  error?: {
    code: MarketplaceConnectorSafeErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type MarketplaceConnectorRuntimeDescriptor = {
  name: string;
  functionName: string;
  aliases?: string[];
  appSlug: string;
  provider: string;
  connectionId: string;
  workspaceId: string;
  capability: string;
  platformCapability: string;
  action: string;
  approvalRequired: boolean;
  description: string;
  inputSchema: Record<string, unknown>;
  auth: "clawchat_connector_token_proxy";
  tokenExposure: "never_exposed_to_agent";
  credential: {
    secretRef: string;
    secretMaterialSentToHermes: false;
  };
  execution: {
    authority: "railway" | "device_local_source_host";
    transport:
      | "clawchat_bridge_marketplace_tool"
      | "clawchat_bridge_source_host_tool";
    endpointBasePath: string;
    requiresBridgeAccessToken: true;
    credentialAttachment: "server_side_token_proxy";
  };
};
