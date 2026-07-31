export {
  CANONICAL_RUNTIME_SUPPORT as SHOPIFY_RUNTIME_SUPPORT,
  compileCanonicalHermesPack as compileSHOPIFYHermesPack,
  compileCanonicalOpenClawPack as compileSHOPIFYOpenClawPack,
} from "../canonical-pack";
export { SHOPIFY_APPROVAL_PROFILES } from "./approval-profiles";
export { SHOPIFY_CAPABILITIES } from "./capabilities";
export { SHOPIFY_ENDPOINT_FAMILIES } from "./endpoints";

export const SHOPIFY_PROVIDER_ROUTER_DOCTRINE = [
  "Prefer Shopify Admin GraphQL for new Admin API work; use Admin REST only for legacy/relevant resources.",
  "Verify shop domain, API version, Admin token type, and access scopes before reads or writes.",
  "Approval is required for catalogue, inventory, fulfillment, refund/return, customer/order export, and webhook mutations.",
  "Never expose Admin access tokens, OAuth credentials, webhook secrets, raw payment data, or broaden scopes.",
];
