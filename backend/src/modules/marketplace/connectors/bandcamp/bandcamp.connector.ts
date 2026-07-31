import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  BANDCAMP_MUTATION_OPERATIONS,
  BANDCAMP_READ_OPERATIONS,
} from "./bandcamp-api.adapter";
const read = action(
  "bandcamp_read",
  "Read Bandcamp commerce",
  "Read affiliated accounts, sales reports, merchandise, shipping origins, and orders.",
);
const manage = action(
  "bandcamp_manage",
  "Manage Bandcamp commerce",
  "Generate reports or update shipment, inventory, and SKU state; Safe mode requires approval.",
);
const blockedActions = [
  blocked(
    "bandcamp_secret_exposure",
    "Expose Bandcamp secrets",
    "Client credentials, refresh and access tokens, buyer data, and authorization headers are never exposed outside bounded results.",
  ),
  blocked(
    "bandcamp_consumer_surface",
    "Use consumer or private interfaces",
    "Fan playback, catalog publishing, scraping, browser automation, arbitrary endpoints, and unofficial calls are blocked.",
  ),
  blocked(
    "bandcamp_unbounded_transfer",
    "Transfer unbounded commerce data",
    "Each action calls one pinned endpoint with 2 MB request and 10 MB response bounds; broad reports should use asynchronous generation.",
  ),
];
export const BANDCAMP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bandcamp",
  name: "Bandcamp",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://bandcamp.com/developer",
  providerWebsiteUrl: "https://bandcamp.com/",
  capabilities: [
    {
      ...capability(
        "bandcamp_read",
        "Read label and fulfillment commerce",
        "Read affiliated artists and labels, sales reports, merch details, shipping origins, and order data.",
        true,
      ),
      platformCapability: "bandcamp_read",
    },
    {
      ...capability(
        "bandcamp_manage",
        "Manage reports, fulfillment, and inventory",
        "Generate sales reports and update shipping state, quantities, and SKUs through transactional official endpoints.",
        true,
      ),
      platformCapability: "bandcamp_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BANDCAMP_CLIENT_ID",
        label: "Bandcamp client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Per-user API client ID issued after Bandcamp approves a label or fulfillment-partner use case.",
      },
      {
        name: "BANDCAMP_CLIENT_SECRET",
        label: "Bandcamp client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Per-user client secret stored only by Railway.",
      },
      {
        name: "BANDCAMP_REFRESH_TOKEN",
        label: "Bandcamp refresh token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Initial refresh token obtained once through the approved client-credentials grant and stored only by Railway.",
      },
    ],
  },
  tools: [
    {
      name: "bandcamp.read",
      functionName: "bandcamp_read",
      aliases: ["bandcamp.read", "bandcamp_read"],
      capability: "bandcamp_read",
      platformCapability: "bandcamp_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned Bandcamp commerce query.",
      inputSchema: schema(BANDCAMP_READ_OPERATIONS, false),
    },
    {
      name: "bandcamp.manage",
      functionName: "bandcamp_manage",
      aliases: ["bandcamp.manage", "bandcamp_manage"],
      capability: "bandcamp_manage",
      platformCapability: "bandcamp_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Bandcamp commerce mutation; Safe mode requires approval.",
      inputSchema: schema(BANDCAMP_MUTATION_OPERATIONS, true),
    },
  ],
  approvalProfiles: [
    {
      id: "bandcamp_safe",
      label: "Safe",
      description:
        "Bounded commerce queries run directly; report generation and every fulfillment or inventory mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected approved-account mutations run without Relay per-action approval; account authority, pinned endpoints, transaction semantics, bounds, audits, redaction, and provider rules still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "my_bands",
      label: "Bandcamp affiliated-account validation",
      requiredScopes: [],
    },
  ],
};
function schema(operations: string[], approval: boolean) {
  return {
    type: "object",
    properties: {
      operation: { type: "string", enum: operations },
      input: { type: "object", maxProperties: 100 },
      ...(approval ? { approvalId: { type: "string", maxLength: 200 } } : {}),
    },
    required: ["operation"],
    additionalProperties: false,
  };
}
