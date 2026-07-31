import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  POSTSCRIPT_MANAGE_OPERATION_IDS,
  POSTSCRIPT_OPERATIONS,
  POSTSCRIPT_SAFE_READ_OPERATION_IDS,
  POSTSCRIPT_SENSITIVE_READ_OPERATION_IDS,
} from "./postscript-operation-registry";

const structure = action(
  "postscript_structural_read",
  "Read Postscript structure",
  "Read exact shop identity, keywords, webhook subscriptions, and example event structure.",
);
const sensitive = action(
  "postscript_sensitive_read",
  "Read subscribers or messages",
  "Read bounded subscriber, message-request, or sent-message data with approval.",
);
const manage = action(
  "postscript_manage",
  "Manage Postscript",
  "Send messages or events and manage subscribers, compliance, and webhooks with approval.",
);
const blocks = [
  blocked(
    "postscript_secret_exposure",
    "Expose credentials",
    "Private API keys, partner/shop tokens, webhook signing tokens, and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "postscript_signing_token",
    "Retrieve signing tokens",
    "The webhook signing-token endpoint is credential lifecycle plumbing and is not agent-facing.",
  ),
  blocked(
    "postscript_partner_impersonation",
    "Impersonate another shop",
    "Relay never accepts a dynamic X-Postscript-Shop-Token or routes a shop key under unrelated partner authority.",
  ),
  blocked(
    "postscript_unbounded_api",
    "Use arbitrary or unbounded APIs",
    "Only 20 pinned v2 operations run; legacy versions, arbitrary paths, origins, headers, pages, and oversized transfers are blocked.",
  ),
];

export const POSTSCRIPT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "postscript",
  name: "Postscript",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.postscript.io/docs/getting-started",
  providerWebsiteUrl: "https://postscript.io/",
  capabilities: [
    {
      ...capability(
        "structural_read",
        "Read shop structure",
        "Use six bounded shop, keyword, and webhook metadata reads.",
        true,
      ),
      platformCapability: "postscript_structural_read",
    },
    {
      ...capability(
        "sensitive_read",
        "Read subscribers and messages",
        "Use four bounded subscriber/message reads with approval.",
        false,
      ),
      platformCapability: "postscript_sensitive_read",
    },
    {
      ...capability(
        "manage",
        "Manage SMS engagement",
        "Use ten compliance, messaging, event, subscriber, and webhook mutations with approval.",
        false,
      ),
      platformCapability: "postscript_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "POSTSCRIPT_PRIVATE_API_KEY",
        label: "Postscript shop private API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated shop private key from an enterprise/grandfathered API-enabled account; never use the public key.",
      },
    ],
  },
  tools: [
    tool(
      "postscript.read",
      "postscript_read",
      "structural_read",
      "postscript_structural_read",
      "read",
      false,
      POSTSCRIPT_SAFE_READ_OPERATION_IDS,
    ),
    tool(
      "postscript.readSensitive",
      "postscript_read_sensitive",
      "sensitive_read",
      "postscript_sensitive_read",
      "read",
      true,
      POSTSCRIPT_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "postscript.manage",
      "postscript_manage",
      "manage",
      "postscript_manage",
      "write",
      true,
      POSTSCRIPT_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "postscript_safe",
      label: "Safe",
      description:
        "Six structural reads run directly; all subscriber/message reads and ten mutations require approval.",
      defaultSelected: true,
      allowedActions: [structure],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${POSTSCRIPT_OPERATIONS.length} selected and shop-authorized operations run without Relay per-action approval; fixed routes, bounds, audits, provider compliance, and secret/impersonation blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [structure, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "identity", label: "Postscript private key and exact shop identity" },
  ],
};

function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: actionType,
    approvalRequired,
    description:
      "Run one pinned Postscript v2 operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        pathParams: { type: "object", maxProperties: 1 },
        query: { type: "object", maxProperties: 22 },
        body: { type: "object", maxProperties: 100 },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
