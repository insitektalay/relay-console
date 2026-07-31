export type StripeEndpointFamily = {
  id: string;
  label: string;
  guidance: string;
  representativeEndpoints: string[];
};

export const STRIPE_ENDPOINT_FAMILIES: StripeEndpointFamily[] = [
  {
    id: "customers",
    label: "Customers",
    guidance:
      "Use customer endpoints to inspect billing identity and create or update customer records only when capability and approval policy allow it.",
    representativeEndpoints: [
      "GET /v1/customers",
      "GET /v1/customers/{customer}",
      "POST /v1/customers",
      "POST /v1/customers/{customer}",
      "GET /v1/customers/search",
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    guidance:
      "Use invoice endpoints to read invoice state and create drafts safely. Finalize, send, pay, void, or mark uncollectible only after approval.",
    representativeEndpoints: [
      "GET /v1/invoices",
      "GET /v1/invoices/{invoice}",
      "POST /v1/invoices/create_preview",
      "POST /v1/invoices",
      "POST /v1/invoices/{invoice}/send",
      "POST /v1/invoices/{invoice}/finalize",
    ],
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    guidance:
      "Use subscription endpoints to inspect recurring billing. Creation, update, pause, resume, migration, and cancellation are approval-gated.",
    representativeEndpoints: [
      "GET /v1/subscriptions",
      "GET /v1/subscriptions/{subscription}",
      "POST /v1/subscriptions",
      "POST /v1/subscriptions/{subscription}",
      "DELETE /v1/subscriptions/{subscription}",
    ],
  },
  {
    id: "payment_links",
    label: "Payment Links",
    guidance:
      "Payment links create reusable hosted checkout URLs. Treat creation and customer-facing changes as approval-required.",
    representativeEndpoints: [
      "GET /v1/payment_links",
      "GET /v1/payment_links/{payment_link}",
      "POST /v1/payment_links",
      "POST /v1/payment_links/{payment_link}",
      "GET /v1/payment_links/{payment_link}/line_items",
    ],
  },
  {
    id: "refunds",
    label: "Refunds",
    guidance:
      "Use refund endpoints only with explicit approval and verified payment identifiers, amounts, currency, and refund reason.",
    representativeEndpoints: [
      "GET /v1/refunds",
      "GET /v1/refunds/{refund}",
      "POST /v1/refunds",
      "POST /v1/refunds/{refund}/cancel",
    ],
  },
  {
    id: "products_prices",
    label: "Products And Prices",
    guidance:
      "Read products and prices freely when enabled. Changes affect billing and checkout and require approval.",
    representativeEndpoints: [
      "GET /v1/products",
      "POST /v1/products",
      "GET /v1/prices",
      "POST /v1/prices",
      "POST /v1/prices/{price}",
    ],
  },
  {
    id: "disputes_balance",
    label: "Disputes And Balance",
    guidance:
      "Use these endpoints for payment operations triage, dispute deadlines, and account balance visibility without initiating money movement.",
    representativeEndpoints: [
      "GET /v1/disputes",
      "GET /v1/disputes/{dispute}",
      "GET /v1/balance",
      "GET /v1/balance_transactions",
    ],
  },
  {
    id: "webhooks",
    label: "Webhook Endpoints",
    guidance:
      "Use webhook endpoints to inspect delivery configuration. Creating, updating, disabling, or deleting endpoints is approval-gated.",
    representativeEndpoints: [
      "GET /v1/webhook_endpoints",
      "GET /v1/webhook_endpoints/{webhook_endpoint}",
      "POST /v1/webhook_endpoints",
      "POST /v1/webhook_endpoints/{webhook_endpoint}",
      "DELETE /v1/webhook_endpoints/{webhook_endpoint}",
    ],
  },
];
