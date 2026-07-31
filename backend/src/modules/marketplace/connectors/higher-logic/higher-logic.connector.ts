import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "higher_logic_actor_get",
    "Read connected contact",
    "Read reduced identity and status metadata for the exactly configured Higher Logic contact.",
  ),
  action(
    "higher_logic_my_community_list",
    "List joined communities",
    "List up to twenty-five reduced Communities joined by the connected contact.",
  ),
  action(
    "higher_logic_viewable_community_list",
    "List viewable communities",
    "List up to twenty-five reduced non-hidden Communities visible to the connected contact.",
  ),
  action(
    "higher_logic_contributable_community_list",
    "List contributable communities",
    "List up to twenty-five reduced Communities where the connected contact can contribute.",
  ),
];
const protectedReads = [
  action(
    "higher_logic_discussion_list",
    "List eligible discussions",
    "List up to twenty-five reduced Discussion identity and subscription summaries without posts, bodies, authors, or URLs.",
  ),
  action(
    "higher_logic_event_list",
    "List upcoming events",
    "List up to twenty-five reduced upcoming Event schedule and type summaries without descriptions, registrants, contact data, registration links, or raw records.",
  ),
];
const selected = [...catalogReads, ...protectedReads];
const blockedActions = [
  blocked(
    "higher_logic_content",
    "Read or write content",
    "Discussion posts, questions, answers, blogs, comments, documents, attachments, library content, announcements, ideas, descriptions, message bodies, files, media, and arbitrary rich content are outside V1.",
  ),
  blocked(
    "higher_logic_contact_lifecycle",
    "Manage contacts",
    "Creating, updating, deleting, merging, impersonating, searching, exporting, changing demographics, profiles, pictures, email preferences, security groups, terms acceptance, or code-of-conduct acceptance is outside V1.",
  ),
  blocked(
    "higher_logic_membership",
    "Change community membership",
    "Joining, leaving, inviting, accepting or rejecting invitations, subscriptions, follows, favorites, RSVPs, volunteering, friendships, and all other membership or relationship changes are outside V1.",
  ),
  blocked(
    "higher_logic_structure_admin",
    "Administer Thrive Community",
    "Creating, updating, deleting, restoring, or configuring Communities, Discussions, Events, Libraries, Tags, Ideation, Automation Rules, External Activities, search items, settings, integrations, and site state is outside V1.",
  ),
  blocked(
    "higher_logic_moderation",
    "Moderate community",
    "Editing, recommending, deleting, removing, approving, marking answers, changing idea status, and otherwise moderating content or contacts is outside V1.",
  ),
  blocked(
    "higher_logic_communication",
    "Communicate or notify",
    "Posting, replying, private messaging, marking messages, email, invitations, announcements, notifications, cross-posting, anonymous posting, and outbound integrations are outside V1.",
  ),
  blocked(
    "higher_logic_bulk_or_analytics",
    "Run bulk or analytics actions",
    "Automatic pagination, bulk loops, polling, reports, tracking metrics, data feeds, exports, imports, registrant data, attendance, member updates, analytics, and sustained high-rate access are outside V1.",
  ),
  blocked(
    "higher_logic_private_identity",
    "Read broader identity data",
    "Emails, phone numbers, addresses, demographics, profile fields, company data, security groups, friends, inbox data, invitations, registrants, volunteers, external activities, and raw Contact records are outside V1.",
  ),
  blocked(
    "higher_logic_raw_api",
    "Use arbitrary Higher Logic APIs",
    "Arbitrary endpoints, methods, parameters, bodies, headers, alternate hosts, raw responses, API discovery, login or token endpoints, OIDC flows, browser cookies, Thrive Marketing APIs, SOAP, Push API, File API, CLI, and direct database access are outside V1.",
  ),
];

const maxResults = { type: "integer", minimum: 1, maximum: 25 };
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  description: string,
  properties: Record<string, unknown>,
  approvalRequired: boolean,
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `higher_logic_${capabilityId}`,
  action: "read" as const,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties: {
      ...properties,
      ...(approvalRequired
        ? { approvalId: { type: "string", minLength: 1, maxLength: 200 } }
        : {}),
    },
    required: approvalRequired ? ["approvalId"] : [],
    additionalProperties: false,
  },
});

export const HIGHER_LOGIC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "higher-logic",
  name: "Higher Logic",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.higherlogic.com/v2.0/Help",
  providerWebsiteUrl: "https://www.higherlogic.com/",
  capabilities: [
    {
      ...capability(
        "community_catalog_read",
        "Read community catalog",
        "Inspect the connected contact and bounded joined, viewable, and contributable Community metadata.",
        true,
      ),
      platformCapability: "higher_logic_community_catalog_read",
    },
    {
      ...capability(
        "discussion_catalog_read",
        "Read discussion catalog",
        "Inspect bounded eligible Discussion identity and subscription metadata without content.",
        true,
      ),
      platformCapability: "higher_logic_discussion_catalog_read",
    },
    {
      ...capability(
        "event_catalog_read",
        "Read event catalog",
        "Inspect bounded upcoming Event schedule and type metadata without descriptions or registrants.",
        true,
      ),
      platformCapability: "higher_logic_event_catalog_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HIGHER_LOGIC_REGION",
        label: "Higher Logic API region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us for api.higherlogic.com or ca for api.onlinecommunity.ca. Relay accepts no custom API host.",
      },
      {
        name: "HIGHER_LOGIC_CONTACT_KEY",
        label: "Higher Logic contact key",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact ContactKey represented by the dedicated IAM credential. Relay rejects a different authenticated contact.",
      },
      {
        name: "HIGHER_LOGIC_IAM_KEY",
        label: "Higher Logic IAM key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Obtain a dedicated contact-specific IAM key from Higher Logic. Relay encrypts it and sends it only in the HLIAMKey header.",
      },
      {
        name: "HIGHER_LOGIC_API_PASSWORD",
        label: "Higher Logic API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the pre-established password for the dedicated IAM credential. Relay encrypts it and sends it only in the HLPassword header.",
      },
    ],
  },
  tools: [
    tool(
      "higherLogic.getCurrentContact",
      "higher_logic_actor_get",
      "community_catalog_read",
      "Read reduced metadata for the exactly configured contact.",
      {},
      false,
    ),
    tool(
      "higherLogic.listMyCommunities",
      "higher_logic_my_community_list",
      "community_catalog_read",
      "List a bounded projection of Communities joined by the connected contact.",
      { maxResults },
      false,
    ),
    tool(
      "higherLogic.listViewableCommunities",
      "higher_logic_viewable_community_list",
      "community_catalog_read",
      "List a bounded projection of non-hidden Communities visible to the connected contact.",
      { maxResults },
      false,
    ),
    tool(
      "higherLogic.listContributableCommunities",
      "higher_logic_contributable_community_list",
      "community_catalog_read",
      "List a bounded projection of Communities where the connected contact can contribute.",
      { maxResults },
      false,
    ),
    tool(
      "higherLogic.listEligibleDiscussions",
      "higher_logic_discussion_list",
      "discussion_catalog_read",
      "List bounded eligible Discussion metadata without posts, bodies, authors, or URLs.",
      { maxResults },
      true,
    ),
    tool(
      "higherLogic.listUpcomingEvents",
      "higher_logic_event_list",
      "event_catalog_read",
      "List bounded upcoming Event schedule and type metadata without descriptions, registrants, contact data, or registration links.",
      { maxResults },
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "higher_logic_safe",
      label: "Safe",
      description:
        "Connected-contact and joined, viewable, and contributable Community catalog reads run directly. Eligible Discussion and upcoming Event metadata require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: protectedReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All six selected bounded Higher Logic V1 reads run without Relay per-action approval; encrypted credentials, fixed region, exact-contact binding, provider permissions, fixed routes, bounds, audits, privacy reduction, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "higher_logic_iam_credentials",
      label:
        "IAM key and API password authenticate the exactly configured contact on the fixed regional Thrive Community API",
    },
  ],
};
