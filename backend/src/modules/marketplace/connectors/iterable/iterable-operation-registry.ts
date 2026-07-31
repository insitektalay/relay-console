export type IterableOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  pathParams?: string[];
  query?: string[];
  body?: boolean;
  sensitive?: boolean;
};

export const ITERABLE_OPERATIONS: IterableOperation[] = [
  {
    id: "list_campaigns",
    method: "GET",
    path: "/api/campaigns",
    query: ["page", "pageSize", "sort", "campaignState"],
  },
  {
    id: "get_campaign",
    method: "GET",
    path: "/api/campaigns/{id}",
    pathParams: ["id"],
  },
  { id: "list_channels", method: "GET", path: "/api/channels" },
  {
    id: "list_experiments",
    method: "GET",
    path: "/api/experiments",
    query: [
      "campaignId",
      "state",
      "startDateTime",
      "endDateTime",
      "limit",
      "offset",
    ],
  },
  {
    id: "get_experiment",
    method: "GET",
    path: "/api/experiments/{experimentId}",
    pathParams: ["experimentId"],
  },
  {
    id: "get_experiment_variants",
    method: "GET",
    path: "/api/experiments/{experimentId}/variants",
    pathParams: ["experimentId"],
  },
  {
    id: "list_journeys",
    method: "GET",
    path: "/api/journeys",
    query: ["page", "pageSize", "sort", "state"],
  },
  { id: "list_lists", method: "GET", path: "/api/lists" },
  {
    id: "get_list_size",
    method: "GET",
    path: "/api/lists/{listId}/size",
    pathParams: ["listId"],
  },
  { id: "list_message_types", method: "GET", path: "/api/messageTypes" },
  { id: "list_snippets", method: "GET", path: "/api/snippets" },
  {
    id: "get_snippet",
    method: "GET",
    path: "/api/snippets/{identifier}",
    pathParams: ["identifier"],
  },
  {
    id: "list_templates",
    method: "GET",
    path: "/api/templates",
    query: [
      "templateType",
      "messageMedium",
      "startDateTime",
      "endDateTime",
      "page",
      "pageSize",
      "sort",
    ],
  },
  { id: "get_user_fields", method: "GET", path: "/api/users/getFields" },
  { id: "list_webhooks", method: "GET", path: "/api/webhooks" },
  {
    id: "get_campaign_metrics",
    method: "GET",
    path: "/api/campaigns/metrics",
    query: ["campaignId", "startDateTime", "endDateTime"],
    sensitive: true,
  },
  {
    id: "get_experiment_metrics",
    method: "GET",
    path: "/api/experiments/metrics",
    query: ["experimentId", "campaignId", "startDateTime", "endDateTime"],
    sensitive: true,
  },
  {
    id: "list_users",
    method: "GET",
    path: "/api/lists/getUsers",
    query: ["listId", "preferUserId"],
    sensitive: true,
  },
  {
    id: "get_user_by_email",
    method: "GET",
    path: "/api/users/getByEmail",
    query: ["email"],
    sensitive: true,
  },
  {
    id: "get_user_by_id",
    method: "GET",
    path: "/api/users/byUserId/{userId}",
    pathParams: ["userId"],
    sensitive: true,
  },
  {
    id: "get_events_by_email",
    method: "GET",
    path: "/api/events/{email}",
    pathParams: ["email"],
    query: ["limit"],
    sensitive: true,
  },
  {
    id: "get_events_by_id",
    method: "GET",
    path: "/api/events/byUserId/{userId}",
    pathParams: ["userId"],
    query: ["limit"],
    sensitive: true,
  },
  {
    id: "get_sent_messages",
    method: "GET",
    path: "/api/users/getSentMessages",
    query: [
      "email",
      "userId",
      "limit",
      "campaignIds",
      "startDateTime",
      "endDateTime",
      "excludeBlastCampaigns",
      "messageMedium",
    ],
    sensitive: true,
  },
  { id: "track_event", method: "POST", path: "/api/events/track", body: true },
  {
    id: "track_purchase",
    method: "POST",
    path: "/api/commerce/trackPurchase",
    body: true,
  },
  {
    id: "update_cart",
    method: "POST",
    path: "/api/commerce/updateCart",
    body: true,
  },
  {
    id: "subscribe_list",
    method: "POST",
    path: "/api/lists/subscribe",
    body: true,
  },
  {
    id: "unsubscribe_list",
    method: "POST",
    path: "/api/lists/unsubscribe",
    body: true,
  },
  { id: "update_user", method: "POST", path: "/api/users/update", body: true },
  {
    id: "update_subscriptions",
    method: "POST",
    path: "/api/users/updateSubscriptions",
    body: true,
  },
  { id: "send_email", method: "POST", path: "/api/email/target", body: true },
  { id: "cancel_email", method: "POST", path: "/api/email/cancel", body: true },
  { id: "send_inapp", method: "POST", path: "/api/inApp/target", body: true },
  { id: "cancel_inapp", method: "POST", path: "/api/inApp/cancel", body: true },
  { id: "send_push", method: "POST", path: "/api/push/target", body: true },
  { id: "cancel_push", method: "POST", path: "/api/push/cancel", body: true },
  { id: "send_sms", method: "POST", path: "/api/sms/target", body: true },
  { id: "cancel_sms", method: "POST", path: "/api/sms/cancel", body: true },
  {
    id: "trigger_workflow",
    method: "POST",
    path: "/api/workflows/triggerWorkflow",
    body: true,
  },
];

export const ITERABLE_OPERATION_BY_ID = new Map(
  ITERABLE_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ITERABLE_SAFE_READ_OPERATION_IDS = ITERABLE_OPERATIONS.filter(
  (operation) => operation.method === "GET" && !operation.sensitive,
).map((operation) => operation.id);
export const ITERABLE_SENSITIVE_READ_OPERATION_IDS = ITERABLE_OPERATIONS.filter(
  (operation) => operation.method === "GET" && operation.sensitive,
).map((operation) => operation.id);
export const ITERABLE_MANAGE_OPERATION_IDS = ITERABLE_OPERATIONS.filter(
  (operation) => operation.method !== "GET",
).map((operation) => operation.id);
