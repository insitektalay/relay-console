import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  MOBILIZE_MANAGE_OPERATION_IDS,
  MOBILIZE_OPERATIONS,
  MOBILIZE_PUBLIC_READ_OPERATION_IDS,
  MOBILIZE_SENSITIVE_READ_OPERATION_IDS,
} from "./mobilize-operation-registry";

const publicRead = action(
  "mobilize_public_read",
  "Read public Mobilize data",
  "Read public organizations, one public event, promoted organizations and current enum values.",
);
const sensitiveRead = action(
  "mobilize_sensitive_read",
  "Read private Mobilize organization data",
  "Read private event details, supporter profiles and attendance records; Safe mode requires approval.",
);
const manage = action(
  "mobilize_manage",
  "Manage Mobilize",
  "Create, update or delete events, create signups or affiliations, and upload event images; Safe mode requires approval.",
);

export const MOBILIZE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mobilize",
  name: "Mobilize",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/mobilizeamerica/api",
  providerWebsiteUrl: "https://join.mobilize.us/",
  capabilities: [
    {
      ...capability(
        "mobilize_public_read",
        "Read public organizing data",
        `Use ${MOBILIZE_PUBLIC_READ_OPERATION_IDS.length} bounded public and non-sensitive API reads.`,
        true,
      ),
      platformCapability: "mobilize_public_read",
    },
    {
      ...capability(
        "mobilize_sensitive_read",
        "Read organization supporters and activity",
        `Use ${MOBILIZE_SENSITIVE_READ_OPERATION_IDS.length} private event, person and attendance reads under approval.`,
        true,
      ),
      platformCapability: "mobilize_sensitive_read",
    },
    {
      ...capability(
        "mobilize_manage",
        "Manage events and participation",
        `Use all ${MOBILIZE_MANAGE_OPERATION_IDS.length} support-gated API mutations.`,
        true,
      ),
      platformCapability: "mobilize_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MOBILIZE_API_KEY",
        label: "Mobilize API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated bearer API key issued by Mobilize for the intended organization and approved read/write surface.",
      },
      {
        name: "MOBILIZE_ORGANIZATION_ID",
        label: "Mobilize organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The numeric organization ID bound to the API key. Relay substitutes it server-side into every private organization route.",
      },
    ],
  },
  tools: [
    {
      name: "mobilize.publicRead",
      functionName: "mobilize_public_read",
      aliases: ["mobilize.publicRead", "mobilize_public_read"],
      capability: "mobilize_public_read",
      platformCapability: "mobilize_public_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned public or non-sensitive Mobilize read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...MOBILIZE_PUBLIC_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 2 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "mobilize.sensitiveRead",
      functionName: "mobilize_sensitive_read",
      aliases: ["mobilize.sensitiveRead", "mobilize_sensitive_read"],
      capability: "mobilize_sensitive_read",
      platformCapability: "mobilize_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "Run one pinned private event, supporter or attendance read; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...MOBILIZE_SENSITIVE_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 2 },
          query: { type: "object", maxProperties: 50 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "mobilize.manage",
      functionName: "mobilize_manage",
      aliases: ["mobilize.manage", "mobilize_manage"],
      capability: "mobilize_manage",
      platformCapability: "mobilize_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Mobilize mutation; restricted provider access and Safe approval are both required.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...MOBILIZE_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 2 },
          query: { type: "object", maxProperties: 50 },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mobilize_safe",
      label: "Safe",
      description:
        "Public reads run directly; private supporter and event reads plus every mutation require approval.",
      defaultSelected: true,
      allowedActions: [publicRead],
      approvalRequiredActions: [sensitiveRead, manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${MOBILIZE_OPERATIONS.length} pinned operations run without Relay per-action approval; organization binding, provider authorization, privacy, fixed routes, payload bounds, audits and rate limits still apply.`,
      defaultSelected: false,
      allowedActions: [publicRead, sensitiveRead, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_organization",
      label: "Mobilize API key and exact organization check",
    },
  ],
};
