import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { OKTA_SCOPE } from "./okta-api.adapter";

const reads = [
  action(
    "okta_application_list",
    "List Applications",
    "List at most twenty-five Applications from the exact Okta Org's first page.",
  ),
  action(
    "okta_application_get",
    "Read selected Application",
    "Read one exact selected Okta Application without credentials or settings.",
  ),
  action(
    "okta_application_group_list",
    "List assigned Groups",
    "List at most twenty-five Groups assigned to the selected Application without members.",
  ),
];
const blockedActions = [
  blocked(
    "okta_write",
    "Change Okta",
    "Application, assignment, Group, user, policy, factor, session, device, workflow, hook, schema, and lifecycle mutations are outside V1.",
  ),
  blocked(
    "okta_sensitive_read",
    "Read sensitive Okta data",
    "Credentials, keys, settings/profile blobs, certificates, usernames, users, identities, group members, logs, factors, devices, sessions, and policies are outside V1.",
  ),
  blocked(
    "okta_admin",
    "Administer Okta",
    "Admin roles, scope grants, OIN integration configuration, brands, templates, billing, and administration are outside V1.",
  ),
  blocked(
    "okta_raw_api",
    "Use raw Okta API",
    "SSWS tokens, arbitrary paths or queries, raw bodies, pagination cursors, and automatic pagination are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const OKTA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "okta",
  name: "Okta",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.okta.com/docs/guides/oin-api-service-overview/",
  providerWebsiteUrl: "https://www.okta.com/",
  capabilities: [
    {
      ...capability(
        "application_read",
        "Read Applications",
        "List bounded Applications and inspect one selected Application.",
        true,
      ),
      platformCapability: "okta_application_read",
    },
    {
      ...capability(
        "application_group_read",
        "Read assigned Groups",
        "List bounded Group assignments without users or members.",
        true,
      ),
      platformCapability: "okta_application_group_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "OKTA_ORG_ORIGIN",
        label: "Okta Org origin",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Exact HTTPS Okta Org origin on an allowlisted Okta domain.",
      },
      {
        name: "OKTA_CLIENT_ID",
        label: "OIN API service client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-Org-specific client ID generated when the published OIN integration is authorized.",
      },
      {
        name: "OKTA_CLIENT_SECRET",
        label: "OIN API service client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-Org-specific secret encrypted by Relay and never exposed to agents.",
      },
      {
        name: "OKTA_APPLICATION_ID",
        label: "Selected Application ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind one exact selected Okta Application ID.",
      },
    ],
  },
  tools: [
    {
      name: "okta.listApplications",
      functionName: "okta_application_list",
      aliases: ["okta.listApplications", "okta_application_list"],
      capability: "application_read",
      platformCapability: "okta_application_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of Applications.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "okta.getApplication",
      functionName: "okta_application_get",
      aliases: ["okta.getApplication", "okta_application_get"],
      capability: "application_read",
      platformCapability: "okta_application_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Application.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "okta.listApplicationGroups",
      functionName: "okta_application_group_list",
      aliases: ["okta.listApplicationGroups", "okta_application_group_list"],
      capability: "application_group_read",
      platformCapability: "okta_application_group_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded assigned Groups without members.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "okta_safe",
      label: "Safe",
      description: "All three bounded Okta reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected reads run without Relay per-action approval while exact Org/Application binding, ephemeral tokens, fixed routes, bounds, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "selected-application",
      label:
        "Okta published OIN API service credentials, exact okta.apps.read, and selected Application binding",
      requiredScopes: [OKTA_SCOPE],
    },
  ],
};
