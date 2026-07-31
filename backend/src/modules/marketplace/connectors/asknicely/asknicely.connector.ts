import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ASKNICELY_READ_OPERATIONS } from "./asknicely-api.adapter";

const read = action(
  "asknicely_read",
  "Read AskNicely",
  "Read bounded responses, NPS, sent-volume statistics, and historical statistics from one tenant.",
);
const manage = blocked(
  "asknicely_manage",
  "Change AskNicely",
  "Survey sending, contacts, templates, deactivation, imports, responses, and all other mutations are outside Relay's V1 contract.",
);

export const ASKNICELY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "asknicely",
  name: "AskNicely",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://asknicely.asknice.ly/help/apidocs/auth",
  providerWebsiteUrl: "https://www.asknicely.com/",
  capabilities: [
    {
      ...capability(
        "asknicely_read",
        "Read feedback and statistics",
        "Use four pinned API v1 reads for at most 25 responses, NPS, sent-volume statistics, and historical statistics without arbitrary custom-field filters.",
        true,
      ),
      platformCapability: "asknicely_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ASKNICELY_SUBDOMAIN",
        label: "AskNicely tenant subdomain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the tenant prefix from {tenant}.asknice.ly; Relay constructs and pins the official HTTPS API host.",
      },
      {
        name: "ASKNICELY_API_KEY",
        label: "AskNicely API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned API key; Relay sends it only in the documented X-apikey header.",
      },
    ],
  },
  tools: [
    {
      name: "askNicely.read",
      functionName: "asknicely_read",
      aliases: ["askNicely.read", "asknicely_read"],
      capability: "asknicely_read",
      platformCapability: "asknicely_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded AskNicely API v1 read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ASKNICELY_READ_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          since: { type: "integer", minimum: 0, maximum: 4102444800 },
          days: { type: "integer", minimum: 1, maximum: 3650 },
          year: { type: "integer", minimum: 2000, maximum: 2100 },
          month: { type: "integer", minimum: 1, maximum: 12 },
          day: { type: "integer", minimum: 1, maximum: 31 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "asknicely_safe",
      label: "Safe",
      description:
        "Four bounded reads run directly. Custom-field filters, exports, contacts, survey sends, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "tenant_key_and_nps",
      label: "Tenant, API key, and NPS access check",
    },
  ],
};
