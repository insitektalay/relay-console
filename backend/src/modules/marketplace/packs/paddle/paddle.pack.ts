export {
  CANONICAL_RUNTIME_SUPPORT as PADDLE_RUNTIME_SUPPORT,
  compileCanonicalHermesPack as compilePADDLEHermesPack,
  compileCanonicalOpenClawPack as compilePADDLEOpenClawPack,
} from "../canonical-pack";
export { PADDLE_APPROVAL_PROFILES } from "./approval-profiles";
export { PADDLE_CAPABILITIES } from "./capabilities";
export { PADDLE_ENDPOINT_FAMILIES } from "./endpoints";

export const PADDLE_PROVIDER_ROUTER_DOCTRINE = [
  "Verify sandbox/live API key environment and assigned permissions before Paddle writes.",
  "Read customers, products, prices, transactions, subscriptions, invoices, adjustments, and webhooks with bounded queries.",
  "Approval is required for transactions, invoices, refunds/credits/adjustments, subscription lifecycle changes, product/price/discount changes, and webhook mutations.",
  "Never expose Paddle API keys, webhook secrets, raw payment data, tax/legal settings, or perform unapproved live money movement.",
];
