import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DOVETAIL_READ_OPERATIONS } from "./dovetail-api.adapter";

const read = action(
  "dovetail_read",
  "Read Dovetail metadata",
  "Verify token identity and read bounded, minimized project metadata without research contents or people.",
);
const manage = blocked(
  "dovetail_manage",
  "Change Dovetail",
  "Projects, folders, docs, data, highlights, tags, themes, people, comments, channels, dashboards, agents, and every mutation remain blocked.",
);

export const DOVETAIL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dovetail",
  name: "Dovetail",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.dovetail.com/docs/introduction",
  providerWebsiteUrl: "https://dovetail.com/",
  capabilities: [
    {
      ...capability(
        "dovetail_read",
        "Read workspace metadata",
        "Use three pinned GETs for token identity and bounded, minimized project metadata.",
        true,
      ),
      platformCapability: "dovetail_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DOVETAIL_API_TOKEN",
        label: "Dovetail API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a least-privilege personal API token; Dovetail tokens expire after 30 days.",
      },
    ],
  },
  tools: [
    {
      name: "dovetail.read",
      functionName: "dovetail_read",
      aliases: ["dovetail.read", "dovetail_read"],
      capability: "dovetail_read",
      platformCapability: "dovetail_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, minimized Dovetail REST metadata read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DOVETAIL_READ_OPERATIONS] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          projectId: { type: "string", minLength: 22, maxLength: 22 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "dovetail_safe",
      label: "Safe",
      description:
        "Token identity and bounded minimized project metadata run directly. Research contents, people, hosted MCP, search, arbitrary APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [{ id: "token_info", label: "API token identity check" }],
};
