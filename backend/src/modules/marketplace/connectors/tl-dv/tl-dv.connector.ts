import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("tl_dv_list_meetings", "List meetings", "Search one bounded page of meetings available to the API key."),
  action("tl_dv_get_meeting", "Read meeting", "Read the metadata for one meeting."),
  action("tl_dv_get_transcript", "Read transcript", "Read the speaker-attributed transcript for one meeting."),
  action("tl_dv_get_notes", "Read notes", "Read the structured and Markdown notes for one meeting."),
  action("tl_dv_get_recording_download", "Prepare recording download", "Ask tl;dv to prepare the recording download without exposing its signed URL."),
];
const changes = [
  action("tl_dv_import_meeting", "Import meeting", "Import public HTTPS audio or video into the customer's tl;dv account."),
  action("tl_dv_full_api", "Use full tl;dv API", "Use any current documented tl;dv public API operation; Safe mode requires approval."),
];

const meetingIdSchema = {
  type: "object",
  properties: { meetingId: { type: "string", minLength: 1, maxLength: 200, pattern: "^[A-Za-z0-9_-]+$" } },
  required: ["meetingId"],
  additionalProperties: false,
};

export const TL_DV_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tl-dv",
  name: "tl;dv",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://doc.tldv.io/",
  providerWebsiteUrl: "https://tldv.io/",
  capabilities: [
    { ...capability("meeting_knowledge", "Read meeting knowledge", "Search meetings and read metadata, transcripts, structured notes, and recording-download readiness.", true), platformCapability: "tl_dv_meeting_knowledge" },
    { ...capability("meeting_import", "Import recordings", "Import publicly accessible audio or video URLs into the customer's tl;dv account for processing.", true), platformCapability: "tl_dv_meeting_import" },
    { ...capability("administration", "Use the complete tl;dv API", "Use every current documented public v1alpha1 API operation authorized by the customer key and organizer plan.", true), platformCapability: "tl_dv_administration" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TL_DV_API_KEY",
        label: "tl;dv API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Create an API key in tl;dv Personal settings > API keys. API access depends on the customer's plan and the meeting organizer's export permissions.",
      },
    ],
  },
  tools: [
    { name: "tlDv.listMeetings", functionName: "tl_dv_list_meetings", aliases: ["tlDv.listMeetings", "tl_dv_list_meetings"], capability: "meeting_knowledge", platformCapability: "tl_dv_meeting_knowledge", action: "read", approvalRequired: false, description: "Search one bounded page of meetings.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 1000 }, page: { type: "number", minimum: 1, maximum: 10000 }, limit: { type: "number", minimum: 1, maximum: 100 }, from: { type: "string", maxLength: 100 }, to: { type: "string", maxLength: 100 }, onlyParticipated: { type: "boolean" }, meetingType: { type: "string", enum: ["internal", "external"] } }, additionalProperties: false } },
    { name: "tlDv.getMeeting", functionName: "tl_dv_get_meeting", aliases: ["tlDv.getMeeting", "tl_dv_get_meeting"], capability: "meeting_knowledge", platformCapability: "tl_dv_meeting_knowledge", action: "read", approvalRequired: false, description: "Read one meeting's metadata.", inputSchema: meetingIdSchema },
    { name: "tlDv.getTranscript", functionName: "tl_dv_get_transcript", aliases: ["tlDv.getTranscript", "tl_dv_get_transcript"], capability: "meeting_knowledge", platformCapability: "tl_dv_meeting_knowledge", action: "read", approvalRequired: false, description: "Read one meeting's transcript.", inputSchema: meetingIdSchema },
    { name: "tlDv.getNotes", functionName: "tl_dv_get_notes", aliases: ["tlDv.getNotes", "tl_dv_get_notes"], capability: "meeting_knowledge", platformCapability: "tl_dv_meeting_knowledge", action: "read", approvalRequired: false, description: "Read one meeting's structured and Markdown notes.", inputSchema: meetingIdSchema },
    { name: "tlDv.getRecordingDownload", functionName: "tl_dv_get_recording_download", aliases: ["tlDv.getRecordingDownload", "tl_dv_get_recording_download"], capability: "meeting_knowledge", platformCapability: "tl_dv_meeting_knowledge", action: "read", approvalRequired: false, description: "Prepare one meeting recording download while withholding signed locations from agent output.", inputSchema: meetingIdSchema },
    { name: "tlDv.importMeeting", functionName: "tl_dv_import_meeting", aliases: ["tlDv.importMeeting", "tl_dv_import_meeting"], capability: "meeting_import", platformCapability: "tl_dv_meeting_import", action: "write", approvalRequired: true, description: "Import a public HTTPS audio or video URL into tl;dv.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 1000 }, url: { type: "string", format: "uri", maxLength: 4000 }, happenedAt: { type: "string", maxLength: 100 }, dryRun: { type: "boolean" }, participants: { type: "array", maxItems: 100, items: { type: "string", maxLength: 320 } }, approvalId: { type: "string" } }, required: ["name", "url"], additionalProperties: false } },
    { name: "tlDv.request", functionName: "tl_dv_request", aliases: ["tlDv.request", "tl_dv_request", "tl_dv_full_api"], capability: "administration", platformCapability: "tl_dv_administration", action: "admin", approvalRequired: true, description: "Call an exact documented public v1alpha1 operation on the fixed tl;dv API origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "tl_dv_safe", label: "Safe", description: "Bounded meeting, transcript, notes, and recording-readiness checks run directly; imports and other API operations require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: changes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected key- and plan-authorized tl;dv API operation runs without Relay per-action approval; ownership, key secrecy, fixed origin, public-import boundaries, bounds, audits, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...changes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "meetings", label: "tl;dv API-key validation with a one-meeting bounded read" }],
};
