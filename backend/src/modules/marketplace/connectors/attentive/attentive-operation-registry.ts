export type AttentiveOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pathParams?: string[];
  query?: string[];
  body?: boolean;
  sensitive?: boolean;
};

export const ATTENTIVE_OPERATIONS: AttentiveOperation[] = [
  { id: "get_me", method: "GET", path: "/v1/me" },
  { id: "list_webhooks", method: "GET", path: "/v1/webhooks" },
  { id: "create_webhook", method: "POST", path: "/v1/webhooks", body: true },
  {
    id: "delete_webhook",
    method: "DELETE",
    path: "/v1/webhooks/{webhookId}",
    pathParams: ["webhookId"],
  },
  {
    id: "update_webhook",
    method: "PUT",
    path: "/v1/webhooks/{webhookId}",
    pathParams: ["webhookId"],
    body: true,
  },
  {
    id: "post_product_view",
    method: "POST",
    path: "/v1/events/ecommerce/product-view",
    body: true,
  },
  {
    id: "post_add_to_cart",
    method: "POST",
    path: "/v1/events/ecommerce/add-to-cart",
    body: true,
  },
  {
    id: "post_purchase",
    method: "POST",
    path: "/v1/events/ecommerce/purchase",
    body: true,
  },
  {
    id: "create_coupons",
    method: "POST",
    path: "/v1/coupons/coupon-pool/{couponPoolId}/create",
    pathParams: ["couponPoolId"],
    body: true,
  },
  {
    id: "post_custom_event",
    method: "POST",
    path: "/v1/events/custom",
    body: true,
  },
  {
    id: "post_custom_attributes",
    method: "POST",
    path: "/v1/attributes/custom",
    body: true,
  },
  {
    id: "get_custom_attributes",
    method: "GET",
    path: "/v1/attributes/custom",
    query: ["phone", "email"],
    sensitive: true,
  },
  {
    id: "subscribe_user",
    method: "POST",
    path: "/v1/subscriptions",
    body: true,
  },
  {
    id: "get_subscriptions",
    method: "GET",
    path: "/v1/subscriptions",
    query: ["phone", "email"],
    sensitive: true,
  },
  {
    id: "unsubscribe_user",
    method: "POST",
    path: "/v1/subscriptions/unsubscribe",
    body: true,
  },
  {
    id: "upload_product_catalog",
    method: "POST",
    path: "/v1/product-catalog/uploads",
    body: true,
  },
  {
    id: "list_catalog_uploads",
    method: "GET",
    path: "/v1/product-catalog/uploads",
  },
  {
    id: "get_catalog_upload",
    method: "GET",
    path: "/v1/product-catalog/uploads/{uploadId}",
    pathParams: ["uploadId"],
  },
  {
    id: "add_privacy_delete_request",
    method: "POST",
    path: "/v1/privacy/delete-request",
    body: true,
  },
  {
    id: "get_privacy_delete_request",
    method: "GET",
    path: "/v1/privacy/delete-request/{id}",
    pathParams: ["id"],
    sensitive: true,
  },
  {
    id: "identify_user",
    method: "POST",
    path: "/v1/identity-resolution/user-identifiers",
    body: true,
  },
  { id: "get_me_v2", method: "GET", path: "/v2/me" },
  {
    id: "post_user_attributes_v2",
    method: "POST",
    path: "/v2/user/attributes",
    body: true,
  },
  {
    id: "get_bulk_job_status",
    method: "GET",
    path: "/v2/bulk/job/{bulkJobId}",
    pathParams: ["bulkJobId"],
  },
  {
    id: "post_bulk_user_attributes",
    method: "POST",
    path: "/v2/bulk/user/attributes",
    body: true,
  },
  {
    id: "add_bulk_segment_members",
    method: "POST",
    path: "/v2/bulk/segments/members",
    body: true,
  },
  {
    id: "remove_bulk_segment_members",
    method: "DELETE",
    path: "/v2/bulk/segments/members",
    body: true,
  },
  { id: "create_segment", method: "POST", path: "/v2/segments", body: true },
  {
    id: "list_segments",
    method: "GET",
    path: "/v2/segments",
    query: ["name", "externalId", "updatedSince", "cursor", "limit"],
  },
  {
    id: "get_segment_by_external_id",
    method: "GET",
    path: "/v2/segments/external/{externalId}",
    pathParams: ["externalId"],
  },
  {
    id: "patch_segment_by_external_id",
    method: "PATCH",
    path: "/v2/segments/external/{externalId}",
    pathParams: ["externalId"],
    body: true,
  },
  {
    id: "archive_segment_by_external_id",
    method: "DELETE",
    path: "/v2/segments/external/{externalId}",
    pathParams: ["externalId"],
  },
];

export const ATTENTIVE_OPERATION_BY_ID = new Map(
  ATTENTIVE_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ATTENTIVE_SAFE_READ_OPERATION_IDS = ATTENTIVE_OPERATIONS.filter(
  (operation) => operation.method === "GET" && !operation.sensitive,
).map((operation) => operation.id);
export const ATTENTIVE_SENSITIVE_READ_OPERATION_IDS =
  ATTENTIVE_OPERATIONS.filter(
    (operation) => operation.method === "GET" && operation.sensitive,
  ).map((operation) => operation.id);
export const ATTENTIVE_MANAGE_OPERATION_IDS = ATTENTIVE_OPERATIONS.filter(
  (operation) => operation.method !== "GET",
).map((operation) => operation.id);
