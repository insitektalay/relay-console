export type PostscriptOperation = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  pathParams?: string[];
  query?: string[];
  body?: boolean;
  sensitive?: boolean;
};

const subscriberQuery = [
  "created_at__eq",
  "created_at__gt",
  "created_at__gte",
  "created_at__lt",
  "created_at__lte",
  "updated_at__eq",
  "updated_at__gt",
  "updated_at__gte",
  "updated_at__lt",
  "updated_at__lte",
  "email__contains",
  "email__eq",
  "email__in",
  "phone_number__contains",
  "phone_number__eq",
  "phone_number__in",
  "shopify_customer_id__contains",
  "shopify_customer_id__eq",
  "shopify_customer_id__in",
  "ps_id__eq",
  "page",
  "sort",
];

export const POSTSCRIPT_OPERATIONS: PostscriptOperation[] = [
  { id: "verify_identity", method: "GET", path: "/api/v2/me" },
  {
    id: "unsubscribe",
    method: "PATCH",
    path: "/api/v2/compliance/unsubscribe",
    body: true,
  },
  {
    id: "redact",
    method: "PATCH",
    path: "/api/v2/compliance/redact",
    body: true,
  },
  {
    id: "create_custom_event",
    method: "POST",
    path: "/api/v2/events",
    body: true,
  },
  { id: "list_keywords", method: "GET", path: "/api/v2/keywords" },
  {
    id: "get_keyword",
    method: "GET",
    path: "/api/v2/keywords/{id}",
    pathParams: ["id"],
  },
  {
    id: "get_message_request",
    method: "GET",
    path: "/api/v2/message_requests/{id}",
    pathParams: ["id"],
    sensitive: true,
  },
  {
    id: "send_message",
    method: "POST",
    path: "/api/v2/message_requests",
    body: true,
  },
  {
    id: "get_sent_message",
    method: "GET",
    path: "/api/v2/sent_messages/{id}",
    pathParams: ["id"],
    sensitive: true,
  },
  {
    id: "list_subscribers",
    method: "GET",
    path: "/api/v2/subscribers",
    query: subscriberQuery,
    sensitive: true,
  },
  {
    id: "get_subscriber",
    method: "GET",
    path: "/api/v2/subscribers/{id}",
    pathParams: ["id"],
    sensitive: true,
  },
  {
    id: "create_subscriber",
    method: "POST",
    path: "/api/v2/subscribers",
    body: true,
  },
  {
    id: "update_subscriber",
    method: "PATCH",
    path: "/api/v2/subscribers/{id}",
    pathParams: ["id"],
    body: true,
  },
  { id: "list_webhooks", method: "GET", path: "/api/v2/webhooks" },
  {
    id: "get_webhook",
    method: "GET",
    path: "/api/v2/webhooks/{id}",
    pathParams: ["id"],
  },
  {
    id: "create_webhook",
    method: "POST",
    path: "/api/v2/webhooks",
    body: true,
  },
  {
    id: "update_webhook",
    method: "PATCH",
    path: "/api/v2/webhooks/{id}",
    pathParams: ["id"],
    body: true,
  },
  {
    id: "delete_webhook",
    method: "DELETE",
    path: "/api/v2/webhooks/{id}",
    pathParams: ["id"],
  },
  {
    id: "test_webhook",
    method: "POST",
    path: "/api/v2/webhooks/test",
    body: true,
  },
  {
    id: "get_example_webhook_event",
    method: "GET",
    path: "/api/v2/webhooks/example",
  },
];

export const POSTSCRIPT_OPERATION_BY_ID = new Map(
  POSTSCRIPT_OPERATIONS.map((op) => [op.id, op]),
);
export const POSTSCRIPT_SAFE_READ_OPERATION_IDS = POSTSCRIPT_OPERATIONS.filter(
  (op) => op.method === "GET" && !op.sensitive,
).map((op) => op.id);
export const POSTSCRIPT_SENSITIVE_READ_OPERATION_IDS =
  POSTSCRIPT_OPERATIONS.filter((op) => op.method === "GET" && op.sensitive).map(
    (op) => op.id,
  );
export const POSTSCRIPT_MANAGE_OPERATION_IDS = POSTSCRIPT_OPERATIONS.filter(
  (op) => op.method !== "GET",
).map((op) => op.id);
