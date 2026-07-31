import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "sessionize_sessions_list",
    "List sessions",
    "List at most twenty-five sessions from one organizer-configured Sessionize endpoint.",
  ),
  action(
    "sessionize_session_get",
    "Read a session",
    "Read one exact session from the configured endpoint.",
  ),
];
const blocks = [
  blocked(
    "sessionize_custom_fields",
    "Block custom fields and files",
    "Questions, answers, custom fields, files, links, biographies and unselected endpoint data are not exposed.",
  ),
  blocked(
    "sessionize_account_data",
    "Block organizer account data",
    "Submissions, evaluations, private speaker records, team settings and organizer account data are not accessible through this connector.",
  ),
  blocked(
    "sessionize_raw_api",
    "Block raw endpoint access",
    "Arbitrary endpoint IDs, views, XML, automatic traversal and raw responses are not exposed.",
  ),
];
export const SESSIONIZE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sessionize",
  name: "Sessionize",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://sessionize.com/playbook/api",
  providerWebsiteUrl: "https://sessionize.com/",
  capabilities: [
    {
      ...capability(
        "schedule_read",
        "Read published schedule",
        "Read bounded session metadata from one organizer-created, field-selected Sessionize endpoint.",
        true,
      ),
      platformCapability: "schedule_read",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "SESSIONIZE_ENDPOINT_ID",
        label: "Sessionize endpoint ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText:
          "Create a JSON Sessions endpoint with only intended public fields, then enter its unique endpoint ID.",
      },
    ],
  },
  tools: [
    {
      name: "relay_sessionize_list_sessions",
      functionName: "relay_sessionize_list_sessions",
      aliases: ["sessionize_sessions_list"],
      capability: "schedule_read",
      platformCapability: "schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five sessions from the configured Sessionize endpoint.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_sessionize_get_session",
      functionName: "relay_sessionize_get_session",
      aliases: ["sessionize_session_get"],
      capability: "schedule_read",
      platformCapability: "schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact session from the configured Sessionize endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$",
          },
        },
        required: ["sessionId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sessionize_safe",
      label: "Safe",
      description:
        "Bounded schedule reads run directly; custom fields, files, private account data and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; endpoint selection, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "sessions", label: "Bounded Sessionize session list" }],
};
