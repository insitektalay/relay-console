import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { PEOPLE_AI_READ_OPERATIONS } from "./people-ai-mcp.adapter";

const read = action(
  "people_ai_read",
  "Find People.ai accounts",
  "Search for an account by a validated 2–160 character name through the pinned Backstory MCP find_account tool.",
);
const manage = blocked(
  "people_ai_manage",
  "Access broader People.ai data or make changes",
  "Opportunity analysis, activity, people, communications, news, SalesAI, forecasts, raw CRM data, REST extraction, and every mutation are outside Relay's V1 contract.",
);

export const PEOPLE_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "people-ai",
  name: "People.ai",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.people.ai/en/articles/15138623-backstory-mcp",
  providerWebsiteUrl: "https://www.people.ai/",
  capabilities: [
    {
      ...capability(
        "people_ai_read",
        "Find accounts",
        "Use only Backstory MCP's documented find_account tool after live schema verification and redact people and communication data from results.",
        true,
      ),
      platformCapability: "people_ai_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PEOPLE_AI_MCP_CLIENT_ID",
        label: "People.ai MCP client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the MCP-specific client ID issued by a Backstory administrator or CSM. Relay encrypts it server-side.",
      },
      {
        name: "PEOPLE_AI_MCP_CLIENT_SECRET",
        label: "People.ai MCP client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the matching MCP-specific client secret. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "peopleAi.search",
      functionName: "people_ai_read",
      aliases: ["peopleAi.search", "people_ai_read"],
      capability: "people_ai_read",
      platformCapability: "people_ai_read",
      action: "read",
      approvalRequired: false,
      description:
        "Search for an account through one schema-verified MCP tool.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...PEOPLE_AI_READ_OPERATIONS],
          },
          query: { type: "string", minLength: 2, maxLength: 160 },
        },
        required: ["operation", "query"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "people_ai_safe",
      label: "Safe",
      description:
        "Schema-verified account search runs directly. Opportunity analysis, communications, people, news, forecasts, arbitrary MCP or REST tools, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "credentials_and_find_account_schema",
      label: "MCP credentials and find_account schema check",
    },
  ],
};
