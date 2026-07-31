import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "kontainer_read",
  "Read Kontainer data",
  "Run one bounded GET operation from Kontainer's published OpenAPI surface.",
);
const manage = action(
  "kontainer_manage",
  "Change Kontainer data",
  "Run one documented Kontainer create, update, upload, message, permission, or delete operation; Safe mode requires approval.",
);
const guards = [
  action(
    "kontainer_secret_exposure",
    "Expose credentials",
    "API tokens and authorization headers never enter agent-visible results.",
  ),
  action(
    "kontainer_untrusted_route",
    "Call an undocumented route",
    "Requests remain pinned to the validated customer tenant and Kontainer's published OpenAPI route surface.",
  ),
  action(
    "kontainer_unbounded_transfer",
    "Transfer unbounded data",
    "Relay bounds request bodies and provider responses and refuses redirects.",
  ),
];

const requestProperties = {
  path: { type: "string", minLength: 1, maxLength: 2000, pattern: "^/" },
  query: { type: "object" },
};

export const KONTAINER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kontainer",
  name: "Kontainer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://app.kontainer.com/api/documentation",
  providerWebsiteUrl: "https://kontainer.com/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse Kontainer",
        "Search and read authorized DAM assets, PIM records, consent data, CDN media, statistics, users, groups, permissions, and audit logs.",
        true,
      ),
      platformCapability: "kontainer_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage Kontainer",
        "Upload, create, update, organize, publish, permission, message, and delete DAM, PIM, user, group, and integration data through the published API.",
        true,
      ),
      platformCapability: "kontainer_dam_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KONTAINER_TENANT",
        label: "Kontainer tenant",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the first part of your Kontainer address, such as example from example.kontainer.com.",
      },
      {
        name: "KONTAINER_ACCESS_TOKEN",
        label: "Kontainer API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A Kontainer administrator creates the token under Settings > Configuration > API. The token follows that customer's account permissions.",
      },
    ],
  },
  tools: [
    {
      name: "kontainer.read",
      functionName: "kontainer_read",
      aliases: ["kontainer.read", "kontainer_read"],
      capability: "dam_read",
      platformCapability: "kontainer_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET operation from Kontainer's 127-operation OpenAPI surface.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "kontainer.manage",
      functionName: "kontainer_manage",
      aliases: ["kontainer.manage", "kontainer_manage"],
      capability: "dam_manage",
      platformCapability: "kontainer_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented Kontainer mutation, including bounded file and thumbnail upload operations.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
          json: { type: "object" },
          multipartFields: { type: "object" },
          multipartField: { type: "string", maxLength: 150 },
          fileName: { type: "string", maxLength: 500 },
          contentType: { type: "string", maxLength: 200 },
          contentBase64: { type: "string", maxLength: 7000000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kontainer_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every upload, create, update, message, permission, relationship, CDN, or delete operation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Kontainer operation runs without Relay per-action approval; ownership, provider permissions, tenant binding, route bounds, redaction, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "meta", label: "Kontainer token, tenant, and current-user check" },
  ],
};
