import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const workspaceRead = action(
  "riverside_workspace_read",
  "Read workspace",
  "List the connected Riverside account's productions, studios, and projects.",
);
const protectedActions = [
  action(
    "riverside_recording_read",
    "Read recordings",
    "List or inspect bounded recordings, tracks, files, and transcription availability.",
  ),
  action(
    "riverside_recording_download",
    "Download recording media or transcripts",
    "Resolve one recording file or return one bounded transcript.",
  ),
  action(
    "riverside_recording_delete",
    "Delete recordings",
    "Soft-delete one exact recording and its tracks and files.",
  ),
  action(
    "riverside_export_read",
    "Read exports",
    "List or inspect bounded completed Riverside exports.",
  ),
  action(
    "riverside_export_download",
    "Download exports",
    "Resolve one exact export's short-lived signed download URL.",
  ),
  action(
    "riverside_export_delete",
    "Delete exports",
    "Permanently delete one exact export.",
  ),
  action(
    "riverside_webinar_read",
    "Read webinar registrants",
    "Read one bounded page of registrant and attendance records for an exact event.",
  ),
  action(
    "riverside_webinar_register",
    "Register webinar attendees",
    "Register one named attendee with an exact event and return their personal join link.",
  ),
  action(
    "riverside_edit_read",
    "Read edits",
    "List a bounded page of edits belonging to the connected account.",
  ),
  action(
    "riverside_timeline_manage",
    "Create and inspect timeline exports",
    "Queue one exact edit timeline, inspect its status, or resolve its ZIP download.",
  ),
];
const blockedActions = [
  blocked(
    "riverside_webhook_management",
    "Manage webhook subscriptions",
    "Webhook subscription creation, signing-secret capture, replay, and receiver installation are not mounted in V1 because Riverside's public endpoint reference does not expose subscription-management operations.",
  ),
  blocked(
    "riverside_secret_exposure",
    "Expose Riverside credentials",
    "The Business API key never enters agent-visible inputs, URLs, logs, or results.",
  ),
  blocked(
    "riverside_raw_api",
    "Use arbitrary Riverside APIs",
    "Caller-selected origins, paths, headers, browser automation, session cookies, private APIs, and deprecated v1 or v2 endpoints are blocked.",
  ),
  blocked(
    "riverside_unbounded_transfer",
    "Run unbounded transfers",
    "Automatic pagination, bulk deletion, recursive download, arbitrary binary proxying, and unbounded transcript or response transfer are blocked.",
  ),
];

const id = { type: "string", minLength: 1, maxLength: 500 };
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const date = { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" };
const timestamp = {
  type: "string",
  pattern:
    "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,3})?Z$",
};
const filters = {
  studioId: id,
  projectId: id,
  startDate: date,
  endDate: date,
  page: { type: "integer", minimum: 0, maximum: 1000 },
  approvalId,
};

export const RIVERSIDE_FM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "riverside-fm",
  name: "Riverside.fm",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.riverside.fm/quickstart",
  providerWebsiteUrl: "https://riverside.fm/",
  capabilities: [
    {
      ...capability(
        "workspace",
        "Workspace",
        "Read productions, studios, and projects in the connected Business account.",
        true,
      ),
      platformCapability: "riverside_workspace_read",
    },
    {
      ...capability(
        "recordings",
        "Recordings",
        "Read, download, or delete exact recordings and transcripts.",
        true,
      ),
      platformCapability: "riverside_recordings",
    },
    {
      ...capability(
        "exports",
        "Exports",
        "Read, download, or permanently delete exact exports.",
        true,
      ),
      platformCapability: "riverside_exports",
    },
    {
      ...capability(
        "webinars",
        "Webinars",
        "Read bounded event registrants or register one attendee.",
        true,
      ),
      platformCapability: "riverside_webinars",
    },
    {
      ...capability(
        "edits",
        "Edits and timelines",
        "Read edits and create, inspect, or download editing timelines.",
        true,
      ),
      platformCapability: "riverside_edits",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "RIVERSIDE_API_KEY",
        label: "Riverside Business API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated API key generated for the customer's eligible Riverside Business account.",
      },
    ],
  },
  tools: [
    {
      name: "riverside.listWorkspace",
      functionName: "riverside_workspace_list",
      aliases: ["riverside.listWorkspace", "riverside_workspace_list"],
      capability: "workspace",
      platformCapability: "riverside_workspace_read",
      action: "read",
      approvalRequired: false,
      description: "List the connected account's workspace hierarchy.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "riverside.listRecordings",
      functionName: "riverside_recording_list",
      aliases: ["riverside.listRecordings", "riverside_recording_list"],
      capability: "recordings",
      platformCapability: "riverside_recordings",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded recording page with optional exact filters.",
      inputSchema: {
        type: "object",
        properties: filters,
        additionalProperties: false,
      },
    },
    {
      name: "riverside.getRecording",
      functionName: "riverside_recording_get",
      aliases: ["riverside.getRecording", "riverside_recording_get"],
      capability: "recordings",
      platformCapability: "riverside_recordings",
      action: "read",
      approvalRequired: true,
      description:
        "Read one recording including bounded track and file metadata.",
      inputSchema: {
        type: "object",
        properties: { recordingId: id, approvalId },
        required: ["recordingId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.downloadRecordingFile",
      functionName: "riverside_recording_file_download",
      aliases: [
        "riverside.downloadRecordingFile",
        "riverside_recording_file_download",
      ],
      capability: "recordings",
      platformCapability: "riverside_recordings",
      action: "read",
      approvalRequired: true,
      description: "Resolve one exact recording file's short-lived signed URL.",
      inputSchema: {
        type: "object",
        properties: { fileId: id, approvalId },
        required: ["fileId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.downloadTranscript",
      functionName: "riverside_transcript_download",
      aliases: [
        "riverside.downloadTranscript",
        "riverside_transcript_download",
      ],
      capability: "recordings",
      platformCapability: "riverside_recordings",
      action: "read",
      approvalRequired: true,
      description: "Return one bounded SRT or text transcript.",
      inputSchema: {
        type: "object",
        properties: {
          recordingId: id,
          format: { type: "string", enum: ["srt", "txt"] },
          fileName: { type: "string", minLength: 1, maxLength: 120 },
          approvalId,
        },
        required: ["recordingId", "format"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.deleteRecording",
      functionName: "riverside_recording_delete",
      aliases: ["riverside.deleteRecording", "riverside_recording_delete"],
      capability: "recordings",
      platformCapability: "riverside_recordings",
      action: "admin",
      approvalRequired: true,
      description: "Soft-delete one exact recording and its associated files.",
      inputSchema: {
        type: "object",
        properties: { recordingId: id, approvalId },
        required: ["recordingId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.listExports",
      functionName: "riverside_export_list",
      aliases: ["riverside.listExports", "riverside_export_list"],
      capability: "exports",
      platformCapability: "riverside_exports",
      action: "read",
      approvalRequired: true,
      description: "List one bounded export page with optional exact filters.",
      inputSchema: {
        type: "object",
        properties: filters,
        additionalProperties: false,
      },
    },
    {
      name: "riverside.getExport",
      functionName: "riverside_export_get",
      aliases: ["riverside.getExport", "riverside_export_get"],
      capability: "exports",
      platformCapability: "riverside_exports",
      action: "read",
      approvalRequired: true,
      description: "Read one exact export.",
      inputSchema: {
        type: "object",
        properties: { exportId: id, approvalId },
        required: ["exportId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.downloadExport",
      functionName: "riverside_export_download",
      aliases: ["riverside.downloadExport", "riverside_export_download"],
      capability: "exports",
      platformCapability: "riverside_exports",
      action: "read",
      approvalRequired: true,
      description: "Resolve one exact export's short-lived signed URL.",
      inputSchema: {
        type: "object",
        properties: { exportId: id, approvalId },
        required: ["exportId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.deleteExport",
      functionName: "riverside_export_delete",
      aliases: ["riverside.deleteExport", "riverside_export_delete"],
      capability: "exports",
      platformCapability: "riverside_exports",
      action: "admin",
      approvalRequired: true,
      description: "Permanently delete one exact export.",
      inputSchema: {
        type: "object",
        properties: { exportId: id, approvalId },
        required: ["exportId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.listRegistrants",
      functionName: "riverside_registrant_list",
      aliases: ["riverside.listRegistrants", "riverside_registrant_list"],
      capability: "webinars",
      platformCapability: "riverside_webinars",
      action: "read",
      approvalRequired: true,
      description: "List one bounded event-registrant page.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: id,
          limit: { type: "integer", minimum: 1, maximum: 100 },
          cursor: { type: "string", minLength: 1, maxLength: 1000 },
          sort: { type: "string", enum: ["registeredAt", "email", "name"] },
          order: { type: "string", enum: ["asc", "desc"] },
          approved: { type: "boolean" },
          participated: { type: "boolean" },
          search: { type: "string", minLength: 1, maxLength: 200 },
          updatedAfter: timestamp,
          approvalId,
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.registerAttendee",
      functionName: "riverside_registrant_create",
      aliases: ["riverside.registerAttendee", "riverside_registrant_create"],
      capability: "webinars",
      platformCapability: "riverside_webinars",
      action: "write",
      approvalRequired: true,
      description: "Register one attendee for one exact webinar event.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: id,
          email: { type: "string", minLength: 3, maxLength: 320 },
          firstName: { type: "string", minLength: 1, maxLength: 100 },
          lastName: { type: "string", minLength: 1, maxLength: 100 },
          customFields: { type: "array", maxItems: 50 },
          approvalId,
        },
        required: ["eventId", "email", "firstName", "lastName"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.listEdits",
      functionName: "riverside_edit_list",
      aliases: ["riverside.listEdits", "riverside_edit_list"],
      capability: "edits",
      platformCapability: "riverside_edits",
      action: "read",
      approvalRequired: true,
      description: "List one bounded page of edits.",
      inputSchema: {
        type: "object",
        properties: {
          studioId: id,
          projectId: id,
          startDate: timestamp,
          endDate: timestamp,
          page: { type: "integer", minimum: 1, maximum: 1000 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "riverside.createTimeline",
      functionName: "riverside_timeline_create",
      aliases: ["riverside.createTimeline", "riverside_timeline_create"],
      capability: "edits",
      platformCapability: "riverside_edits",
      action: "write",
      approvalRequired: true,
      description: "Queue one XML or AAF timeline export for an exact edit.",
      inputSchema: {
        type: "object",
        properties: {
          clipId: id,
          target: {
            type: "string",
            enum: ["premiere_pro", "final_cut_pro", "pro_tools"],
          },
          includeCommentsMarkersChapters: { type: "boolean" },
          approvalId,
        },
        required: ["clipId", "target", "includeCommentsMarkersChapters"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.getTimeline",
      functionName: "riverside_timeline_get",
      aliases: ["riverside.getTimeline", "riverside_timeline_get"],
      capability: "edits",
      platformCapability: "riverside_edits",
      action: "read",
      approvalRequired: true,
      description: "Read one timeline export job's current status.",
      inputSchema: {
        type: "object",
        properties: { timelineId: id, approvalId },
        required: ["timelineId"],
        additionalProperties: false,
      },
    },
    {
      name: "riverside.downloadTimeline",
      functionName: "riverside_timeline_download",
      aliases: ["riverside.downloadTimeline", "riverside_timeline_download"],
      capability: "edits",
      platformCapability: "riverside_edits",
      action: "read",
      approvalRequired: true,
      description:
        "Resolve one completed timeline ZIP's short-lived signed URL.",
      inputSchema: {
        type: "object",
        properties: { timelineId: id, approvalId },
        required: ["timelineId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "riverside_safe",
      label: "Safe",
      description:
        "Workspace hierarchy reads run directly; recording, media, transcript, export, edit, registrant, timeline, registration, and deletion actions require matching approval.",
      defaultSelected: true,
      allowedActions: [workspaceRead],
      approvalRequiredActions: protectedActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected v3 Business API action runs without Relay per-action approval while key secrecy, the fixed origin, account authority, bounds, audits, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [workspaceRead, ...protectedActions],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "workspace", label: "Riverside Business API key validation" },
  ],
};
