import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "widen_collective_read",
  "Read Acquia DAM data",
  "Run one bounded GET operation from Acquia DAM's current V1 or V2 SDK surface.",
);
const manage = action(
  "widen_collective_manage",
  "Change Acquia DAM data",
  "Run one documented Acquia DAM mutation; Safe mode requires approval.",
);
const guards = [
  action(
    "widen_collective_secret_exposure",
    "Expose credentials",
    "Access tokens and authorization headers never enter agent-visible results.",
  ),
  action(
    "widen_collective_untrusted_route",
    "Call an undocumented route",
    "Requests remain pinned to an official Acquia DAM origin and the current SDK route surface.",
  ),
  action(
    "widen_collective_unbounded_transfer",
    "Transfer unbounded data",
    "Relay bounds request bodies and provider responses and refuses redirects.",
  ),
];

const requestProperties = {
  apiVersion: { type: "string", enum: ["1", "2"] },
  path: { type: "string", minLength: 1, maxLength: 1000, pattern: "^/" },
  query: { type: "object" },
};

export const WIDEN_COLLECTIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "widen-collective",
    name: "Acquia DAM (Widen)",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.acquia.com/acquia-dam/apis-acquia-dam",
    providerWebsiteUrl: "https://www.acquia.com/products/acquia-dam",
    capabilities: [
      {
        ...capability(
          "dam_read",
          "Browse digital assets",
          "Read authorized assets, metadata, categories, collections, products, users, analytics, workflows, usage, and webhook configuration.",
          true,
        ),
        platformCapability: "widen_collective_dam_read",
      },
      {
        ...capability(
          "dam_manage",
          "Manage digital assets",
          "Upload, update, organize, publish, order, govern, subscribe, and delete through Acquia DAM's current V1 and V2 SDK surface.",
          true,
        ),
        platformCapability: "widen_collective_dam_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "WIDEN_COLLECTIVE_SUBDOMAIN",
          label: "Acquia DAM collective subdomain",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Enter the first part of your Acquia DAM address, such as example from example.widencollective.com.",
        },
        {
          name: "WIDEN_COLLECTIVE_ACCESS_TOKEN",
          label: "Acquia DAM access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "A DAM administrator creates a dedicated token under Admin > Global Settings > API Setup. Access follows that account's roles and permissions.",
        },
      ],
    },
    tools: [
      {
        name: "widen-collective.read",
        functionName: "widen_collective_read",
        aliases: ["widen-collective.read", "widen_collective_read"],
        capability: "dam_read",
        platformCapability: "widen_collective_dam_read",
        action: "read",
        approvalRequired: false,
        description:
          "Run one bounded GET operation from the current Acquia DAM TypeScript SDK surface.",
        inputSchema: {
          type: "object",
          properties: requestProperties,
          required: ["apiVersion", "path"],
          additionalProperties: false,
        },
      },
      {
        name: "widen-collective.manage",
        functionName: "widen_collective_manage",
        aliases: ["widen-collective.manage", "widen_collective_manage"],
        capability: "dam_manage",
        platformCapability: "widen_collective_dam_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Run one documented Acquia DAM mutation, including bounded upload and workflow operations.",
        inputSchema: {
          type: "object",
          properties: {
            ...requestProperties,
            method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
            json: { type: "object" },
            contentBase64: { type: "string", maxLength: 7000000 },
            contentType: { type: "string", maxLength: 200 },
            multipartFields: { type: "object" },
            multipartField: { type: "string", maxLength: 100 },
            fileName: { type: "string", maxLength: 500 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["apiVersion", "method", "path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "widen_collective_safe",
        label: "Safe",
        description:
          "Bounded reads run directly; every upload, create, update, workflow, webhook, order, or delete operation requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected token-authorized Acquia DAM operation runs without Relay per-action approval; ownership, account permissions, fixed origins, route bounds, redaction, audits, provider limits, and provider charges still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      { id: "current-user", label: "Acquia DAM token and current-user check" },
    ],
  };
