import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "brandwatch_project_reference_list",
    "List Brandwatch project references",
    "List at most twenty-five project IDs and time zones without project, client, company, user, or billing identity.",
  ),
  action(
    "brandwatch_query_structure_list",
    "List Brandwatch query structure",
    "List at most twenty-five query IDs and query types for one exact project without names, search expressions, authors, content, or results.",
  ),
];

export const BRANDWATCH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "brandwatch",
  name: "Brandwatch",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.brandwatch.com/docs/getting-started",
  providerWebsiteUrl: "https://www.brandwatch.com/",
  capabilities: [
    {
      ...capability(
        "consumer_research_structure_read",
        "Read Consumer Research structure",
        "Read bounded identity- and content-redacted project references and query structure for one exact Brandwatch Consumer Research project.",
        true,
      ),
      platformCapability: "brandwatch_consumer_research_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BRANDWATCH_ACCESS_TOKEN",
        label: "Brandwatch API access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a Brandwatch Consumer Research API access token using the official authentication guide. Relay encrypts the token and sends it only as a Bearer header to https://api.brandwatch.com; Relay never requests or stores your Brandwatch password.",
      },
      {
        name: "BRANDWATCH_PROJECT_ID",
        label: "Brandwatch project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact positive-decimal project ID returned by the official Projects summary endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "brandwatch.listProjects",
      functionName: "brandwatch_project_reference_list",
      aliases: ["brandwatch.listProjects", "brandwatch_project_reference_list"],
      capability: "consumer_research_structure_read",
      platformCapability: "brandwatch_consumer_research_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five project IDs and time zones without project, client, company, user, or billing identity.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "brandwatch.listQueries",
      functionName: "brandwatch_query_structure_list",
      aliases: ["brandwatch.listQueries", "brandwatch_query_structure_list"],
      capability: "consumer_research_structure_read",
      platformCapability: "brandwatch_consumer_research_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five query IDs and query types for the exact bound project without names, search expressions, authors, content, or results.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "brandwatch_safe",
      label: "Safe",
      description:
        "Both bounded structure reads require approval; identity, names, search expressions, mentions, authors, content, analytics, uploads, mutations, publishing, engagement, arbitrary APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two bounded reads run directly; exact project binding, fixed GET paths, redaction, response caps, audits, and Brandwatch's rate limit remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "project",
      label: "Brandwatch token and exact project validation",
      requiredScopes: ["read"],
    },
  ],
};
