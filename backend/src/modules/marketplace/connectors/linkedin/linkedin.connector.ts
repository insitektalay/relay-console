import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];

const allowed = [
  action("linkedin_profile_get", "Get LinkedIn member profile", "Read bounded OpenID profile fields for the connected member; email and picture are excluded."),
  action("linkedin_post_draft", "Draft LinkedIn text post", "Create one local text-only draft of at most 3,000 characters without calling LinkedIn."),
];
const approvalRequired = [
  action("linkedin_text_post_create", "Publish LinkedIn text post", "Publish one public text-only post as the connected member after explicit approval."),
];
const blockedActions = [
  blocked("linkedin_email_enrichment_people", "Access email or enriched identity", "Email, picture, identity verification, profile enrichment, other members, connections, invitations, and people search are outside V1."),
  blocked("linkedin_social_reads_comments_likes", "Read or engage with social content", "Feed/post reads, member social reads, comments, likes, reactions, and other engagement are outside V1."),
  blocked("linkedin_media_organizations_ads", "Use broader LinkedIn products", "Media, assets, documents, articles, reshares, polls, celebrations, mentions, organizations, analytics, ads, leads, and Learning are outside V1."),
  blocked("linkedin_messaging_search_scraping", "Message, search, or scrape", "DMs, messaging, network search, scraping, browser automation, and unofficial endpoints are blocked."),
  blocked("linkedin_bulk_retry_pagination_raw", "Use broad or raw access", "Bulk or scheduled publishing, automatic retries or pagination, raw provider requests, RPC, GraphQL, and MCP surfaces are outside V1."),
];

export const LINKEDIN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "linkedin",
  name: "LinkedIn",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  providerWebsiteUrl: "https://www.linkedin.com/",
  capabilities: [
    { ...capability("identity", "Read connected member", "Read bounded OpenID profile fields for the connected member.", true), platformCapability: "linkedin_member_identity_read" },
    { ...capability("draft", "Draft text post", "Create a bounded text-only draft locally without a provider call.", true), platformCapability: "linkedin_text_draft" },
    { ...capability("publish", "Publish text post", "Publish one public text-only post as the connected member after approval.", false), platformCapability: "linkedin_member_text_publish" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      userInfoUrl: "https://api.linkedin.com/v2/userinfo",
      requiredScopes: LINKEDIN_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      { name: "LINKEDIN_CLIENT_ID", label: "LinkedIn OAuth client ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["oauth"], helpText: "Relay-owned LinkedIn application client ID configured only on Railway." },
      { name: "LINKEDIN_CLIENT_SECRET", label: "LinkedIn OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["oauth"], helpText: "Relay-owned LinkedIn application secret retained only by Railway." },
    ],
  },
  tools: [
    { name: "linkedin.getProfile", functionName: "linkedin_profile_get", aliases: ["linkedin.getProfile", "relay_linkedin_get_profile"], capability: "identity", platformCapability: "linkedin_member_identity_read", action: "read", approvalRequired: false, description: "Read bounded OpenID profile fields for the connected member.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "linkedin.createDraft", functionName: "linkedin_post_draft", aliases: ["linkedin.createDraft", "relay_linkedin_draft_post"], capability: "draft", platformCapability: "linkedin_text_draft", action: "read", approvalRequired: false, description: "Create one local text-only LinkedIn draft without a provider call.", inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1, maxLength: 3000 } }, required: ["text"], additionalProperties: false } },
    { name: "linkedin.createTextPost", functionName: "linkedin_text_post_create", aliases: ["linkedin.createTextPost", "relay_linkedin_create_text_post"], capability: "publish", platformCapability: "linkedin_member_text_publish", action: "write", approvalRequired: true, description: "Publish one approved public text-only post as the connected member.", inputSchema: { type: "object", properties: { approvalId: { type: "string" }, text: { type: "string", minLength: 1, maxLength: 3000 } }, required: ["approvalId", "text"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "linkedin_safe", label: "Safe", description: "Bounded profile reads and local drafts run automatically; one connected-member public text post requires approval, while broader identity, social, media, organization, messaging, search, bulk, and raw surfaces remain blocked.", defaultSelected: true, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The same three actions run without Relay per-action approval; exact scopes, connected-member authorship, text-only body, 3,000-character limit, audit, and API controls still apply.", defaultSelected: false, allowedActions: allowed, approvalRequiredActions: approvalRequired, blockedActions },
  ],
  healthChecks: [{ id: "member_profile", label: "LinkedIn exact scopes, finite token, no assumed refresh token, and connected-member OpenID profile validation", requiredScopes: LINKEDIN_SCOPES }],
};
