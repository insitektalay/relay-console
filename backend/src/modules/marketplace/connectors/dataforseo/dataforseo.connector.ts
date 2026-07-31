import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const allowed = [
  action("dataforseo_serp_lookup", "Run SERP lookup", "Run bounded live Google organic SERP checks for explicit keywords."),
  action("dataforseo_rank_verify", "Verify ranking", "Check whether a target domain or URL appears in a bounded SERP result set."),
  action("dataforseo_backlink_summary", "Read backlink summary", "Read backlink profile summary metrics for an explicit target."),
  action("dataforseo_backlink_lookup", "Find backlinks", "Find bounded backlink rows for an explicit target."),
  action("dataforseo_backlink_verify", "Verify backlink", "Check whether an explicit referring page links to an explicit target."),
  action("dataforseo_page_inspect", "Inspect page", "Inspect an explicit page for HTTP, canonical, meta, and indexability signals."),
];

const approvalRequired = [
  action("dataforseo_bulk_or_deep_checks", "Bulk or deep checks", "Large batches, high SERP depth, broad backlink exports, and repeated verification jobs require approval."),
  action("dataforseo_export_results", "Export result sets", "Exporting or sharing large result sets outside the workspace requires approval."),
  action("dataforseo_costly_crawl", "Costly crawl", "Any crawl-like or high-cost DataForSEO operation requires explicit approval."),
];

const blockedActions = [
  blocked("dataforseo_secret_discovery", "Secret discovery", "Do not use DataForSEO to locate, expose, or verify leaked credentials, tokens, or private keys."),
  blocked("dataforseo_private_data_harvesting", "Private data harvesting", "Bulk personal-data collection and login-protected scraping are blocked."),
  blocked("dataforseo_access_bypass", "Access bypass", "Do not bypass paywalls, authentication, robots restrictions, or site access controls."),
];

export const DATAFORSEO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dataforseo",
  name: "DataForSEO",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.dataforseo.com",
  providerWebsiteUrl: "https://dataforseo.com",
  capabilities: [
    { ...capability("serp_search", "SERP Search", "Run bounded DataForSEO live Google organic SERP checks.", true), platformCapability: "external_search" },
    { ...capability("rank_verification", "Rank Verification", "Verify target domain or URL rankings in SERP result sets.", true), platformCapability: "rank_tracking" },
    { ...capability("backlink_summary", "Backlink Summary", "Read backlink summary metrics for explicit targets.", true), platformCapability: "backlink_analysis" },
    { ...capability("backlink_lookup", "Backlink Lookup", "Find bounded backlink rows for explicit targets.", true), platformCapability: "backlink_analysis" },
    { ...capability("backlink_verification", "Backlink Verification", "Verify whether explicit referring pages link to explicit targets.", true), platformCapability: "backlink_verification" },
    { ...capability("page_inspection", "Page Inspection", "Inspect explicit pages for HTTP, canonical, meta, and indexability signals.", true), platformCapability: "indexability_check" },
    { ...capability("bulk_research", "Bulk Research", "Run approval-gated high-volume SERP, backlink, or indexability checks.", false), platformCapability: "bulk_research" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DATAFORSEO_API_LOGIN",
        label: "DataForSEO API login",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "DataForSEO API login from your account API settings.",
      },
      {
        name: "DATAFORSEO_API_PASSWORD",
        label: "DataForSEO API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "DataForSEO API password from your account API settings.",
      },
      {
        name: "DATAFORSEO_BASE_URL",
        label: "DataForSEO base URL",
        required: false,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Optional. Defaults to https://api.dataforseo.com.",
      },
    ],
  },
  tools: [
    {
      name: "dataforseo.googleOrganicSerp",
      functionName: "dataforseo_google_organic_serp",
      aliases: ["dataforseo.googleOrganicSerp", "dataforseo_google_organic_serp", "google_organic_serp"],
      capability: "serp_search",
      platformCapability: "external_search",
      action: "read",
      approvalRequired: false,
      description: "Run a bounded live Google organic SERP lookup through DataForSEO.",
      inputSchema: serpInputSchema(),
    },
    {
      name: "dataforseo.verifyRanking",
      functionName: "dataforseo_verify_ranking",
      aliases: ["dataforseo.verifyRanking", "dataforseo_verify_ranking", "verify_ranking"],
      capability: "rank_verification",
      platformCapability: "rank_tracking",
      action: "read",
      approvalRequired: false,
      description: "Verify whether a target domain or URL ranks in bounded Google organic SERP results.",
      inputSchema: {
        ...serpInputSchema(),
        properties: {
          ...serpInputSchema().properties,
          target: { type: "string", minLength: 1 },
          matchMode: { type: "string", enum: ["domain", "url_contains", "exact_url"], default: "domain" },
        },
        required: ["query", "target"],
      },
    },
    {
      name: "dataforseo.backlinksSummary",
      functionName: "dataforseo_backlinks_summary",
      aliases: ["dataforseo.backlinksSummary", "dataforseo_backlinks_summary", "backlinks_summary"],
      capability: "backlink_summary",
      platformCapability: "backlink_analysis",
      action: "read",
      approvalRequired: false,
      description: "Read DataForSEO backlink summary metrics for an explicit domain or URL target.",
      inputSchema: targetInputSchema(),
    },
    {
      name: "dataforseo.findBacklinks",
      functionName: "dataforseo_find_backlinks",
      aliases: ["dataforseo.findBacklinks", "dataforseo_find_backlinks", "find_backlinks"],
      capability: "backlink_lookup",
      platformCapability: "backlink_analysis",
      action: "read",
      approvalRequired: false,
      description: "Find bounded backlink rows for an explicit domain or URL target.",
      inputSchema: {
        ...targetInputSchema(),
        properties: {
          ...targetInputSchema().properties,
          limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
          offset: { type: "number", minimum: 0, maximum: 1000, default: 0 },
          orderBy: { type: "array", items: { type: "string" }, maxItems: 3 },
        },
      },
    },
    {
      name: "dataforseo.verifyBacklink",
      functionName: "dataforseo_verify_backlink",
      aliases: ["dataforseo.verifyBacklink", "dataforseo_verify_backlink", "verify_backlink"],
      capability: "backlink_verification",
      platformCapability: "backlink_verification",
      action: "read",
      approvalRequired: false,
      description: "Verify whether a specific referring page is reported as linking to an explicit target.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", minLength: 1 },
          referringUrl: { type: "string", minLength: 1 },
          targetType: { type: "string", enum: ["domain", "url"], default: "domain" },
          limit: { type: "number", minimum: 1, maximum: 20, default: 10 },
        },
        required: ["target", "referringUrl"],
        additionalProperties: false,
      },
    },
    {
      name: "dataforseo.inspectPage",
      functionName: "dataforseo_inspect_page",
      aliases: ["dataforseo.inspectPage", "dataforseo_inspect_page", "inspect_page", "indexability_check"],
      capability: "page_inspection",
      platformCapability: "indexability_check",
      action: "read",
      approvalRequired: false,
      description: "Inspect an explicit page for status, canonical, meta, and indexability signals.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", minLength: 1 },
          enableJavascript: { type: "boolean", default: false },
          loadResources: { type: "boolean", default: false },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "dataforseo_safe_operator",
      label: "Safe Operator",
      description: "Bounded SERP, ranking, backlink, and page inspection calls are allowed; bulk, high-depth, and high-cost workflows require approval.",
      defaultSelected: true,
      allowedActions: allowed,
      approvalRequiredActions: approvalRequired,
      blockedActions,
    },
  ],
  healthChecks: [{ id: "google_locations", label: "DataForSEO Google locations smoke check" }],
};

function serpInputSchema() {
  return {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      locale: { type: "string", default: "en-us" },
      device: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
      depth: { type: "number", minimum: 1, maximum: 50, default: 20 },
      tag: { type: "string" },
    },
    required: ["query"],
    additionalProperties: false,
  };
}

function targetInputSchema() {
  return {
    type: "object",
    properties: {
      target: { type: "string", minLength: 1 },
      targetType: { type: "string", enum: ["domain", "url"], default: "domain" },
    },
    required: ["target"],
    additionalProperties: false,
  };
}
