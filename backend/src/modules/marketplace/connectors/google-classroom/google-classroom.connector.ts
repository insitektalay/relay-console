import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
];
const reads = [
  action(
    "google_classroom_courses_list_mine",
    "List my Classroom courses",
    "Read up to twenty-five courses the requesting user may view.",
  ),
  action(
    "google_classroom_course_get",
    "Get Classroom course",
    "Read one explicit permitted course.",
  ),
  action(
    "google_classroom_coursework_list",
    "List Classroom coursework",
    "Read up to twenty-five newest coursework posts for an explicit course.",
  ),
  action(
    "google_classroom_materials_list",
    "List Classroom materials",
    "Read up to twenty-five newest learning-material posts for an explicit course.",
  ),
];
const blockedActions = [
  blocked(
    "google_classroom_people_guardians",
    "Access Classroom people",
    "Rosters, profiles, emails, photos, invitations, guardians, and individual student IDs are blocked.",
  ),
  blocked(
    "google_classroom_submissions_grades",
    "Access student work or grades",
    "Student submissions, responses, attachments, histories, rubrics, gradebooks, and grades are blocked.",
  ),
  blocked(
    "google_classroom_mutations_admin",
    "Mutate or administer Classroom",
    "Creates, updates, deletes, grading, turn-in, delegation, impersonation, and administration are blocked.",
  ),
  blocked(
    "google_classroom_preview_raw_export",
    "Use preview or raw Classroom access",
    "Preview APIs, announcements, raw tools, exports, page tokens, automatic pagination, retries, and polling are blocked.",
  ),
];
const maxResults = { type: "integer", minimum: 1, maximum: 25, default: 25 };
const courseId = {
  type: "string",
  pattern: "^[A-Za-z0-9_-]{1,128}$",
  maxLength: 128,
};

export const GOOGLE_CLASSROOM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-classroom",
    name: "Google Classroom",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/workspace/classroom",
    providerWebsiteUrl: "https://classroom.google.com/",
    capabilities: [
      {
        ...capability(
          "courses_list",
          "List permitted courses",
          "Read up to twenty-five courses visible to the requesting user.",
          true,
        ),
        platformCapability: "google_classroom_courses_list_mine",
      },
      {
        ...capability(
          "course_get",
          "Read course",
          "Read one explicit prior-result course.",
          true,
        ),
        platformCapability: "google_classroom_course_get",
      },
      {
        ...capability(
          "coursework_list",
          "Review coursework",
          "Read up to twenty-five newest coursework posts and due dates.",
          true,
        ),
        platformCapability: "google_classroom_coursework_list",
      },
      {
        ...capability(
          "materials_list",
          "Review learning materials",
          "Read up to twenty-five newest material posts with safe attachment links.",
          true,
        ),
        platformCapability: "google_classroom_materials_list",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_CLASSROOM_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "GOOGLE_OAUTH_CLIENT_ID",
          label: "Google OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Railway-held Relay Console confidential web OAuth client ID.",
        },
        {
          name: "GOOGLE_OAUTH_CLIENT_SECRET",
          label: "Google OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Railway-held Google OAuth client secret; never sent to clients or agents.",
        },
      ],
    },
    tools: [
      {
        name: "googleClassroom.listMyCourses",
        functionName: "google_classroom_courses_list_mine",
        aliases: ["google_classroom_courses_list_mine"],
        capability: "courses_list",
        platformCapability: "google_classroom_courses_list_mine",
        action: "read",
        approvalRequired: false,
        description:
          "Read one first page of courses the requesting user is permitted to view.",
        inputSchema: {
          type: "object",
          properties: { maxResults },
          additionalProperties: false,
        },
      },
      {
        name: "googleClassroom.getCourse",
        functionName: "google_classroom_course_get",
        aliases: ["google_classroom_course_get"],
        capability: "course_get",
        platformCapability: "google_classroom_course_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read one explicit Classroom course returned by the course list.",
        inputSchema: {
          type: "object",
          properties: { courseId },
          required: ["courseId"],
          additionalProperties: false,
        },
      },
      {
        name: "googleClassroom.listCoursework",
        functionName: "google_classroom_coursework_list",
        aliases: ["google_classroom_coursework_list"],
        capability: "coursework_list",
        platformCapability: "google_classroom_coursework_list",
        action: "read",
        approvalRequired: false,
        description:
          "Read one newest-first page of coursework for an explicit course.",
        inputSchema: {
          type: "object",
          properties: { courseId, maxResults },
          required: ["courseId"],
          additionalProperties: false,
        },
      },
      {
        name: "googleClassroom.listMaterials",
        functionName: "google_classroom_materials_list",
        aliases: ["google_classroom_materials_list"],
        capability: "materials_list",
        platformCapability: "google_classroom_materials_list",
        action: "read",
        approvalRequired: false,
        description:
          "Read one newest-first page of learning-material posts for an explicit course.",
        inputSchema: {
          type: "object",
          properties: { courseId, maxResults },
          required: ["courseId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_classroom_read_only",
        label: "Read only",
        description:
          "Four requesting-user reads run automatically with a twenty-five item cap while people data, student work, grades, writes, preview APIs, raw access, and pagination remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The exact scopes, requesting-user boundary, twenty-five item cap, privacy redaction, first-page-only, and no-write boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "exact-scopes-requesting-user",
        label: "Exact read-only Classroom scopes and requesting-user access",
        requiredScopes: GOOGLE_CLASSROOM_SCOPES,
      },
    ],
  };
