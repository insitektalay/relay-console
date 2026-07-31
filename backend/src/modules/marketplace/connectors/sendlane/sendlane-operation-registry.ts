export type SendlaneOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  body?: boolean;
};

export const SENDLANE_OPERATIONS: SendlaneOperation[] = [
  { id: "list_senders", method: "GET", path: "/v2/senders" },
  {
    id: "send_customer_added",
    method: "POST",
    path: "/v2/tracking/customer-added",
    body: true,
  },
  {
    id: "send_product_added",
    method: "POST",
    path: "/v2/tracking/product-added",
    body: true,
  },
  {
    id: "send_product_viewed",
    method: "POST",
    path: "/v2/tracking/product-viewed",
    body: true,
  },
  {
    id: "send_added_to_cart",
    method: "POST",
    path: "/v2/tracking/added-to-cart",
    body: true,
  },
  {
    id: "send_checkout_started",
    method: "POST",
    path: "/v2/tracking/checkout-started",
    body: true,
  },
  {
    id: "send_order_placed",
    method: "POST",
    path: "/v2/tracking/order-placed",
    body: true,
  },
];

export const SENDLANE_OPERATION_BY_ID = new Map(
  SENDLANE_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const SENDLANE_READ_OPERATION_IDS = SENDLANE_OPERATIONS.filter(
  (operation) => operation.method === "GET",
).map((operation) => operation.id);
export const SENDLANE_TRACK_OPERATION_IDS = SENDLANE_OPERATIONS.filter(
  (operation) => operation.method === "POST",
).map((operation) => operation.id);
