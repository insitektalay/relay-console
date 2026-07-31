import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const authorityRead = action(
  "mycase_connection_authority_get",
  "Verify MyCase connection authority",
  "Verify that the customer token resolves to one authorized firm without returning firm identity or legal-practice data.",
);

export const MYCASE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mycase",
  name: "MyCase",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://mycaseapi.stoplight.io/docs/mycase-api-documentation/k5xpc4jyhkom7-getting-started",
  providerWebsiteUrl: "https://www.mycase.com/",
  capabilities: [{
    ...capability("connection_authority_read", "Verify connection authority", "Verify one customer-owned MyCase Open API token without exposing firm, user, case, contact, document, calendar, task, communication, billing, payment, or intake data.", true),
    platformCapability: "mycase_connection_authority_read",
  }],
  auth: {
    type: "custom",
    credentialSchema: [{
      name: "MYCASE_ACCESS_TOKEN",
      label: "MyCase Open API access token",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
      requiredForAuthTypes: ["custom"],
      helpText: "Supply a current customer-issued bearer token for the exact MyCase firm.",
    }],
  },
  tools: [{
    name: "myCase.getConnectionAuthority",
    functionName: "mycase_connection_authority_get",
    aliases: ["myCase.getConnectionAuthority", "mycase_connection_authority_get"],
    capability: "connection_authority_read",
    platformCapability: "mycase_connection_authority_read",
    action: "read",
    approvalRequired: true,
    description: "Verify the connection and return only authorization, API version, and redaction status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }],
  approvalProfiles: [
    { id: "mycase_safe", label: "Safe", description: "The identity-free authority check requires approval; all firm identity, legal-practice data, writes, administration, raw APIs, pagination, and bulk remain blocked.", defaultSelected: true, allowedActions: [], approvalRequiredActions: [authorityRead], blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The same identity-free authority check runs directly; exact firm ownership, credential secrecy, redaction, auditing, response bounds, and provider limits remain mandatory.", defaultSelected: false, allowedActions: [authorityRead], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "firm_authority", label: "MyCase authorized-firm validation" }],
};
