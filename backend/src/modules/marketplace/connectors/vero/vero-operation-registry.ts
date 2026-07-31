export type VeroOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  auth: "track" | "campaign";
  policy: "structural_read" | "sensitive_read" | "manage";
  pathParams?: string[];
  query?: string[];
  body?: boolean;
};

export const VERO_OPERATIONS: VeroOperation[] = [
  {
    id: "list_broadcasts",
    method: "GET",
    path: "/api/v2/broadcasts",
    auth: "campaign",
    policy: "structural_read",
    query: ["limit", "sort", "status"],
  },
  {
    id: "get_broadcast",
    method: "GET",
    path: "/api/v2/broadcasts/{id}",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["id"],
  },
  {
    id: "list_broadcast_messages",
    method: "GET",
    path: "/api/v2/broadcasts/{broadcast_id}/messages",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["broadcast_id"],
  },
  {
    id: "get_broadcast_message",
    method: "GET",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{id}",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["broadcast_id", "id"],
  },
  {
    id: "list_broadcast_contents",
    method: "GET",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{message_id}/contents",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["broadcast_id", "message_id"],
  },
  {
    id: "list_journeys",
    method: "GET",
    path: "/api/v2/journeys",
    auth: "campaign",
    policy: "structural_read",
    query: ["limit", "sort", "status"],
  },
  {
    id: "get_journey",
    method: "GET",
    path: "/api/v2/journeys/{id}",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["id"],
  },
  {
    id: "list_journey_messages",
    method: "GET",
    path: "/api/v2/journeys/{journey_id}/messages",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["journey_id"],
  },
  {
    id: "get_journey_message",
    method: "GET",
    path: "/api/v2/journeys/{journey_id}/messages/{id}",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["journey_id", "id"],
  },
  {
    id: "list_journey_contents",
    method: "GET",
    path: "/api/v2/journeys/{journey_id}/messages/{message_id}/contents",
    auth: "campaign",
    policy: "structural_read",
    pathParams: ["journey_id", "message_id"],
  },
  {
    id: "get_broadcast_content",
    method: "GET",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{message_id}/contents/{id}",
    auth: "campaign",
    policy: "sensitive_read",
    pathParams: ["broadcast_id", "message_id", "id"],
  },
  {
    id: "get_journey_content",
    method: "GET",
    path: "/api/v2/journeys/{journey_id}/messages/{message_id}/contents/{id}",
    auth: "campaign",
    policy: "sensitive_read",
    pathParams: ["journey_id", "message_id", "id"],
  },
  {
    id: "identify_user",
    method: "POST",
    path: "/api/v2/users/track",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "track_event",
    method: "POST",
    path: "/api/v2/events/track",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "edit_user_tags",
    method: "PUT",
    path: "/api/v2/users/tags/edit",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "alias_user",
    method: "PUT",
    path: "/api/v2/users/reidentify",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "unsubscribe_user",
    method: "POST",
    path: "/api/v2/users/unsubscribe",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "resubscribe_user",
    method: "POST",
    path: "/api/v2/users/resubscribe",
    auth: "track",
    policy: "manage",
    body: true,
  },
  {
    id: "create_broadcast",
    method: "POST",
    path: "/api/v2/broadcasts",
    auth: "campaign",
    policy: "manage",
    body: true,
  },
  {
    id: "update_broadcast",
    method: "PATCH",
    path: "/api/v2/broadcasts/{id}",
    auth: "campaign",
    policy: "manage",
    pathParams: ["id"],
    body: true,
  },
  {
    id: "create_broadcast_message",
    method: "POST",
    path: "/api/v2/broadcasts/{broadcast_id}/messages",
    auth: "campaign",
    policy: "manage",
    pathParams: ["broadcast_id"],
    body: true,
  },
  {
    id: "update_broadcast_message",
    method: "PATCH",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{id}",
    auth: "campaign",
    policy: "manage",
    pathParams: ["broadcast_id", "id"],
    body: true,
  },
  {
    id: "create_broadcast_content",
    method: "POST",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{message_id}/contents",
    auth: "campaign",
    policy: "manage",
    pathParams: ["broadcast_id", "message_id"],
    body: true,
  },
  {
    id: "update_broadcast_content",
    method: "PATCH",
    path: "/api/v2/broadcasts/{broadcast_id}/messages/{message_id}/contents/{id}",
    auth: "campaign",
    policy: "manage",
    pathParams: ["broadcast_id", "message_id", "id"],
    body: true,
  },
];

export const VERO_OPERATION_BY_ID = new Map(
  VERO_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const VERO_STRUCTURAL_READ_OPERATION_IDS = VERO_OPERATIONS.filter(
  (operation) => operation.policy === "structural_read",
).map((operation) => operation.id);
export const VERO_SENSITIVE_READ_OPERATION_IDS = VERO_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const VERO_MANAGE_OPERATION_IDS = VERO_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
