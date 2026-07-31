import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "segment_workspace_binding_get",
    "Read Workspace binding",
    "Validate the exact regional Public API origin, token, and Workspace ID without returning the Workspace name or slug.",
  ),
  action(
    "segment_source_list",
    "List Sources",
    "Read one fixed page of twenty-five Source structural summaries without names, write keys, settings, labels, or catalog descriptions.",
  ),
  action(
    "segment_destination_list",
    "List Destinations",
    "Read one fixed page of twenty-five Destination structural summaries without names, settings, secrets, actions, or catalog descriptions.",
  ),
];
const blockedActions = [
  blocked(
    "segment_customer_data",
    "Access customer data",
    "Events, users, profiles, traits, identities, audiences, samples, delivery payloads, and customer insights are outside V1.",
  ),
  blocked(
    "segment_secret_configuration",
    "Access secret configuration",
    "Source write keys, Destination settings and secrets, Warehouse credentials, Function code, filters, subscriptions, and private configuration are outside V1.",
  ),
  blocked(
    "segment_mutation",
    "Change Segment configuration",
    "Creating, enabling, disabling, updating, deleting, connecting, syncing, or otherwise mutating Segment resources is outside V1.",
  ),
  blocked(
    "segment_broader_api",
    "Access broader Segment APIs",
    "Warehouses, Tracking Plans, catalogs, Functions, transformations, labels, roles, tokens, audit, usage, monitoring, and Config/Profile APIs are outside V1.",
  ),
  blocked(
    "segment_raw_query",
    "Run arbitrary requests",
    "Arbitrary origins, paths, IDs, cursors, page sizes, filters, pagination, crawling, synchronization, downloads, exports, and raw API access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const SEGMENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "segment",
  name: "Segment",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.segmentapis.com/",
  providerWebsiteUrl: "https://segment.com/",
  capabilities: [
    {
      ...capability(
        "workspace_binding",
        "Workspace binding",
        "Validate one exact Workspace-scoped Public API token and regional origin.",
        true,
      ),
      platformCapability: "segment_workspace_read",
    },
    {
      ...capability(
        "source_metadata",
        "Source metadata",
        "List bounded Source structural summaries.",
        true,
      ),
      platformCapability: "segment_source_read",
    },
    {
      ...capability(
        "destination_metadata",
        "Destination metadata",
        "List bounded Destination structural summaries.",
        true,
      ),
      platformCapability: "segment_destination_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SEGMENT_PUBLIC_API_ORIGIN",
        label: "Segment Public API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter https://api.segmentapis.com for a US Workspace or https://eu1.api.segmentapis.com for an EU Workspace. Relay rejects every other origin.",
      },
      {
        name: "SEGMENT_WORKSPACE_ID",
        label: "Segment Workspace ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact Workspace ID associated with the dedicated Public API token so Relay can validate token binding before use.",
      },
      {
        name: "SEGMENT_PUBLIC_API_TOKEN",
        label: "Segment Public API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Public API token—not a write key, Config API token, Profile API token, or Destination OAuth credential—with only the roles needed to get the Workspace and list Sources and Destinations.",
      },
    ],
  },
  tools: [
    {
      name: "segment.getWorkspaceBinding",
      functionName: "segment_workspace_binding_get",
      aliases: ["segment.getWorkspaceBinding", "segment_workspace_binding_get"],
      capability: "workspace_binding",
      platformCapability: "segment_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate the exact regional origin, token, and Workspace ID without returning Workspace names.",
      inputSchema: emptySchema,
    },
    {
      name: "segment.listSources",
      functionName: "segment_source_list",
      aliases: ["segment.listSources", "segment_source_list"],
      capability: "source_metadata",
      platformCapability: "segment_source_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one fixed page of twenty-five redacted Source structural summaries.",
      inputSchema: emptySchema,
    },
    {
      name: "segment.listDestinations",
      functionName: "segment_destination_list",
      aliases: ["segment.listDestinations", "segment_destination_list"],
      capability: "destination_metadata",
      platformCapability: "segment_destination_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one fixed page of twenty-five redacted Destination structural summaries.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "segment_safe",
      label: "Safe",
      description:
        "Three bounded configuration-metadata reads run automatically; customer data, write keys, settings, secrets, broader APIs, arbitrary requests, downloads, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact regional-origin and Workspace binding, fixed pages, audit, secret stripping, redaction, and provider limits remain enforced.",
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
        "Segment Public API token, regional origin, and exact Workspace ID validation",
      requiredScopes: [],
    },
  ],
};
