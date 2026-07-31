import { capability, type MarketplaceCapability } from "../../catalog/marketplace-catalog.types";

export const STRIPE_CAPABILITIES: MarketplaceCapability[] = [
  capability(
    "customers_read",
    "Customers Read",
    "Read customer records, contact metadata, billing state, and related payment status.",
    true,
  ),
  capability(
    "customers_write",
    "Customers Write",
    "Create or update customer records only within approval policy and without exposing payment data.",
    false,
  ),
  capability(
    "invoices_read",
    "Invoices Read",
    "Read invoices, invoice status, line items, payment status, and hosted invoice links.",
    true,
  ),
  capability(
    "invoices_draft",
    "Invoices Draft",
    "Create draft invoices, invoice items, and invoice previews without sending or collecting payment.",
    true,
  ),
  capability(
    "invoices_send",
    "Invoices Send",
    "Finalize or send invoices only after explicit marketplace approval.",
    false,
  ),
  capability(
    "subscriptions_read",
    "Subscriptions Read",
    "Read subscriptions, subscription items, trial status, renewal dates, and cancellation state.",
    true,
  ),
  capability(
    "subscriptions_manage",
    "Subscriptions Manage",
    "Create, update, pause, resume, migrate, or cancel subscriptions only under approval policy.",
    false,
  ),
  capability(
    "payment_links_create",
    "Payment Links",
    "Create or update payment links only after confirming product, price, customer-facing copy, and approval.",
    false,
  ),
  capability(
    "refunds_create",
    "Refunds",
    "Create refunds only after approval and a verified payment, amount, reason, and customer context.",
    false,
  ),
  capability(
    "disputes_read",
    "Disputes Read",
    "Read disputes, evidence deadlines, payment references, and dispute status for triage.",
    true,
  ),
  capability(
    "balance_read",
    "Balance Read",
    "Read balances, transactions, and payout-relevant status without initiating money movement.",
    true,
  ),
  capability(
    "products_prices_read",
    "Products And Prices Read",
    "Read products, prices, lookup keys, recurring terms, tax behavior, and active status.",
    true,
  ),
  capability(
    "products_prices_write",
    "Products And Prices Write",
    "Create or update products and prices only after approval because they affect checkout and billing.",
    false,
  ),
  capability(
    "webhooks_manage",
    "Webhooks Manage",
    "Inspect or modify webhook endpoints and event subscriptions only under approval policy.",
    false,
  ),
];
