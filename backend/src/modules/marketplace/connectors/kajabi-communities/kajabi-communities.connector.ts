import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "kajabi_communities_site_list",
    "List sites",
    "List up to twenty-five Kajabi sites.",
  ),
  action(
    "kajabi_communities_product_list",
    "List products",
    "List bounded product summaries so Community products can be identified by documented product type.",
  ),
  action(
    "kajabi_communities_product_get",
    "Read product",
    "Read one exact product, including its documented product type and member count.",
  ),
  action(
    "kajabi_communities_offer_list",
    "List offers",
    "List bounded offer summaries used to grant product access.",
  ),
  action(
    "kajabi_communities_offer_products_list",
    "List offer products",
    "List the products attached to one exact offer.",
  ),
];
const memberReads = [
  action(
    "kajabi_communities_contact_list",
    "Find contacts",
    "Find up to twenty-five contacts in one site using only name, email, timestamps, and optional offer membership.",
  ),
  action(
    "kajabi_communities_contact_offers_list",
    "List contact offers",
    "List the offers granted to one exact contact.",
  ),
];
const accessWrites = [
  action(
    "kajabi_communities_offer_grant",
    "Grant offer access",
    "Grant one exact offer to one exact contact without sending a welcome email.",
  ),
  action(
    "kajabi_communities_offer_revoke",
    "Revoke offer access",
    "Revoke one exact offer from one exact contact.",
  ),
];
const selected = [...catalogReads, ...memberReads, ...accessWrites];
const blockedActions = [
  blocked(
    "kajabi_communities_content",
    "Operate Community content",
    "Community Access Groups, channels, posts, chats, DMs, events, live rooms, recordings, challenges, announcements, and resources are not exposed by Kajabi's documented public API.",
  ),
  blocked(
    "kajabi_communities_bulk_access",
    "Bulk or replace access",
    "Bulk grants, bulk revocations, and replace-all offer operations are outside V1 because they can silently alter unrelated access.",
  ),
  blocked(
    "kajabi_communities_broader_kajabi",
    "Administer broader Kajabi",
    "Courses, marketing, forms, sites, payments, payouts, orders, purchases, subscriptions, webhooks, tags, notes, and account administration are outside this Communities-focused V1.",
  ),
  blocked(
    "kajabi_communities_private_data",
    "Read broader contact data",
    "Phone numbers, addresses, business numbers, custom fields, tags, notes, and raw contact records are outside V1.",
  ),
  blocked(
    "kajabi_communities_raw_api",
    "Use arbitrary Kajabi APIs",
    "Arbitrary paths, origins, headers, fields, automatic pagination, and raw API responses are outside V1.",
  ),
];

const id = () => ({
  type: "string",
  minLength: 1,
  maxLength: 100,
  pattern: "^[A-Za-z0-9_-]+$",
});
const pagination = {
  page: { type: "integer", minimum: 1, maximum: 10_000 },
  maxResults: { type: "integer", minimum: 1, maximum: 25 },
};
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  actionType: "read" | "write",
  description: string,
  properties: Record<string, unknown>,
  required: string[],
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `kajabi_communities_${capabilityId}`,
  action: actionType,
  approvalRequired: true,
  description,
  inputSchema: {
    type: "object",
    properties: {
      ...properties,
      approvalId: { type: "string", minLength: 1, maxLength: 200 },
    },
    required: [...required, "approvalId"],
    additionalProperties: false,
  },
});

export const KAJABI_COMMUNITIES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "kajabi-communities",
    name: "Kajabi Communities",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://help.kajabi.com/api-reference/introduction",
    providerWebsiteUrl: "https://kajabi.com/features/communities",
    capabilities: [
      {
        ...capability(
          "catalog_read",
          "Read Community access catalog",
          "Inspect sites, products, product types, offers, and offer-product relationships.",
          true,
        ),
        platformCapability: "kajabi_communities_catalog_read",
      },
      {
        ...capability(
          "member_access_read",
          "Read member access",
          "Find bounded contact identity and inspect offer grants.",
          true,
        ),
        platformCapability: "kajabi_communities_member_access_read",
      },
      {
        ...capability(
          "member_access_write",
          "Change member access",
          "Grant or revoke one exact offer for one exact contact.",
          true,
        ),
        platformCapability: "kajabi_communities_member_access_write",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "KAJABI_COMMUNITIES_CLIENT_ID",
          label: "Kajabi Public API client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create a dedicated User API Key as a Kajabi Owner or Subowner with only the permissions this connection needs.",
        },
        {
          name: "KAJABI_COMMUNITIES_CLIENT_SECRET",
          label: "Kajabi Public API client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Relay encrypts the secret and never exposes it to agents after saving.",
        },
      ],
    },
    tools: [
      tool(
        "kajabiCommunities.listSites",
        "kajabi_communities_site_list",
        "catalog_read",
        "read",
        "List a bounded page of Kajabi sites.",
        pagination,
        [],
      ),
      tool(
        "kajabiCommunities.listProducts",
        "kajabi_communities_product_list",
        "catalog_read",
        "read",
        "List products and their documented product type.",
        {
          ...pagination,
          siteId: id(),
          title: { type: "string", minLength: 1, maxLength: 100 },
        },
        [],
      ),
      tool(
        "kajabiCommunities.getProduct",
        "kajabi_communities_product_get",
        "catalog_read",
        "read",
        "Read one exact product and its product type.",
        { productId: id() },
        ["productId"],
      ),
      tool(
        "kajabiCommunities.listOffers",
        "kajabi_communities_offer_list",
        "catalog_read",
        "read",
        "List bounded offer summaries.",
        {
          ...pagination,
          siteId: id(),
          title: { type: "string", minLength: 1, maxLength: 100 },
        },
        [],
      ),
      tool(
        "kajabiCommunities.listOfferProducts",
        "kajabi_communities_offer_products_list",
        "catalog_read",
        "read",
        "List products attached to one exact offer.",
        { offerId: id(), ...pagination },
        ["offerId"],
      ),
      tool(
        "kajabiCommunities.listContacts",
        "kajabi_communities_contact_list",
        "member_access_read",
        "read",
        "Find bounded contacts within one exact site, optionally filtered by search text or exact offer.",
        {
          siteId: id(),
          search: { type: "string", minLength: 1, maxLength: 100 },
          offerId: id(),
          ...pagination,
        },
        ["siteId"],
      ),
      tool(
        "kajabiCommunities.listContactOffers",
        "kajabi_communities_contact_offers_list",
        "member_access_read",
        "read",
        "List offers granted to one exact contact.",
        { contactId: id(), ...pagination },
        ["contactId"],
      ),
      tool(
        "kajabiCommunities.grantOffer",
        "kajabi_communities_offer_grant",
        "member_access_write",
        "write",
        "Grant one exact offer to one exact contact without sending a welcome email.",
        { contactId: id(), offerId: id() },
        ["contactId", "offerId"],
      ),
      tool(
        "kajabiCommunities.revokeOffer",
        "kajabi_communities_offer_revoke",
        "member_access_write",
        "write",
        "Revoke one exact offer from one exact contact.",
        { contactId: id(), offerId: id() },
        ["contactId", "offerId"],
      ),
    ],
    approvalProfiles: [
      {
        id: "kajabi_communities_safe",
        label: "Safe",
        description:
          "Catalog reads run directly; contact identity, access inspection, grants, and revocations require matching approval.",
        defaultSelected: true,
        allowedActions: catalogReads,
        approvalRequiredActions: [...memberReads, ...accessWrites],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All selected bounded Kajabi Communities V1 tools run without Relay per-action approval; credential encryption, fixed origins, audits, provider permissions, and system blocks still apply.",
        defaultSelected: false,
        allowedActions: selected,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "kajabi_communities_client_credentials",
        label:
          "Kajabi Public API credentials can obtain a token and read the connected user",
      },
    ],
  };
