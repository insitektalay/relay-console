import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GOOGLE_CALENDAR_SCOPES } from "./google-calendar-api.adapter";

const reads = [
  action(
    "google_calendar_calendar_list",
    "List calendars",
    "List the first bounded page of safe calendar identity metadata.",
  ),
  action(
    "google_calendar_event_list",
    "List events",
    "List at most twenty-five events in an explicit calendar and time range.",
  ),
  action(
    "google_calendar_freebusy_query",
    "Query availability",
    "Return bounded busy intervals for at most ten explicit calendars.",
  ),
];
const writes = [
  action(
    "google_calendar_event_create",
    "Create event",
    "Create one exact reviewed event without sending guest notifications.",
  ),
  action(
    "google_calendar_event_update",
    "Update event",
    "Patch one exact reviewed event using an ETag without sending guest notifications.",
  ),
];
const blockedActions = [
  blocked(
    "google_calendar_event_delete",
    "Delete or move events",
    "Delete, move, import, quick-add, watch, batch mutation, and sync traversal are blocked.",
  ),
  blocked(
    "google_calendar_admin",
    "Administer calendars",
    "Calendar, CalendarList, ACL, settings, sharing, notification, and ownership mutations are blocked.",
  ),
  blocked(
    "google_calendar_risky_content",
    "Add risky event content",
    "Attachments, Meet/conference creation, private or extended properties, guest notification side effects, and arbitrary recurrence expansion are blocked.",
  ),
  blocked(
    "google_calendar_raw_api",
    "Use raw Calendar APIs",
    "Arbitrary endpoints, raw Google/MCP tools, automatic pagination, broad export, credentials, and broader scopes are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const calendarId = { type: "string", minLength: 1, maxLength: 320 };
const eventId = {
  type: "string",
  pattern: "^[A-Za-z0-9_-]+$",
  minLength: 1,
  maxLength: 1024,
};
const timestamp = { type: "string", minLength: 1, maxLength: 64 };
const eventTime = {
  type: "object",
  properties: {
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    dateTime: { type: "string", minLength: 1, maxLength: 64 },
    timeZone: { type: "string", minLength: 1, maxLength: 100 },
  },
  additionalProperties: false,
};
const eventFields = {
  summary: { type: "string", minLength: 1, maxLength: 500 },
  description: { type: "string", minLength: 1, maxLength: 4000 },
  location: { type: "string", minLength: 1, maxLength: 4000 },
  start: eventTime,
  end: eventTime,
  attendees: {
    type: "array",
    maxItems: 25,
    items: {
      type: "object",
      properties: {
        email: { type: "string", minLength: 3, maxLength: 320 },
      },
      required: ["email"],
      additionalProperties: false,
    },
  },
};

export const GOOGLE_CALENDAR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-calendar",
    name: "Google Calendar",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developers.google.com/workspace/calendar/api/v3/reference",
    providerWebsiteUrl: "https://calendar.google.com/",
    capabilities: [
      {
        ...capability(
          "calendar_read",
          "Read calendars and events",
          "List bounded calendars and event details in explicit time ranges.",
          true,
        ),
        platformCapability: "google_calendar_read",
      },
      {
        ...capability(
          "availability_read",
          "Read availability",
          "Query bounded free/busy intervals for explicit calendars.",
          true,
        ),
        platformCapability: "google_calendar_availability",
      },
      {
        ...capability(
          "event_write",
          "Create and update events",
          "Create or update exact reviewed events without guest notifications.",
          false,
        ),
        platformCapability: "google_calendar_event_write",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_CALENDAR_SCOPES,
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "GOOGLE_CALENDAR_CLIENT_ID",
          label: "Google Calendar OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay-owned verified confidential Google OAuth client ID configured only on Railway.",
        },
        {
          name: "GOOGLE_CALENDAR_CLIENT_SECRET",
          label: "Google Calendar OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay-owned confidential Google OAuth secret configured only on Railway.",
        },
        {
          name: "GOOGLE_CALENDAR_ACCOUNT_EMAIL",
          label: "Authorized Google account",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth2"],
          helpText:
            "Bind the exact primary Google Calendar account before consent.",
        },
        {
          name: "GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID",
          label: "Default calendar ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth2"],
          helpText:
            "Bind one exact default calendar ID; use primary only when intended.",
        },
      ],
    },
    tools: [
      {
        name: "googleCalendar.listCalendars",
        functionName: "google_calendar_calendar_list",
        aliases: [
          "googleCalendar.listCalendars",
          "google_calendar_calendar_list",
        ],
        capability: "calendar_read",
        platformCapability: "google_calendar_read",
        action: "read",
        approvalRequired: false,
        description: "List the first bounded page of safe calendar metadata.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 25 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "googleCalendar.listEvents",
        functionName: "google_calendar_event_list",
        aliases: ["googleCalendar.listEvents", "google_calendar_event_list"],
        capability: "calendar_read",
        platformCapability: "google_calendar_read",
        action: "read",
        approvalRequired: false,
        description:
          "List bounded events in an exact calendar and RFC3339 time range.",
        inputSchema: {
          type: "object",
          properties: {
            calendarId,
            timeMin: timestamp,
            timeMax: timestamp,
            limit: { type: "integer", minimum: 1, maximum: 25 },
          },
          required: ["calendarId", "timeMin", "timeMax"],
          additionalProperties: false,
        },
      },
      {
        name: "googleCalendar.queryFreeBusy",
        functionName: "google_calendar_freebusy_query",
        aliases: [
          "googleCalendar.queryFreeBusy",
          "google_calendar_freebusy_query",
        ],
        capability: "availability_read",
        platformCapability: "google_calendar_availability",
        action: "read",
        approvalRequired: false,
        description:
          "Query bounded availability for 1 through 10 explicit calendars.",
        inputSchema: {
          type: "object",
          properties: {
            calendarIds: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: calendarId,
            },
            timeMin: timestamp,
            timeMax: timestamp,
            timeZone: { type: "string", minLength: 1, maxLength: 100 },
          },
          required: ["calendarIds", "timeMin", "timeMax"],
          additionalProperties: false,
        },
      },
      {
        name: "googleCalendar.createEvent",
        functionName: "google_calendar_event_create",
        aliases: ["googleCalendar.createEvent", "google_calendar_event_create"],
        capability: "event_write",
        platformCapability: "google_calendar_event_write",
        action: "write",
        approvalRequired: true,
        description:
          "Create one exact reviewed event without guest notifications.",
        inputSchema: {
          type: "object",
          properties: { calendarId, ...eventFields, approvalId },
          required: ["calendarId", "summary", "start", "end", "approvalId"],
          additionalProperties: false,
        },
      },
      {
        name: "googleCalendar.updateEvent",
        functionName: "google_calendar_event_update",
        aliases: ["googleCalendar.updateEvent", "google_calendar_event_update"],
        capability: "event_write",
        platformCapability: "google_calendar_event_write",
        action: "write",
        approvalRequired: true,
        description:
          "Patch one exact reviewed event with its ETag and no guest notifications.",
        inputSchema: {
          type: "object",
          properties: {
            calendarId,
            eventId,
            etag: { type: "string", minLength: 1, maxLength: 500 },
            ...eventFields,
            approvalId,
          },
          required: ["calendarId", "eventId", "etag", "approvalId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_calendar_safe",
        label: "Safe",
        description:
          "Bounded calendar, event, and availability reads are direct; event creates and updates require approval.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: writes,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All five selected wrappers run without per-action approval while exact scopes/account/calendar bounds, audit, and provider controls remain enforced.",
        defaultSelected: false,
        allowedActions: [...reads, ...writes],
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "account-calendar-exact-scope-boundary",
        label:
          "Exact three Calendar scopes, offline refresh, primary account, and selected default calendar",
        requiredScopes: GOOGLE_CALENDAR_SCOPES,
      },
    ],
  };
