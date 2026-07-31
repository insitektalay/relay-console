import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "daminion_read",
  "Read Daminion data",
  "Run one bounded GET operation from Daminion's published API help surface.",
);
const manage = action(
  "daminion_manage",
  "Change Daminion data",
  "Run one documented Daminion mutation; Safe mode requires approval.",
);
const guards = [
  action(
    "daminion_secret_exposure",
    "Expose credentials",
    "Login credentials, session cookies, API keys, authorization material, and server paths never enter agent-visible results.",
  ),
  action(
    "daminion_untrusted_route",
    "Call an undocumented route",
    "Requests remain pinned to the validated customer Daminion cloud tenant and the published API route surface.",
  ),
  action(
    "daminion_host_control",
    "Control the Daminion host",
    "Local application launch, directory access, server-path import, client-assistant settings, and credential administration are permanently unavailable.",
  ),
  action(
    "daminion_unbounded_transfer",
    "Transfer unbounded data",
    "Relay bounds request bodies and provider responses and refuses redirects.",
  ),
];

const requestProperties = {
  path: { type: "string", minLength: 1, maxLength: 2_000, pattern: "^/api/" },
  query: { type: "object" },
};

export const DAMINION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "daminion",
  name: "Daminion",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://marketing.daminion.net/apihelp",
  providerWebsiteUrl: "https://daminion.net/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse Daminion",
        "Search and read authorized assets, previews, thumbnails, tags, collections, comments, versions, downloads, users, permissions, catalog settings, maps, and AI status.",
        true,
      ),
      platformCapability: "daminion_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage Daminion",
        "Upload, import, tag, approve, version, organize, share, brand, comment on, download, and delete authorized Daminion content through its published API.",
        true,
      ),
      platformCapability: "daminion_dam_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DAMINION_TENANT",
        label: "Daminion cloud tenant",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the first part of the customer's Daminion cloud address, such as example from example.daminion.net.",
      },
      {
        name: "DAMINION_USERNAME",
        label: "Daminion username or email",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated Daminion user whose role grants only the content and administration this connection needs.",
      },
      {
        name: "DAMINION_PASSWORD",
        label: "Daminion password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Railway encrypts this password and exchanges it for a short-lived Daminion server session when a tool runs.",
      },
    ],
  },
  tools: [
    {
      name: "daminion.read",
      functionName: "daminion_read",
      aliases: ["daminion.read", "daminion_read"],
      capability: "dam_read",
      platformCapability: "daminion_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET operation from Daminion's 331-signature API help surface, excluding fixed credential and host-control guards.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "daminion.manage",
      functionName: "daminion_manage",
      aliases: ["daminion.manage", "daminion_manage"],
      capability: "dam_manage",
      platformCapability: "daminion_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented Daminion mutation, including bounded JSON, raw-content, and multipart upload operations.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST"] },
          json: { type: "object" },
          multipartFields: { type: "object" },
          multipartField: { type: "string", maxLength: 150 },
          fileName: { type: "string", maxLength: 500 },
          contentType: { type: "string", maxLength: 200 },
          contentBase64: { type: "string", maxLength: 7_000_000 },
          apiArg: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "daminion_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every provider mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected user-authorized Daminion operation runs without Relay per-action approval; ownership, provider roles, tenant binding, route bounds, redaction, audits, and fixed credential and host-control guards still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "logged-user",
      label: "Daminion tenant, credentials, and current-user check",
    },
  ],
};
