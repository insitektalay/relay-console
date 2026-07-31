import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { KLAVIYO_SMS_REVISION } from "./klaviyo-sms-api.adapter";

export const KLAVIYO_SMS_SCOPES = [
  "accounts:read",
  "sender-config:read",
  "sender-config:write",
];
const reads = [
  action(
    "klaviyo_sms_readiness_read",
    "Read SMS readiness",
    "Read the exact account configuration, senders, and carrier-registration state.",
  ),
];
const writes = [
  action(
    "klaviyo_sms_provision",
    "Provision SMS configuration or sender",
    "Creating SMS configuration, provisioning a real toll-free number, or resubmitting carrier registration requires approval.",
  ),
];
const blocks = [
  blocked(
    "klaviyo_sms_send",
    "Send SMS",
    "The Text Messaging API explicitly does not send messages; campaigns and flows remain outside this connector.",
  ),
  blocked(
    "klaviyo_sms_consent",
    "Change consent or profiles",
    "Profile phone data, subscriptions, consent, suppressions, lists, and historical imports are outside this connector.",
  ),
  blocked(
    "klaviyo_sms_broader_api",
    "Use broader Klaviyo APIs",
    "Campaigns, flows, profiles, events, reports, arbitrary paths, revisions, and pagination are blocked.",
  ),
];

export const KLAVIYO_SMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "klaviyo-sms",
  name: "Klaviyo SMS",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.klaviyo.com/en/reference/text_messaging_api_overview",
  providerWebsiteUrl: "https://www.klaviyo.com/products/sms-marketing",
  capabilities: [
    {
      ...capability(
        "readiness",
        "SMS readiness",
        "Read account configuration, toll-free senders, and carrier-registration lifecycle.",
        true,
      ),
      platformCapability: "sms_sender_config_read",
    },
    {
      ...capability(
        "provision",
        "Provision SMS sending",
        "Create configuration, provision a toll-free number, or resubmit a rejected carrier registration.",
        false,
      ),
      platformCapability: "sms_sender_config_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.klaviyo.com/oauth/authorize",
      tokenUrl: "https://a.klaviyo.com/oauth/token",
      refreshUrl: "https://a.klaviyo.com/oauth/token",
      revocationUrl: "https://a.klaviyo.com/oauth/revoke",
      requiredScopes: KLAVIYO_SMS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    tool(
      "klaviyoSms.read",
      "klaviyo_sms_read",
      "readiness",
      "sms_sender_config_read",
      "read",
      false,
      [
        "get_configuration",
        "list_senders",
        "get_sender",
        "get_sender_registration",
        "get_registration",
      ],
    ),
    tool(
      "klaviyoSms.provision",
      "klaviyo_sms_provision",
      "provision",
      "sms_sender_config_write",
      "write",
      true,
      ["create_configuration", "create_sender", "resubmit_registration"],
    ),
  ],
  approvalProfiles: [
    {
      id: "klaviyo_sms_safe",
      label: "Safe",
      description:
        "Readiness reads run directly; every number-provisioning or carrier-registration mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "senders",
      label: `Exact account, rotating OAuth, and ${KLAVIYO_SMS_REVISION} text-messaging readiness validation`,
      requiredScopes: KLAVIYO_SMS_SCOPES,
    },
  ],
};

function tool(
  name: string,
  functionName: string,
  cap: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: cap,
    platformCapability,
    action: actionType,
    approvalRequired,
    description: `Run a pinned Klaviyo SMS ${cap} operation.`,
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        senderId: { type: "string" },
        registrationId: { type: "string" },
        data: { type: "object" },
        approvalId: { type: "string" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
