export {
  CANONICAL_RUNTIME_SUPPORT as LEMON_SQUEEZY_RUNTIME_SUPPORT,
  compileCanonicalHermesPack as compileLEMON_SQUEEZYHermesPack,
  compileCanonicalOpenClawPack as compileLEMON_SQUEEZYOpenClawPack,
} from "../canonical-pack";
export { LEMON_SQUEEZY_APPROVAL_PROFILES } from "./approval-profiles";
export { LEMON_SQUEEZY_CAPABILITIES } from "./capabilities";
export { LEMON_SQUEEZY_ENDPOINT_FAMILIES } from "./endpoints";

export const LEMON_SQUEEZY_PROVIDER_ROUTER_DOCTRINE = [
  "Use JSON:API Bearer-authenticated endpoints for store commerce and the separate License API for activate/validate/deactivate workflows.",
  "Read stores, products, variants, files, orders, subscriptions, customers, licenses, discounts, checkouts, and webhooks with customer data minimized.",
  "Approval is required for checkout creation, refunds, subscription changes, discounts, catalogue/files, license entitlement changes, and webhook mutations.",
  "Never expose API keys, webhook signing secrets, full license keys when short keys suffice, raw payment data, or unapproved entitlement changes.",
];
