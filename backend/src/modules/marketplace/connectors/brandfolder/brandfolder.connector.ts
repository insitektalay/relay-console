import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "brandfolder_read",
  "Read Brandfolder data",
  "Run one bounded operation from Brandfolder's documented read surface.",
);
const manage = action(
  "brandfolder_manage",
  "Change Brandfolder data",
  "Run one documented Brandfolder mutation; Safe mode requires approval.",
);
const upload = action(
  "brandfolder_upload",
  "Upload a Brandfolder asset",
  "Upload one bounded file and create its asset; Safe mode requires approval.",
);
const fixedGuards = [
  action(
    "brandfolder_secret_exposure",
    "Expose credentials",
    "API keys, authorization headers, and temporary signed upload capabilities never enter agent-visible results.",
  ),
  action(
    "brandfolder_untrusted_route",
    "Call an undocumented route",
    "Requests remain pinned to an exact method and route in Brandfolder's current V4 OpenAPI description.",
  ),
  action(
    "brandfolder_unbounded_transfer",
    "Transfer unbounded data",
    "Relay bounds request bodies and provider responses and refuses redirects.",
  ),
];

const requestProperties = {
  path: { type: "string", minLength: 1, maxLength: 1000, pattern: "^/" },
  query: { type: "object" },
};

export const BRANDFOLDER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "brandfolder",
  name: "Brandfolder",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.smartsheet.com/api/brandfolder/introduction",
  providerWebsiteUrl: "https://brandfolder.com/",
  capabilities: [
    {
      ...capability(
        "dam_read",
        "Browse brand content",
        "Read authorized organizations, Brandfolders, collections, sections, assets, attachments, metadata, invitations, permissions, labels, tags, and webhooks.",
        true,
      ),
      platformCapability: "brandfolder_dam_read",
    },
    {
      ...capability(
        "dam_manage",
        "Manage brand content",
        "Create, update, upload, organize, invite, permission, subscribe, and delete through Brandfolder's complete documented V4 surface.",
        true,
      ),
      platformCapability: "brandfolder_dam_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BRANDFOLDER_API_KEY",
        label: "Brandfolder API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy your key from Brandfolder Profile > Integrations. Agents receive only the resources and permissions granted to that Brandfolder user.",
      },
    ],
  },
  tools: [
    {
      name: "brandfolder.read",
      functionName: "brandfolder_read",
      aliases: ["brandfolder.read", "brandfolder_read"],
      capability: "dam_read",
      platformCapability: "brandfolder_dam_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded GET from Brandfolder's current V4 OpenAPI surface.",
      inputSchema: {
        type: "object",
        properties: requestProperties,
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "brandfolder.manage",
      functionName: "brandfolder_manage",
      aliases: ["brandfolder.manage", "brandfolder_manage"],
      capability: "dam_manage",
      platformCapability: "brandfolder_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented Brandfolder mutation, including bounded binary-upload operations.",
      inputSchema: {
        type: "object",
        properties: {
          ...requestProperties,
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          json: { type: "object" },
          contentBase64: { type: "string", maxLength: 7000000 },
          contentType: { type: "string", maxLength: 200 },
          headers: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
    {
      name: "brandfolder.upload",
      functionName: "brandfolder_upload",
      aliases: ["brandfolder.upload", "brandfolder_upload"],
      capability: "dam_manage",
      platformCapability: "brandfolder_dam_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Upload one file through Brandfolder's signed storage flow and create its asset without exposing temporary URLs.",
      inputSchema: {
        type: "object",
        properties: {
          destinationType: {
            type: "string",
            enum: ["brandfolder", "collection"],
          },
          destinationId: { type: "string", minLength: 1, maxLength: 200 },
          sectionId: { type: "string", minLength: 1, maxLength: 200 },
          name: { type: "string", minLength: 1, maxLength: 1000 },
          description: { type: "string", maxLength: 10000 },
          fileName: { type: "string", minLength: 1, maxLength: 500 },
          contentBase64: { type: "string", maxLength: 7000000 },
          contentType: { type: "string", maxLength: 200 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: [
          "destinationType",
          "destinationId",
          "sectionId",
          "name",
          "fileName",
          "contentBase64",
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "brandfolder_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; every create, upload, update, invitation, permission, webhook, move, or delete operation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage, upload],
      blockedActions: fixedGuards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected API-key-authorized V4 operation runs without Relay per-action approval; ownership, exact routes, bounds, redaction, audits, account permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage, upload],
      approvalRequiredActions: [],
      blockedActions: fixedGuards,
    },
  ],
  healthChecks: [
    {
      id: "organizations",
      label: "Brandfolder API-key and organization-access check",
    },
  ],
};
