import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "customer_io_workspace_binding_get",
    "Read workspace binding",
    "Validate the exact App API origin, key, and configured Workspace ID without returning workspace names, usage, or profile counts.",
  ),
  action(
    "customer_io_campaign_list",
    "List campaigns",
    "Read at most twenty-five Campaign lifecycle summaries without names, descriptions, actions, tags, audiences, or content.",
  ),
  action(
    "customer_io_broadcast_list",
    "List broadcasts",
    "Read at most twenty-five Broadcast lifecycle summaries without names, actions, tags, recipients, metrics, or content.",
  ),
];

const blockedActions = [
  blocked(
    "customer_io_people_private",
    "Access people or identity",
    "People, identifiers, profile attributes, devices, relationships, segment membership, and activity are outside V1.",
  ),
  blocked(
    "customer_io_message_private",
    "Access message or delivery detail",
    "Message content, recipients, deliveries, links, events, failures, transactional data, and person-level reports are outside V1.",
  ),
  blocked(
    "customer_io_mutation",
    "Change or send Customer.io data",
    "Triggering, sending, creating, updating, deleting, suppressing, or otherwise mutating Customer.io resources is outside V1.",
  ),
  blocked(
    "customer_io_broader_api",
    "Access broader Customer.io APIs",
    "Track, Pipelines, transactional send, exports, collections, segments, templates, reporting drilldowns, and administration are outside V1.",
  ),
  blocked(
    "customer_io_raw_query",
    "Run arbitrary requests",
    "Arbitrary origins, paths, filters, identifiers, pagination, crawling, synchronization, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const CUSTOMER_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "customer-io",
  name: "Customer.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.customer.io/integrations/api/app/",
  providerWebsiteUrl: "https://customer.io/",
  capabilities: [
    {
      ...capability(
        "workspace_binding",
        "Workspace binding",
        "Validate one exact Workspace-scoped App API key and regional origin.",
        true,
      ),
      platformCapability: "customer_io_workspace_read",
    },
    {
      ...capability(
        "campaign_metadata",
        "Campaign metadata",
        "List bounded, content-free Campaign lifecycle summaries.",
        true,
      ),
      platformCapability: "customer_io_campaign_read",
    },
    {
      ...capability(
        "broadcast_metadata",
        "Broadcast metadata",
        "List bounded, content-free Broadcast lifecycle summaries.",
        true,
      ),
      platformCapability: "customer_io_broadcast_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CUSTOMER_IO_APP_API_ORIGIN",
        label: "Customer.io App API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter https://api.customer.io for a US workspace or https://api-eu.customer.io for an EU workspace. Relay rejects every other origin.",
      },
      {
        name: "CUSTOMER_IO_WORKSPACE_ID",
        label: "Customer.io Workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact numeric Workspace ID associated with the dedicated App API key so Relay can validate the binding before use.",
      },
      {
        name: "CUSTOMER_IO_APP_API_KEY",
        label: "Customer.io App API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated App API key for the exact workspace. Customer.io shows the key once; rotate it regularly and optionally restrict it to Relay's egress IP addresses.",
      },
    ],
  },
  tools: [
    {
      name: "customer-io.getWorkspaceBinding",
      functionName: "customer_io_workspace_binding_get",
      aliases: [
        "customer-io.getWorkspaceBinding",
        "customer_io_workspace_binding_get",
      ],
      capability: "workspace_binding",
      platformCapability: "customer_io_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate the exact App API origin, key, and configured Workspace ID without returning workspace names or usage counts.",
      inputSchema: emptySchema,
    },
    {
      name: "customer-io.listCampaigns",
      functionName: "customer_io_campaign_list",
      aliases: ["customer-io.listCampaigns", "customer_io_campaign_list"],
      capability: "campaign_metadata",
      platformCapability: "customer_io_campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five content-free Campaign lifecycle summaries from the provider's fixed list endpoint.",
      inputSchema: emptySchema,
    },
    {
      name: "customer-io.listBroadcasts",
      functionName: "customer_io_broadcast_list",
      aliases: ["customer-io.listBroadcasts", "customer_io_broadcast_list"],
      capability: "broadcast_metadata",
      platformCapability: "customer_io_broadcast_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five content-free Broadcast lifecycle summaries from the provider's fixed list endpoint.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "customer_io_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; people, identity, content, deliveries, reports, broader APIs, arbitrary requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact regional-origin and Workspace binding, fixed endpoints, response limits, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspace",
      label:
        "Customer.io App API key, regional origin, and exact Workspace ID validation",
      requiredScopes: [],
    },
  ],
};
