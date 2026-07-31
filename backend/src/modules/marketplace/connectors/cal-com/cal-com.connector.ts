import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "cal_com_booking_list",
    "List upcoming bookings",
    "List at most twenty-five upcoming Booking summaries for the exact connected Cal.com user.",
  ),
  action(
    "cal_com_booking_get",
    "Read a booking",
    "Read one exact Cal.com Booking summary without attendee, location, conferencing or private response data.",
  ),
  action(
    "cal_com_event_type_get",
    "Read an event type",
    "Read one exact Cal.com Event Type summary without private notes, booking fields, locations or owner data.",
  ),
];

export const CAL_COM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cal-com",
  name: "Cal.com",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://cal.com/docs/api-reference/v2/oauth",
  providerWebsiteUrl: "https://cal.com/",
  capabilities: [
    {
      ...capability(
        "scheduling_read",
        "Read scheduling metadata",
        "Read bounded Booking and Event Type summaries for the exact connected Cal.com user.",
        true,
      ),
      platformCapability: "cal_com_scheduling_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.cal.com/auth/oauth2/authorize",
      tokenUrl: "https://api.cal.com/v2/auth/oauth2/token",
      refreshUrl: "https://api.cal.com/v2/auth/oauth2/token",
      userInfoUrl: "https://api.cal.com/v2/me",
      requiredScopes: ["PROFILE_READ", "EVENT_TYPE_READ", "BOOKING_READ"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "calCom.listBookings",
      functionName: "cal_com_booking_list",
      aliases: ["calCom.listBookings", "cal_com_booking_list"],
      capability: "scheduling_read",
      platformCapability: "cal_com_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five upcoming privacy-redacted Booking summaries for the exact connected Cal.com user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "calCom.getBooking",
      functionName: "cal_com_booking_get",
      aliases: ["calCom.getBooking", "cal_com_booking_get"],
      capability: "scheduling_read",
      platformCapability: "cal_com_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact privacy-redacted Booking summary by its Cal.com UID.",
      inputSchema: {
        type: "object",
        properties: {
          bookingUid: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,128}$",
          },
        },
        required: ["bookingUid"],
        additionalProperties: false,
      },
    },
    {
      name: "calCom.getEventType",
      functionName: "cal_com_event_type_get",
      aliases: ["calCom.getEventType", "cal_com_event_type_get"],
      capability: "scheduling_read",
      platformCapability: "cal_com_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact privacy-redacted Event Type summary by its positive numeric Cal.com ID.",
      inputSchema: {
        type: "object",
        properties: {
          eventTypeId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
        },
        required: ["eventTypeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cal_com_safe",
      label: "Safe",
      description:
        "Every bounded Cal.com scheduling read requires approval; people, private meeting data, broader account access and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded Cal.com reads run without Relay per-action approval; exact user binding, redaction, bounds, audits, provider scopes and Cal.com limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Cal.com exact-user validation",
      requiredScopes: ["PROFILE_READ", "EVENT_TYPE_READ", "BOOKING_READ"],
    },
  ],
};
