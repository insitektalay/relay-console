import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const projection = [
  action(
    "olark_transcript_project",
    "Project transcript metadata",
    "Project one completed Olark transcript webhook into content-free operational counts and timestamps.",
  ),
];

export const OLARK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "olark",
  name: "Olark",
  connectorType: "webhook_automation_platform",
  providerDocsUrl: "https://www.olark.com/help/webhooks",
  providerWebsiteUrl: "https://www.olark.com/",
  capabilities: [
    {
      ...capability(
        "transcript_metadata_read",
        "Read transcript operations",
        "Project completed transcript webhook payloads into IDs, counts, and timestamps without messages, visitor identities, contact details, page history, custom fields, tags, group/operator identities, or raw payloads.",
        true,
      ),
      platformCapability: "olark_transcript_metadata_read",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "OLARK_RELAY_WEBHOOK_SECRET",
        label: "Relay Olark webhook secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["custom"],
        helpText:
          "Use a Relay-generated opaque callback secret because Olark's documented transcript webhook does not describe request signing.",
      },
    ],
  },
  tools: [
    {
      name: "olark.projectTranscript",
      functionName: "olark_transcript_project",
      aliases: ["olark.projectTranscript", "olark_transcript_project"],
      capability: "transcript_metadata_read",
      platformCapability: "olark_transcript_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Project one internally received completed transcript into content-free operational metadata; caller-controlled URLs and JavaScript execution are not exposed.",
      inputSchema: {
        type: "object",
        properties: { transcript: { type: "object" } },
        required: ["transcript"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "olark_safe",
      label: "Safe",
      description:
        "Every transcript projection requires approval; Relay ingress-secret isolation, payload bounds, content exclusion, and audits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: projection,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Transcript projections run without Relay per-action approval; ingress-secret isolation, bounds, content exclusion, and audits still apply.",
      defaultSelected: false,
      allowedActions: projection,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "webhook_secret", label: "Relay Olark webhook ingress secret check" },
  ],
};
