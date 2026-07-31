export {
  CANONICAL_RUNTIME_SUPPORT as CHARGEBEE_RUNTIME_SUPPORT,
  compileCanonicalHermesPack as compileCHARGEBEEHermesPack,
  compileCanonicalOpenClawPack as compileCHARGEBEEOpenClawPack,
} from "../canonical-pack";
export { CHARGEBEE_APPROVAL_PROFILES } from "./approval-profiles";
export { CHARGEBEE_CAPABILITIES } from "./capabilities";
export { CHARGEBEE_ENDPOINT_FAMILIES } from "./endpoints";

export const CHARGEBEE_PROVIDER_ROUTER_DOCTRINE = [
  "Verify Chargebee site subdomain, test/live site, and Basic Auth API key before writes.",
  "Read customers, subscriptions, items/plans/item prices, invoices, payments, estimates, coupons, hosted pages, events, and webhooks with billing data minimized.",
  "Approval is required for invoices, hosted payment pages, refunds/credits, subscription lifecycle changes, catalogue/coupon changes, customer billing exports, and webhook mutations.",
  "Never expose API keys, webhook secrets, raw card data, tax/legal/business settings, or perform unapproved live billing actions.",
];
