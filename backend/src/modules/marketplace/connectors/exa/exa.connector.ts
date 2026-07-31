import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const allowed = [
  action("exa_search", "Search web", "Run bounded Exa web searches for public web evidence."),
  action("exa_contents", "Fetch contents", "Fetch bounded contents for explicit public URLs."),
  action("exa_find_similar", "Find similar pages", "Find pages similar to an explicit public URL."),
  action("exa_answer", "Generate answer", "Generate an answer with source citations for a bounded question."),
];

const approvalRequired = [
  action("exa_deep_research", "Deep research", "Broad or deep research workflows require approval or elevated policy."),
  action("exa_bulk_contents", "Bulk extraction", "High-volume URL extraction or crawling requires approval."),
  action("exa_export_results", "Export result sets", "Exporting large result sets outside the workspace requires approval."),
];

const blockedActions = [
  blocked("exa_secret_extraction", "Secret extraction", "Do not use Exa to find or expose credentials, keys, tokens, or private data."),
  blocked("exa_private_data_harvesting", "Private data harvesting", "Bulk personal-data collection and login-protected scraping are blocked."),
  blocked("exa_access_bypass", "Access bypass", "Do not bypass paywalls, authentication, robots restrictions, or site access controls."),
];

export const EXA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "exa-search",
  name: "Exa Search",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.exa.ai",
  providerWebsiteUrl: "https://exa.ai",
  capabilities: [
    { ...capability("search", "Search", "Run Exa web searches and return source URLs with bounded evidence.", true), platformCapability: "external_search" },
    { ...capability("contents", "Contents", "Retrieve LLM-ready text, highlights, or summaries for explicit URLs.", true), platformCapability: "content_extraction" },
    { ...capability("similar", "Find similar", "Find pages similar to an explicit URL.", true), platformCapability: "prospect_discovery" },
    { ...capability("answer", "Answer", "Generate direct answers with source citations.", true), platformCapability: "evidence_gathering" },
    { ...capability("research", "Research", "Run approval-gated deep research workflows.", false), platformCapability: "deep_research" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EXA_API_KEY",
        label: "Exa API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Create an Exa API key in the Exa dashboard and store it in ClawChat.",
      },
    ],
  },
  tools: [
    {
      name: "exa.search",
      functionName: "exa_search",
      aliases: ["exa.search", "exa_search", "web_search", "external_search"],
      capability: "search",
      platformCapability: "external_search",
      action: "read",
      approvalRequired: false,
      description: "Search public web results with Exa and return safe, bounded source metadata.",
      inputSchema: searchInputSchema(),
    },
    {
      name: "exa.getContents",
      functionName: "exa_get_contents",
      aliases: ["exa.getContents", "exa_get_contents", "content_extraction"],
      capability: "contents",
      platformCapability: "content_extraction",
      action: "read",
      approvalRequired: false,
      description: "Fetch clean content, highlights, or summaries for explicit public URLs.",
      inputSchema: contentsInputSchema(),
    },
    {
      name: "exa.findSimilar",
      functionName: "exa_find_similar",
      aliases: ["exa.findSimilar", "exa_find_similar", "prospect_discovery"],
      capability: "similar",
      platformCapability: "prospect_discovery",
      action: "read",
      approvalRequired: false,
      description: "Find public pages similar to a known URL.",
      inputSchema: findSimilarInputSchema(),
    },
    {
      name: "exa.answer",
      functionName: "exa_answer",
      aliases: ["exa.answer", "exa_answer", "evidence_gathering"],
      capability: "answer",
      platformCapability: "evidence_gathering",
      action: "read",
      approvalRequired: false,
      description: "Answer a question using Exa search with citations.",
      inputSchema: answerInputSchema(),
    },
    {
      name: "exa.research",
      functionName: "exa_research",
      aliases: ["exa.research", "exa_research", "deep_research", "competitor_research"],
      capability: "research",
      platformCapability: "deep_research",
      action: "read",
      approvalRequired: true,
      description: "Run approval-gated deep research using Exa deep reasoning search.",
      inputSchema: researchInputSchema(),
    },
  ],
  approvalProfiles: [
    {
      id: "exa_search_operator",
      label: "Search Operator",
      description: "Bounded search, contents, similar, and answer calls are allowed; deep research and bulk extraction require approval.",
      defaultSelected: true,
      allowedActions: allowed,
      approvalRequiredActions: approvalRequired,
      blockedActions,
    },
  ],
  healthChecks: [{ id: "search_smoke", label: "Exa search smoke check" }],
};

function searchInputSchema() {
  return {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["instant", "fast", "auto", "deep-lite", "deep", "deep-reasoning"], default: "auto" },
      category: { type: "string" },
      numResults: { type: "number", minimum: 1, maximum: 25, default: 10 },
      includeDomains: { type: "array", items: { type: "string" }, maxItems: 50 },
      excludeDomains: { type: "array", items: { type: "string" }, maxItems: 50 },
      startPublishedDate: { type: "string" },
      endPublishedDate: { type: "string" },
      startCrawlDate: { type: "string" },
      endCrawlDate: { type: "string" },
      contents: { type: "object" },
    },
    required: ["query"],
    additionalProperties: false,
  };
}

function contentsInputSchema() {
  return {
    type: "object",
    properties: {
      urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
      text: { type: ["boolean", "object"], default: false },
      highlights: { type: ["boolean", "object"], default: true },
      summary: { type: "object" },
      maxAgeHours: { type: "number", minimum: -1, maximum: 720 },
      subpages: { type: "number", minimum: 0, maximum: 5, default: 0 },
      subpageTarget: { type: ["string", "array"] },
    },
    required: ["urls"],
    additionalProperties: false,
  };
}

function findSimilarInputSchema() {
  return {
    ...searchInputSchema(),
    properties: {
      ...searchInputSchema().properties,
      url: { type: "string", minLength: 1 },
    },
    required: ["url"],
  };
}

function answerInputSchema() {
  return {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      text: { type: "boolean", default: false },
      outputSchema: { type: "object" },
    },
    required: ["query"],
    additionalProperties: false,
  };
}

function researchInputSchema() {
  return {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      instructions: { type: "string" },
      approvalId: { type: "string" },
      numResults: { type: "number", minimum: 1, maximum: 25, default: 10 },
      outputSchema: { type: "object" },
      systemPrompt: { type: "string" },
    },
    required: ["approvalId"],
    additionalProperties: false,
  };
}
