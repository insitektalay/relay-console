import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("rev_list_orders", "List orders", "List one bounded page of orders."),
  action("rev_get_order", "Read order", "Read one order and its current status."),
  action("rev_get_attachment", "Read attachment details", "Read metadata for one source file or deliverable."),
  action("rev_get_attachment_content", "Download deliverable", "Retrieve one bounded source file, transcript, caption, subtitle, or AI draft."),
  action("rev_list_workspaces", "List workspaces", "List workspaces available to the connected account."),
  action("rev_list_templates", "List legal templates", "List legal transcription templates available to the account."),
];
const changes = [
  action("rev_create_input", "Add source URL", "Register URL-hosted media for a new Rev order."),
  action("rev_place_order", "Place order", "Place a paid or sandbox transcription, caption, legal, or AI order."),
  action("rev_cancel_order", "Cancel order", "Cancel an eligible order before work begins."),
  action("rev_delete_order_data", "Delete order data", "Remove an order's attachments and related data."),
  action("rev_create_share_link", "Create share link", "Create a non-expiring Rev Editor link for a deliverable."),
  action("rev_full_api", "Use full Rev API", "Use any current documented API operation; Safe mode requires approval."),
];

const id = { type: "string", pattern: "^[A-Za-z0-9_-]{1,200}$" };
const orderListProperties = { page: { type: "number", minimum: 0, maximum: 100000 }, page_size: { type: "number", minimum: 1, maximum: 100 }, status: { type: "string", maxLength: 100 }, service: { type: "string", maxLength: 100 }, created_on: { type: "string", maxLength: 100 }, created_before: { type: "string", maxLength: 100 }, created_after: { type: "string", maxLength: 100 } };

export const REV_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "rev", name: "Rev", connectorType: "native_clawchat",
  providerDocsUrl: "https://www.rev.com/api/docs", providerWebsiteUrl: "https://www.rev.com/",
  capabilities: [
    { ...capability("orders_read", "Track orders", "List and inspect transcription, caption, legal, and AI orders in the connected Rev account.", true), platformCapability: "rev_orders_read" },
    { ...capability("deliverables", "Retrieve deliverables", "Inspect and download authorized source files, transcripts, captions, subtitles, and AI drafts.", true), platformCapability: "rev_deliverables" },
    { ...capability("ordering", "Place and manage orders", "Upload source URLs, place paid or sandbox orders, and cancel eligible orders.", true), platformCapability: "rev_ordering" },
    { ...capability("sharing", "Share and remove data", "Create non-expiring Rev Editor links and remove order attachments or related data.", true), platformCapability: "rev_sharing" },
    { ...capability("administration", "Use the complete Rev API", "Use every current documented Human Transcription and Caption API operation authorized by the account.", true), platformCapability: "rev_administration" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "REV_CLIENT_API_KEY", label: "Rev client API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use the client API key from the customer's API-enabled Rev account." },
    { name: "REV_USER_API_KEY", label: "Rev user API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use the matching user API key from the same Rev account." },
  ] },
  tools: [
    { name: "rev.listOrders", functionName: "rev_list_orders", aliases: ["rev.listOrders", "rev_list_orders"], capability: "orders_read", platformCapability: "rev_orders_read", action: "read", approvalRequired: false, description: "List a bounded page of Rev orders.", inputSchema: { type: "object", properties: orderListProperties, additionalProperties: false } },
    { name: "rev.getOrder", functionName: "rev_get_order", aliases: ["rev.getOrder", "rev_get_order"], capability: "orders_read", platformCapability: "rev_orders_read", action: "read", approvalRequired: false, description: "Read one Rev order.", inputSchema: { type: "object", properties: { orderNumber: id }, required: ["orderNumber"], additionalProperties: false } },
    { name: "rev.getAttachment", functionName: "rev_get_attachment", aliases: ["rev.getAttachment", "rev_get_attachment"], capability: "deliverables", platformCapability: "rev_deliverables", action: "read", approvalRequired: false, description: "Read one attachment's metadata.", inputSchema: { type: "object", properties: { attachmentId: id }, required: ["attachmentId"], additionalProperties: false } },
    { name: "rev.getAttachmentContent", functionName: "rev_get_attachment_content", aliases: ["rev.getAttachmentContent", "rev_get_attachment_content"], capability: "deliverables", platformCapability: "rev_deliverables", action: "read", approvalRequired: false, description: "Retrieve one bounded attachment or deliverable.", inputSchema: { type: "object", properties: { attachmentId: id }, required: ["attachmentId"], additionalProperties: false } },
    { name: "rev.listWorkspaces", functionName: "rev_list_workspaces", aliases: ["rev.listWorkspaces", "rev_list_workspaces"], capability: "orders_read", platformCapability: "rev_orders_read", action: "read", approvalRequired: false, description: "List Rev workspaces available to the account.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "rev.listTemplates", functionName: "rev_list_templates", aliases: ["rev.listTemplates", "rev_list_templates"], capability: "orders_read", platformCapability: "rev_orders_read", action: "read", approvalRequired: false, description: "List legal transcription templates.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "rev.createInput", functionName: "rev_create_input", aliases: ["rev.createInput", "rev_create_input"], capability: "ordering", platformCapability: "rev_ordering", action: "write", approvalRequired: true, description: "Register a URL-hosted media source.", inputSchema: { type: "object", properties: { url: { type: "string", format: "uri", maxLength: 10000 }, approvalId: { type: "string" } }, required: ["url"], additionalProperties: false } },
    { name: "rev.placeOrder", functionName: "rev_place_order", aliases: ["rev.placeOrder", "rev_place_order"], capability: "ordering", platformCapability: "rev_ordering", action: "write", approvalRequired: true, description: "Place a paid or sandbox Rev order using an exact documented order body.", inputSchema: { type: "object", properties: { client_ref: { type: "string", maxLength: 1000 }, transcription_options: { type: "object" }, caption_options: { type: "object" }, automated_transcription_options: { type: "object" }, automated_caption_options: { type: "object" }, legal_transcription_options: { type: "object" }, sandbox_mode: { type: "boolean" }, source: { type: "object" }, approvalId: { type: "string" } }, additionalProperties: false } },
    { name: "rev.cancelOrder", functionName: "rev_cancel_order", aliases: ["rev.cancelOrder", "rev_cancel_order"], capability: "ordering", platformCapability: "rev_ordering", action: "write", approvalRequired: true, description: "Cancel an eligible Rev order.", inputSchema: { type: "object", properties: { order_number: { type: "string", maxLength: 200 }, approvalId: { type: "string" } }, required: ["order_number"], additionalProperties: false } },
    { name: "rev.deleteOrderData", functionName: "rev_delete_order_data", aliases: ["rev.deleteOrderData", "rev_delete_order_data"], capability: "sharing", platformCapability: "rev_sharing", action: "write", approvalRequired: true, description: "Delete an order's attachments and related data.", inputSchema: { type: "object", properties: { orderNumber: id, approvalId: { type: "string" } }, required: ["orderNumber"], additionalProperties: false } },
    { name: "rev.createShareLink", functionName: "rev_create_share_link", aliases: ["rev.createShareLink", "rev_create_share_link"], capability: "sharing", platformCapability: "rev_sharing", action: "write", approvalRequired: true, description: "Create a non-expiring Rev Editor link for a deliverable.", inputSchema: { type: "object", properties: { attachmentId: id, access: { type: "string", enum: ["ReadOnly", "Full"] }, approvalId: { type: "string" } }, required: ["attachmentId", "access"], additionalProperties: false } },
    { name: "rev.request", functionName: "rev_request", aliases: ["rev.request", "rev_request", "rev_full_api"], capability: "administration", platformCapability: "rev_administration", action: "admin", approvalRequired: true, description: "Call an exact documented operation on the fixed Rev v1 API origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "rev_safe", label: "Safe", description: "Bounded order, workspace, template, attachment, and deliverable reads run directly; uploads, paid or sandbox orders, cancellation, deletion, sharing, and other operations require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: changes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected account-authorized Rev API operation runs without Relay per-action approval; ownership, credential secrecy, fixed origin, response bounds, audits, customer billing, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...changes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "orders", label: "Rev key-pair validation with a one-order bounded read" }],
};
