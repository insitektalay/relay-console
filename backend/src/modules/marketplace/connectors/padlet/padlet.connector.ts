import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "padlet_get_current_user",
    "Read current user",
    "Read the connected user's profile, boards, and organizations.",
  ),
  action(
    "padlet_get_board",
    "Read board",
    "Read one administered board with selected posts, sections, and comments.",
  ),
  action(
    "padlet_get_organization",
    "Read organization",
    "Read one administered organization and optionally its users.",
  ),
  action(
    "padlet_get_user_in_organization",
    "Read organization member",
    "Read one user's information and boards in an administered organization.",
  ),
  action(
    "padlet_get_post_attachment_data",
    "Read post attachment",
    "Read attachment metadata for one accessible post.",
  ),
  action(
    "padlet_get_ai_recipe_board_status",
    "Read AI board status",
    "Read the status of one AI recipe board creation request.",
  ),
];
const writes = [
  action(
    "padlet_create_post",
    "Create post",
    "Create one post on an administered board; Safe mode requires approval.",
  ),
  action(
    "padlet_create_comment",
    "Create comment",
    "Create one comment on an accessible post; Safe mode requires approval.",
  ),
  action(
    "padlet_create_reaction",
    "Create reaction",
    "Create one reaction on a supported post; Safe mode requires approval.",
  ),
  action(
    "padlet_create_ai_recipe_board",
    "Create AI recipe board",
    "Ask Padlet to generate one board from bounded instructions; Safe mode requires approval.",
  ),
];

const idProperty = { type: "string", minLength: 1, maxLength: 200 };
const approvalProperty = { type: "string", maxLength: 200 };

export const PADLET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "padlet",
  name: "Padlet",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.padlet.dev/reference",
  providerWebsiteUrl: "https://padlet.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account",
        "Read the connected user's profile, boards, organizations, and organization membership data.",
        true,
      ),
      platformCapability: "padlet_account_read",
    },
    {
      ...capability(
        "board_read",
        "Read boards",
        "Read administered boards, posts, sections, comments, attachments, and AI board creation status.",
        true,
      ),
      platformCapability: "padlet_board_read",
    },
    {
      ...capability(
        "content_write",
        "Add board content",
        "Create posts, comments, and reactions where the connected Padlet user has permission.",
        true,
      ),
      platformCapability: "padlet_content_write",
    },
    {
      ...capability(
        "ai_board_create",
        "Create AI boards",
        "Create AI recipe boards from bounded instructions and monitor their completion.",
        true,
      ),
      platformCapability: "padlet_ai_board_create",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PADLET_API_KEY",
        label: "Padlet personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "In Padlet, open Settings > Personal account > Developer, generate the API key, and paste it here. A paid individual account is required.",
      },
    ],
  },
  tools: [
    {
      name: "padlet.getCurrentUser",
      functionName: "padlet_get_current_user",
      aliases: ["padlet.getCurrentUser", "padlet_get_current_user"],
      capability: "account_read",
      platformCapability: "padlet_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the connected Padlet user's profile and selected board and organization relationships.",
      inputSchema: {
        type: "object",
        properties: {
          include: {
            type: "array",
            maxItems: 2,
            uniqueItems: true,
            items: { type: "string", enum: ["boards", "organizations"] },
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "padlet.getBoard",
      functionName: "padlet_get_board",
      aliases: ["padlet.getBoard", "padlet_get_board"],
      capability: "board_read",
      platformCapability: "padlet_board_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one administered Padlet board with selected related resources.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: idProperty,
          include: {
            type: "array",
            maxItems: 3,
            uniqueItems: true,
            items: { type: "string", enum: ["posts", "sections", "comments"] },
          },
        },
        required: ["boardId"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.getOrganization",
      functionName: "padlet_get_organization",
      aliases: ["padlet.getOrganization", "padlet_get_organization"],
      capability: "account_read",
      platformCapability: "padlet_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one Padlet organization where the connected user is an administrator.",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: idProperty,
          includeUsers: { type: "boolean" },
        },
        required: ["organizationId"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.getUserInOrganization",
      functionName: "padlet_get_user_in_organization",
      aliases: [
        "padlet.getUserInOrganization",
        "padlet_get_user_in_organization",
      ],
      capability: "account_read",
      platformCapability: "padlet_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one user's information and optionally their boards in an administered Padlet organization.",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: idProperty,
          userId: idProperty,
          includeBoards: { type: "boolean" },
        },
        required: ["organizationId", "userId"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.getPostAttachmentData",
      functionName: "padlet_get_post_attachment_data",
      aliases: [
        "padlet.getPostAttachmentData",
        "padlet_get_post_attachment_data",
      ],
      capability: "board_read",
      platformCapability: "padlet_board_read",
      action: "read",
      approvalRequired: false,
      description: "Read attachment metadata for one accessible Padlet post.",
      inputSchema: {
        type: "object",
        properties: { postId: idProperty },
        required: ["postId"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.getAiRecipeBoardStatus",
      functionName: "padlet_get_ai_recipe_board_status",
      aliases: [
        "padlet.getAiRecipeBoardStatus",
        "padlet_get_ai_recipe_board_status",
      ],
      capability: "board_read",
      platformCapability: "padlet_board_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Padlet AI recipe board creation status.",
      inputSchema: {
        type: "object",
        properties: { statusKey: idProperty },
        required: ["statusKey"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.createPost",
      functionName: "padlet_create_post",
      aliases: ["padlet.createPost", "padlet_create_post"],
      capability: "content_write",
      platformCapability: "padlet_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one post with the complete documented Padlet post fields on an administered board.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: idProperty,
          content: {
            type: "object",
            properties: {
              subject: { type: "string", maxLength: 500 },
              body: { type: "string", maxLength: 10_000 },
              attachment: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri", maxLength: 10_000 },
                  caption: { type: "string", maxLength: 2_000 },
                  previewImageUrl: {
                    type: "string",
                    format: "uri",
                    maxLength: 10_000,
                  },
                  embedCode: { type: "string", maxLength: 100_000 },
                  poll: {
                    type: "object",
                    properties: {
                      question: { type: "string", maxLength: 2_000 },
                      choices: {
                        type: "array",
                        minItems: 1,
                        maxItems: 100,
                        items: { type: "string", maxLength: 2_000 },
                      },
                    },
                    additionalProperties: false,
                  },
                },
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
          color: {
            type: "string",
            enum: ["red", "orange", "green", "blue", "purple"],
          },
          status: {
            type: "string",
            enum: ["approved", "pending_moderation", "scheduled"],
          },
          manualSortPosition: {
            type: "object",
            properties: { previousPostId: idProperty },
            required: ["previousPostId"],
            additionalProperties: false,
          },
          mapProps: {
            type: "object",
            properties: {
              latitude: { type: "number", minimum: -90, maximum: 90 },
              longitude: { type: "number", minimum: -180, maximum: 180 },
              locationName: { type: "string", maxLength: 1_000 },
            },
            required: ["latitude", "longitude"],
            additionalProperties: false,
          },
          canvasProps: {
            type: "object",
            properties: {
              left: { type: "integer" },
              top: { type: "integer" },
              width: { type: "integer", minimum: 1 },
            },
            required: ["left", "top", "width"],
            additionalProperties: false,
          },
          customFields: { type: "object", maxProperties: 100 },
          sectionId: idProperty,
          approvalId: approvalProperty,
        },
        required: ["boardId", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.createComment",
      functionName: "padlet_create_comment",
      aliases: ["padlet.createComment", "padlet_create_comment"],
      capability: "content_write",
      platformCapability: "padlet_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one comment containing bounded HTML, a public attachment URL, or both on an accessible post.",
      inputSchema: {
        type: "object",
        properties: {
          postId: idProperty,
          htmlContent: { type: "string", maxLength: 100_000 },
          attachmentUrl: { type: "string", format: "uri", maxLength: 10_000 },
          approvalId: approvalProperty,
        },
        required: ["postId"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.createReaction",
      functionName: "padlet_create_reaction",
      aliases: ["padlet.createReaction", "padlet_create_reaction"],
      capability: "content_write",
      platformCapability: "padlet_content_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one like, star, grade, or vote reaction on a supported post.",
      inputSchema: {
        type: "object",
        properties: {
          postId: idProperty,
          value: { type: "integer", minimum: -1, maximum: 100 },
          reactionType: {
            type: "string",
            enum: ["like", "star", "grade", "vote"],
          },
          approvalId: approvalProperty,
        },
        required: ["postId", "value"],
        additionalProperties: false,
      },
    },
    {
      name: "padlet.createAiRecipeBoard",
      functionName: "padlet_create_ai_recipe_board",
      aliases: ["padlet.createAiRecipeBoard", "padlet_create_ai_recipe_board"],
      capability: "ai_board_create",
      platformCapability: "padlet_ai_board_create",
      action: "write",
      approvalRequired: true,
      description:
        "Ask Padlet to create one AI recipe board from bounded instructions and a role.",
      inputSchema: {
        type: "object",
        properties: {
          boardCreationInstructions: {
            type: "string",
            minLength: 1,
            maxLength: 2_000,
          },
          role: { type: "string", minLength: 1, maxLength: 500 },
          workspaceId: idProperty,
          approvalId: approvalProperty,
        },
        required: ["boardCreationInstructions", "role"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "padlet_safe",
      label: "Safe",
      description:
        "Bounded profile, organization, board, attachment, and status reads run directly; every post, comment, reaction, and AI board creation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Padlet operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, redaction, administrator access, personal quota, subscription, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "current-user", label: "Padlet token and user validation" },
  ],
};
