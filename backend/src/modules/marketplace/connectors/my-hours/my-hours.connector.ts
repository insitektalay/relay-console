import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  MY_HOURS_MANAGE_OPERATION_IDS,
  MY_HOURS_OPERATIONS,
  MY_HOURS_READ_OPERATION_IDS,
} from "./my-hours-operation-registry";

const read = action(
  "my_hours_read",
  "Read My Hours",
  "Read authorized time logs, projects, tasks, assignments, reports, clients, tags, users, and teams.",
);
const manage = action(
  "my_hours_manage",
  "Manage My Hours",
  "Create, edit, archive, copy, assign, tag, start, stop, or delete authorized My Hours records; Safe mode requires approval.",
);

export const MY_HOURS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "my-hours",
  name: "My Hours",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://documenter.getpostman.com/view/8879268/TVmV4YYU",
  providerWebsiteUrl: "https://myhours.com/",
  capabilities: [
    {
      ...capability(
        "my_hours_read",
        "Read time, work, reports, and people",
        `Use all ${MY_HOURS_READ_OPERATION_IDS.length} pinned semantic reads in My Hours API v1.1.`,
        true,
      ),
      platformCapability: "my_hours_read",
    },
    {
      ...capability(
        "my_hours_manage",
        "Manage time, work, and people",
        `Use all ${MY_HOURS_MANAGE_OPERATION_IDS.length} pinned mutations in My Hours API v1.1.`,
        true,
      ),
      platformCapability: "my_hours_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MY_HOURS_API_KEY",
        label: "My Hours API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create an API key in My Hours under Settings, Integrations, API keys. API access requires a paid My Hours plan; Relay encrypts the key and sends it only to api2.myhours.com.",
      },
    ],
  },
  tools: [
    {
      name: "myHours.read",
      functionName: "my_hours_read",
      aliases: ["myHours.read", "my_hours_read"],
      capability: "my_hours_read",
      platformCapability: "my_hours_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, semantically read-only My Hours operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...MY_HOURS_READ_OPERATION_IDS] },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
          json: {},
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "myHours.manage",
      functionName: "my_hours_manage",
      aliases: ["myHours.manage", "my_hours_manage"],
      capability: "my_hours_manage",
      platformCapability: "my_hours_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned My Hours mutation with bounded arguments and results; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...MY_HOURS_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 100 },
          json: {},
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "my_hours_safe",
      label: "Safe",
      description: `All ${MY_HOURS_READ_OPERATION_IDS.length} semantic reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${MY_HOURS_OPERATIONS.length} selected and API-key-authorized operations run without Relay per-action approval; connection ownership, My Hours user permissions, paid-plan access, exact routes, bounds, audits, redaction, and provider limits still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_projects",
      label: "My Hours API key and active-project access check",
    },
  ],
};
