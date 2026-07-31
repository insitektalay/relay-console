import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDraft = [
  action(
    "slack_canvas_sections_lookup",
    "Find canvas sections",
    "Find bounded section IDs in one explicit canvas using supported heading and text criteria.",
  ),
  action(
    "slack_canvas_draft",
    "Draft canvas content",
    "Prepare bounded Slack Canvas markdown locally without a provider side effect.",
  ),
];
const writes = [
  action(
    "slack_canvas_create",
    "Create standalone canvas",
    "Create one standalone canvas with bounded title and markdown content.",
  ),
  action(
    "slack_canvas_append",
    "Append canvas content",
    "Append bounded markdown to the start or end of one explicit writable canvas.",
  ),
];
const blockedActions = [
  blocked(
    "slack_canvas_destructive",
    "Block destructive canvas changes",
    "Canvas deletion, section deletion, whole-document replacement and arbitrary section-relative edits are not exposed.",
  ),
  blocked(
    "slack_canvas_access",
    "Block canvas access changes",
    "Ownership transfer and user or channel access grants and revocations are not exposed.",
  ),
  blocked(
    "slack_canvas_sensitive_content",
    "Block sensitive content expansion",
    "File downloads, broad canvas discovery, private-channel enumeration and automatic content export are not exposed.",
  ),
  blocked(
    "slack_canvas_raw_api",
    "Block raw Slack access",
    "Arbitrary Slack methods, caller-selected origins, raw tokens and unbounded requests are not exposed.",
  ),
];

export const SLACK_CANVAS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "slack-canvas",
  name: "Slack Canvas",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.slack.dev/surfaces/canvases/",
  providerWebsiteUrl: "https://slack.com/features/canvas",
  capabilities: [
    {
      ...capability(
        "canvas_read",
        "Find canvas sections",
        "Find bounded section IDs in one explicit canvas.",
        true,
      ),
      platformCapability: "slack_canvas_read",
    },
    {
      ...capability(
        "canvas_write",
        "Create and append canvas content",
        "Create a bounded standalone canvas or append markdown to one explicit canvas.",
        true,
      ),
      platformCapability: "slack_canvas_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SLACK_CANVAS_TOKEN",
        label: "Slack Canvas app token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A bot or user token from the customer's own Slack app with canvases:read and canvases:write. Railway stores it encrypted and sends it only to slack.com/api.",
      },
    ],
  },
  tools: [
    {
      name: "slackCanvas.lookupSections",
      functionName: "slack_canvas_sections_lookup",
      aliases: ["slackCanvas.lookupSections", "slack_canvas_sections_lookup"],
      capability: "canvas_read",
      platformCapability: "slack_canvas_read",
      action: "read",
      approvalRequired: false,
      description: "Find bounded section IDs in one explicit Slack canvas.",
      inputSchema: {
        type: "object",
        properties: {
          canvasId: { type: "string", pattern: "^F[A-Z0-9]{2,31}$" },
          containsText: { type: "string", maxLength: 200 },
          sectionTypes: {
            type: "array",
            maxItems: 4,
            items: { type: "string", enum: ["h1", "h2", "h3", "any_header"] },
          },
        },
        required: ["canvasId"],
        additionalProperties: false,
      },
    },
    {
      name: "slackCanvas.draft",
      functionName: "slack_canvas_draft",
      aliases: ["slackCanvas.draft", "slack_canvas_draft"],
      capability: "canvas_write",
      platformCapability: "slack_canvas_write",
      action: "draft",
      approvalRequired: false,
      description: "Prepare bounded Slack Canvas markdown locally.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 200 },
          markdown: { type: "string", minLength: 1, maxLength: 20000 },
        },
        required: ["markdown"],
        additionalProperties: false,
      },
    },
    {
      name: "slackCanvas.create",
      functionName: "slack_canvas_create",
      aliases: ["slackCanvas.create", "slack_canvas_create"],
      capability: "canvas_write",
      platformCapability: "slack_canvas_write",
      action: "write",
      approvalRequired: true,
      description: "Create one standalone canvas with bounded markdown.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 200 },
          markdown: { type: "string", minLength: 1, maxLength: 20000 },
          approvalId: { type: "string" },
        },
        required: ["markdown"],
        additionalProperties: false,
      },
    },
    {
      name: "slackCanvas.append",
      functionName: "slack_canvas_append",
      aliases: ["slackCanvas.append", "slack_canvas_append"],
      capability: "canvas_write",
      platformCapability: "slack_canvas_write",
      action: "write",
      approvalRequired: true,
      description: "Append bounded markdown to one explicit canvas.",
      inputSchema: {
        type: "object",
        properties: {
          canvasId: { type: "string", pattern: "^F[A-Z0-9]{2,31}$" },
          position: { type: "string", enum: ["start", "end"] },
          markdown: { type: "string", minLength: 1, maxLength: 20000 },
          approvalId: { type: "string" },
        },
        required: ["canvasId", "position", "markdown"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "slack_canvas_safe",
      label: "Safe",
      description:
        "Section lookup and local drafting run directly; each canvas creation or append requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected create and append operations run without Relay per-action approval while fixed methods, bounds, audits, Slack scopes, workspace access and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...readsAndDraft, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspace_auth",
      label: "Slack Canvas workspace authorization",
      requiredScopes: ["canvases:read", "canvases:write"],
    },
  ],
};
